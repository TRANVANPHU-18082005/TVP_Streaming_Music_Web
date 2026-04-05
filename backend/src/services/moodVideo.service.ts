import mongoose from "mongoose";
import TrackMoodVideo from "../models/TrackMoodVideo";
import Track from "../models/Track";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import { generateUniqueSlug } from "../utils/slug";
import { deleteFileFromCloud } from "../utils/cloudinary";
import {
  MoodVideoFilterInput,
  CreateMoodVideoInput,
  UpdateMoodVideoInput,
} from "../validations/moodVideo.validation";
import { parseTags } from "../utils/helper";

class MoodVideoService {
  /**
   * 1. CREATE: Tải lên video tâm trạng mới
   */
  async createMoodVideo(
    data: CreateMoodVideoInput,
    file?: Express.Multer.File,
  ) {
    if (!file)
      throw new ApiError(httpStatus.BAD_REQUEST, "Vui lòng tải lên file video");

    const slug = await generateUniqueSlug(TrackMoodVideo, data.title);
    const tagsArray = parseTags(data.tags);

    const moodVideo = await TrackMoodVideo.create({
      ...data,
      slug,
      tags: tagsArray,
      videoUrl: file.path,
      // Cloudinary tự động trích xuất ảnh nếu đổi đuôi file
      thumbnailUrl: file.path.replace(/\.[^/.]+$/, ".jpg"),
      isActive: String(data.isActive) !== "false",
      usageCount: 0,
    });

    return moodVideo;
  }

  /**
   * 2. UPDATE: Chỉnh sửa thông tin (Tags, Title, Status)
   */
  async updateMoodVideo(id: string, data: UpdateMoodVideoInput) {
    const video = await TrackMoodVideo.findById(id);
    if (!video)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy video");

    if (data.title && data.title !== video.title) {
      video.title = data.title;
      video.slug = await generateUniqueSlug(
        TrackMoodVideo,
        data.title,
        video._id,
      );
    }

    if (data.tags) video.tags = parseTags(data.tags);
    if (data.isActive !== undefined) video.isActive = data.isActive;

    await video.save();
    return video;
  }

  /**
   * 3. GET LIST: Phân trang, tìm kiếm và lọc
   */
  async getMoodVideos(filter: MoodVideoFilterInput) {
    const { page, limit, keyword, isActive, sort } = filter;
    const skip = (page - 1) * limit;
    const query: any = {};

    if (keyword) {
      const safeKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { title: { $regex: safeKeyword, $options: "i" } },
        { tags: { $regex: safeKeyword, $options: "i" } },
      ];
    }

    if (isActive !== undefined) query.isActive = isActive;

    let sortOption: any = { createdAt: -1 };
    if (sort === "name") sortOption = { title: 1 };
    if (sort === "popular") sortOption = { usageCount: -1 };
    if (sort === "oldest") sortOption = { createdAt: 1 };

    const [videos, total] = await Promise.all([
      TrackMoodVideo.find(query)
        .skip(skip)
        .limit(limit)
        .sort(sortOption)
        .lean(),
      TrackMoodVideo.countDocuments(query),
    ]);

    return {
      data: videos,
      meta: {
        totalItems: total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 4. GET DETAIL: Lấy chi tiết kèm danh sách bài hát đang sử dụng
   */
  async getMoodVideoDetail(id: string) {
    const video = await TrackMoodVideo.findById(id).lean();
    if (!video)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy video");

    // Lấy thêm 10 bài hát mới nhất đang sử dụng video này để hiển thị ở trang quản trị
    const usedByTracks = await Track.find({ moodVideo: id })
      .select("title slug coverImage artist")
      .populate("artist", "name")
      .limit(10)
      .sort({ createdAt: -1 })
      .lean();

    return { ...video, usedByTracks };
  }

  /**
   * 5. DELETE: Xóa video (Có check ràng buộc dữ liệu)
   */
  async deleteMoodVideo(id: string) {
    const video = await TrackMoodVideo.findById(id);
    if (!video)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy video");

    // Tuyệt đối không xóa nếu bài hát đang sử dụng (Tránh lỗi 404 video trên app)
    const isInUse = await Track.exists({ moodVideo: id });
    if (isInUse)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Video đang được sử dụng trong bài hát, hãy gỡ video khỏi bài hát trước khi xóa",
      );

    const videoUrl = video.videoUrl;
    await video.deleteOne();

    if (videoUrl) {
      // Xóa file vật lý trên Cloudinary để tiết kiệm dung lượng
      deleteFileFromCloud(videoUrl, "video").catch((err) =>
        console.error("🚨 Cloudinary Delete Error:", err),
      );
    }
    return true;
  }

  /**
   * 6. SYNC USAGE: Cập nhật lại số lượng bài hát đang sử dụng video này
   * (Nên chạy định kỳ hoặc gọi sau khi update hàng loạt Track)
   */
  async syncUsageCount(id: string) {
    const count = await Track.countDocuments({ moodVideo: id });
    return await TrackMoodVideo.findByIdAndUpdate(
      id,
      { usageCount: count },
      { new: true },
    );
  }
}

export default new MoodVideoService();
