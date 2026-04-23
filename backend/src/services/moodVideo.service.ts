// services/moodVideo.service.ts

import mongoose from "mongoose";
import TrackMoodVideo, { ITrackMoodVideo } from "../models/TrackMoodVideo";
import Track from "../models/Track";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import { deleteFileFromCloud } from "../utils/cloudinary";
import {
  MoodVideoFilterInput,
  CreateMoodVideoInput,
  UpdateMoodVideoInput,
} from "../validations/moodVideo.validation";
import { parseTags } from "../utils/helper";
import { cacheRedis } from "../config/redis";
import { invalidateTracksCache } from "../utils/cacheHelper";
import escapeStringRegexp from "escape-string-regexp";
import { number } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FIX: Xây dựng thumbnailUrl từ Cloudinary video URL đúng cách.
 * Cách cũ: replace extension — fragile nếu URL có nhiều dấu chấm.
 * Cách mới: Cloudinary transformation: thay /upload/ bằng /upload/so_0/
 * để lấy frame đầu tiên của video dưới dạng JPEG.
 *
 * Input:  https://res.cloudinary.com/.../upload/v123/folder/video.mp4
 * Output: https://res.cloudinary.com/.../upload/so_0/v123/folder/video.jpg
 */
function buildThumbnailUrl(videoUrl: string): string {
  if (!videoUrl) return "";

  try {
    // Thêm transformation `so_0` (second offset = 0) và đổi extension sang .jpg
    const withTransform = videoUrl.replace("/upload/", "/upload/so_0/");
    // Đổi extension cuối cùng sang .jpg
    return withTransform.replace(/\.[^/.]+$/, ".jpg");
  } catch {
    return "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
class MoodVideoService {
  // ── 1. CREATE ──────────────────────────────────────────────────────────────

  /**
   * NÂNG CẤP B: Thêm `loop` field.
   * FIX: Bỏ manual slug generation — `pre("save")` middleware tự lo khi isNew.
   * FIX: Dùng buildThumbnailUrl() thay vì replace extension fragile.
   */
  async createMoodVideo(
    data: CreateMoodVideoInput,
    file?: Express.Multer.File,
  ) {
    if (!file)
      throw new ApiError(httpStatus.BAD_REQUEST, "Vui lòng tải lên file video");

    const tagsArray = parseTags(data.tags);
    const thumbnailUrl = buildThumbnailUrl(file.path);

    try {
      // FIX: không cần generateUniqueSlug thủ công — pre("save") sẽ tự chạy
      const moodVideo = await TrackMoodVideo.create({
        title: data.title,
        tags: tagsArray,
        videoUrl: file.path,
        thumbnailUrl,
        // NÂNG CẤP B: Admin có thể kiểm soát loop behavior
        isActive: String(data.isActive) !== "false",
        usageCount: 0,
      });

      return moodVideo;
    } catch (error) {
      // Cleanup Cloudinary nếu DB fail
      deleteFileFromCloud(file.path, "video").catch(console.error);
      throw error;
    }
  }

  // ── 2. UPDATE ──────────────────────────────────────────────────────────────

  /**
   * NÂNG CẤP B: Thêm `loop` field vào update.
   * pre("save") tự xử lý slug khi title isModified.
   */
  /**
   * UPDATE: Chỉnh sửa thông tin và thay thế File Video nếu có.
   */
  async updateMoodVideo(
    id: string,
    data: UpdateMoodVideoInput,
    file?: Express.Multer.File,
  ) {
    const video = await TrackMoodVideo.findById(id);
    if (!video)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy video");

    const oldVideoUrl = video.videoUrl; // Lưu lại để xóa nếu có file mới

    // 1. Cập nhật các trường thông tin cơ bản
    if (data.title && data.title !== video.title) {
      video.title = data.title; // pre("save") sẽ tự động cập nhật slug
    }

    if (data.tags !== undefined) video.tags = parseTags(data.tags);
    if (data.isActive !== undefined) video.isActive = data.isActive;

    // 2. Xử lý thay thế Video mới (nếu có)
    if (file) {
      video.videoUrl = file.path;
      // Cập nhật lại thumbnail tương ứng với video mới
      video.thumbnailUrl = file.path.replace(/\.[^/.]+$/, ".jpg");
    }

    try {
      await video.save();

      // 3. Nếu save thành công và có file mới -> Xóa file cũ trên Cloudinary
      if (file && oldVideoUrl) {
        deleteFileFromCloud(oldVideoUrl, "video").catch((err) =>
          console.error("🚨 Cloudinary Delete Old Video Error:", err),
        );
      }

      // 4. INVALIDATE CACHE
      // Tìm tất cả bài hát đang dùng Video này để xóa cache chi tiết
      const affectedTracks = await Track.find({ moodVideo: id })
        .select("_id")
        .lean();
      const trackIds = affectedTracks.map((t) => t._id.toString());

      if (trackIds.length > 0) {
        // Dùng Pipeline để xóa track:detail nhanh chóng
        await invalidateTracksCache(trackIds);
      }

      return video;
    } catch (error) {
      // Nếu DB fail mà đã lỡ upload file mới -> Xóa file mới để tránh rác
      if (file) {
        deleteFileFromCloud(file.path, "video").catch(console.error);
      }
      throw error;
    }
  }

  // ── 3. GET LIST ────────────────────────────────────────────────────────────

  /**
   * FIX: Dual search strategy — $text khi không có sort (dùng text index),
   * prefix regex khi có sort. Consistent với album/artist/track/genre services.
   */
  async getMoodVideos(filter: MoodVideoFilterInput) {
    const { page, limit, keyword, isActive, sort } = filter;
    const skip = (page - 1) * limit;
    const query: Record<string, any> = {};

    let sortOption: Record<string, any>;
    let useTextScore = false;

    if (keyword) {
      if (!sort || sort === "newest" || sort === "oldest") {
        // $text: relevance ranking, dùng text index { title, tags }
        query.$text = { $search: keyword };
        useTextScore = true;
        sortOption = { score: { $meta: "textScore" }, _id: 1 };
      } else {
        // Prefix regex khi có explicit sort
        const safe = escapeStringRegexp(keyword.substring(0, 100));
        query.$or = [
          { title: { $regex: `^${safe}`, $options: "i" } },
          { tags: { $in: [new RegExp(`^${safe}`, "i")] } },
        ];
      }
    }

    if (isActive !== undefined) query.isActive = isActive;

    if (!useTextScore) {
      const SORT_MAP: Record<string, any> = {
        newest: { createdAt: -1, _id: 1 },
        oldest: { createdAt: 1, _id: 1 },
        name: { title: 1, _id: 1 },
        popular: { usageCount: -1, _id: 1 },
      };
      sortOption = SORT_MAP[sort ?? "newest"] ?? SORT_MAP.newest;
    }

    let baseQuery = TrackMoodVideo.find(query)
      .skip(skip)
      .limit(limit)
      .sort(sortOption!)
      .lean<ITrackMoodVideo & { score?: number }>();

    if (useTextScore) {
      baseQuery = baseQuery.select({
        score: { $meta: "textScore" },
      } as any);
    }

    const [videos, total] = await Promise.all([
      baseQuery.lean(),
      TrackMoodVideo.countDocuments(query),
    ]);

    return {
      data: videos,
      meta: {
        totalItems: total,
        page: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
      },
    };
  }

  // ── 4. GET DETAIL ──────────────────────────────────────────────────────────

  /**
   * NÂNG CẤP C: Dùng virtual `tracks` populate thay vì Track.find() manual.
   * Virtual đã config foreignField: "moodVideo" — Mongoose tự join.
   * options.limit: 10 + sort: createdAt -1 được truyền vào populate options.
   */
  async getMoodVideoDetail(id: string) {
    // NÂNG CẤP C: populate virtual "tracks" thay vì query riêng
    const video = await TrackMoodVideo.findById(id)
      .populate({
        path: "tracks", // virtual name trong model
        select: "title slug coverImage artist createdAt",
        populate: {
          path: "artist",
          select: "name slug",
        },
        options: {
          limit: 10,
          sort: { createdAt: -1 },
        },
      })
      .lean();

    if (!video)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy video");

    return video;
  }

  // ── 5. DELETE ──────────────────────────────────────────────────────────────

  async deleteMoodVideo(id: string) {
    const video = await TrackMoodVideo.findById(id);
    if (!video)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy video");

    // Check ràng buộc trước khi xóa
    const isInUse = await Track.exists({ moodVideo: id, isDeleted: false });
    if (isInUse)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Video đang được sử dụng trong bài hát, hãy gỡ video khỏi bài hát trước khi xóa",
      );

    const videoUrl = video.videoUrl;
    await video.deleteOne();
    // 3. DỌN DẸP CACHE (Sau khi xóa DB thành công)

    // Post-delete: cleanup Cloudinary — fire-and-forget
    if (videoUrl) {
      deleteFileFromCloud(videoUrl, "video").catch((err) =>
        console.error("[MoodVideoService] Cloudinary delete error:", err),
      );
    }

    return true;
  }

  // ── 6. SYNC USAGE ──────────────────────────────────────────────────────────

  // ── 7. MATCH MOOD CANVAS ───────────────────────────────────────────────────

  /**
   * FIX: Kết hợp tag-match score với $sample để vừa relevant vừa có tính ngẫu nhiên.
   * Cách cũ: $sample thuần túy → bias toward first matched video.
   * Cách mới:
   *   1. Tính overlap score (số tags match)
   *   2. Lọc những video có score cao nhất (top tier)
   *   3. $sample trong top tier → cân bằng relevance và diversity
   */
  async matchMoodCanvas(
    tags: string[],
    jobId?: string,
  ): Promise<mongoose.Types.ObjectId | undefined> {
    if (!Array.isArray(tags) || !tags.length) return undefined;

    try {
      const matched = await TrackMoodVideo.aggregate<{
        _id: mongoose.Types.ObjectId;
        matchScore: number;
      }>([
        // Bước 1: Lọc video active có ít nhất 1 tag match
        { $match: { tags: { $in: tags }, isActive: true } },

        // Bước 2: Tính số tags overlap
        {
          $addFields: {
            matchScore: {
              $size: {
                $ifNull: [{ $setIntersection: ["$tags", tags] }, []],
              },
            },
          },
        },

        // Bước 3: Sắp xếp theo score cao nhất
        { $sort: { matchScore: -1 } },

        // Bước 4: Giữ top 5 để sample trong đó (balance relevance & diversity)
        { $limit: 5 },

        // Bước 5: Random 1 trong top 5
        { $sample: { size: 1 } },

        { $project: { _id: 1, matchScore: 1 } },
      ]).option({ maxTimeMS: 5_000 });

      return matched[0]?._id;
    } catch (err) {
      console.warn(
        `[Job ${jobId ?? "?"}] Mood canvas match failed (non-fatal):`,
        (err as Error).message,
      );
      return undefined;
    }
  }
}

export default new MoodVideoService();
