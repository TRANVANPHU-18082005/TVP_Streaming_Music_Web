import httpStatus from "http-status";
import mongoose, { Types } from "mongoose";
import Track, { ITrack } from "../models/Track";
import User, { IUser } from "../models/User";
import Artist from "../models/Artist";
import Album from "../models/Album";
import Genre from "../models/Genre";
import ApiError from "../utils/ApiError";
import { addTranscodeJob, audioQueue } from "../queue/transcodeTrack.queue";
import { generateUniqueSlug } from "../utils/slug";
import {
  BulkUpdateTrackInput,
  ChangeStatusInput,
  CreateTrackInput,
  TrackFilterInput,
  UpdateTrackInput,
} from "../validations/track.validation";
import { deleteFolderFromB2, deleteFromB2 } from "../utils/fileCleanup";
import { cacheRedis } from "../config/redis";
import { notifyQueue } from "../queue/notify.queue";
import Follow from "../models/Follow";
import { viewQueue } from "../queue/view.queue"; // Đảm bảo chữ q viết thường
import { CreateTrackDTO, UpdateTrackDTO } from "../dtos/track.dto";

type MulterS3File = Express.Multer.File & { location: string; key: string };

class TrackService {
  /**
   * Helper: Trích xuất Key từ URL (Sử dụng để xóa file đơn lẻ)
   */
  private getB2KeyFromUrl(url: string): string | null {
    if (!url || !url.includes(process.env.B2_BUCKET_NAME as string))
      return null;
    const parts = url.split(`${process.env.B2_BUCKET_NAME}/`);
    return parts.length > 1 ? parts[1] : null;
  }

  /**
   * Helper: Trích xuất Folder cha từ URL (Sử dụng để xóa trọn bộ audio/hls/cover)
   * Ví dụ: tracks/slug-123/audio/file.mp3 -> tracks/slug-123
   */
  private getTrackFolderKey(url: string): string | null {
    const fileKey = this.getB2KeyFromUrl(url);
    if (!fileKey) return null;
    const parts = fileKey.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  }

  /**
   * 1. CREATE TRACK (Transaction + Atomic Cleanup + Notification Fan-out)
   */

  async createTrack(
    currentUser: IUser,
    data: CreateTrackDTO, // Sử dụng DTO mới
    files: { [fieldname: string]: Express.Multer.File[] },
  ): Promise<ITrack> {
    // A. Permission & Artist Check (Giữ nguyên logic của bạn)
    let targetArtistId: Types.ObjectId;
    let targetArtistName = "";

    if (currentUser.role === "admin") {
      if (!data.artistId)
        throw new ApiError(httpStatus.BAD_REQUEST, "Admin phải chọn Artist");
      const artist = await Artist.findById(data.artistId).lean();
      if (!artist)
        throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy Artist");
      targetArtistId = artist._id as Types.ObjectId;
      targetArtistName = artist.name;
    } else {
      const artist = await Artist.findOne({ user: currentUser._id }).lean();
      if (!artist)
        throw new ApiError(httpStatus.FORBIDDEN, "Bạn chưa có Profile Nghệ sĩ");
      targetArtistId = artist._id as Types.ObjectId;
      targetArtistName = artist.name;
    }

    // B. File Handling
    const audioFile = files["audio"]?.[0] as MulterS3File;
    if (!audioFile)
      throw new ApiError(httpStatus.BAD_REQUEST, "Thiếu file Audio");

    const formatUrl = (location: string, key: string) => {
      if (location.startsWith("http")) return location;
      const endpoint = process.env.B2_ENDPOINT?.replace(/\/$/, "");
      const bucket = process.env.B2_BUCKET_NAME;
      return `${endpoint}/${bucket}/${key}`;
    };

    const fullTrackUrl = formatUrl(audioFile.location, audioFile.key);
    const duration = Number(data.duration) || 0;

    // Artwork logic
    let coverImageUrl = "";
    let coverFileKey = "";
    const coverFile = files["coverImage"]?.[0] as MulterS3File;

    if (coverFile) {
      coverImageUrl = coverFile.location;
      coverFileKey = coverFile.key;
    } else if (data.albumId) {
      const album = await Album.findById(data.albumId).lean();
      if (album) coverImageUrl = album.coverImage;
    }

    const seoSlug = await generateUniqueSlug(Track, data.title);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // C. Create Record với các thuộc tính MỚI
      const track = new Track({
        ...data,
        slug: seoSlug,
        artist: targetArtistId,
        uploader: currentUser._id,
        trackUrl: fullTrackUrl,
        coverImage: coverImageUrl,

        // --- NEW v2.0 FIELDS ---
        moodVideo: data.moodVideoId
          ? new Types.ObjectId(data.moodVideoId)
          : null,
        lyricType: data.lyricType || "none",
        plainLyrics: data.plainLyrics || "", // Chứa LRC hoặc Text thô
        // -----------------------

        duration,
        fileSize: audioFile.size,
        format: audioFile.mimetype.split("/")[1] || "mp3",
        status: "pending",
        // Chống lỗi khi truyền string từ FormData
        isPublic: String(data.isPublic) === "true",
        isExplicit: String(data.isExplicit) === "true",
        playCount: 0,
        likeCount: 0,
      });

      await track.save({ session });

      // D. Update Counters (Atomic) - Giữ nguyên logic Album/Artist/Genre
      await Artist.findByIdAndUpdate(targetArtistId, {
        $inc: { totalTracks: 1 },
      }).session(session);

      if (data.genreIds?.length) {
        await Genre.updateMany(
          { _id: { $in: data.genreIds } },
          { $inc: { trackCount: 1 } },
        ).session(session);
      }

      if (data.albumId) {
        await Album.findByIdAndUpdate(data.albumId, {
          $inc: { totalTracks: 1, totalDuration: duration },
        }).session(session);
      }

      await session.commitTransaction();

      // ==========================================================
      // E. QUEUE JOBS (Trigger Worker v2.0)
      // ==========================================================

      // Gửi đầy đủ thông tin để Worker xử lý HLS + Lyrics + Canvas
      addTranscodeJob({
        trackId: track._id.toString(),
        fileUrl: track.trackUrl,
      }).catch((err) => console.error("❌ Add Transcode Queue Failed:", err));

      // this.pushNewTrackNotification(track, targetArtistName).catch(
      //   console.error,
      // );

      return track;
    } catch (error) {
      await session.abortTransaction();
      if (audioFile.key) deleteFromB2(audioFile.key).catch(console.error);
      if (coverFileKey) deleteFromB2(coverFileKey).catch(console.error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Private helper: Tìm fan và đẩy vào hàng chờ thông báo
   */
  private async pushNewTrackNotification(track: any, artistName: string) {
    const followers = await Follow.find({ artistId: track.artist })
      .select("followerId")
      .lean();
    const followerIds = followers.map((f) => f.followerId.toString());

    if (followerIds.length > 0) {
      await notifyQueue.add("send-new-track", {
        artistId: track.artist,
        trackId: track._id,
        trackTitle: track.title,
        artistName: artistName,
        followerIds,
      });
      console.log(`🚀 Queued notification for ${followerIds.length} followers`);
    }
  }

  /**
   * 2. UPDATE TRACK (v2.0 - Lifecycle, Canvas & Lyric Sync)
   */
  async updateTrack(
    trackId: string,
    currentUser: IUser,
    data: UpdateTrackDTO,
    files: { [fieldname: string]: Express.Multer.File[] },
  ) {
    const track = await Track.findById(trackId);
    if (!track)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy bài hát");

    const isOwner = track.uploader.toString() === currentUser._id.toString();
    if (currentUser.role !== "admin" && !isOwner)
      throw new ApiError(httpStatus.FORBIDDEN, "Không có quyền");

    let filesToRollback: string[] = [];
    let oldTrackFolder: string | null = null;
    let coverToCleanup: { type: "s3" | "cloudinary"; key: string } | null =
      null;
    let isAudioChanged = false;

    const audioFile = files["audio"]?.[0] as MulterS3File;
    const coverFile = files["coverImage"]?.[0] as MulterS3File;

    if (audioFile) filesToRollback.push(audioFile.key);
    if (coverFile) filesToRollback.push(coverFile.key);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const oldAlbumId = track.album?.toString();
      const oldDuration = track.duration || 0;
      const oldGenreIdsStr = track.genres.map((g) => g.toString());

      // 1. Metadata & Slug Sync
      if (data.title && data.title !== track.title) {
        track.title = data.title;
        track.slug = await generateUniqueSlug(Track, data.title, track._id);
      }

      // 2. Cập nhật các trường thông thường & Ép kiểu Boolean từ FormData
      Object.assign(track, {
        ...data,
        isExplicit:
          data.isExplicit !== undefined
            ? String(data.isExplicit) === "true"
            : track.isExplicit,
        isPublic:
          data.isPublic !== undefined
            ? String(data.isPublic) === "true"
            : track.isPublic,
      });

      // 3. NÂNG CẤP v2.0: Cập nhật MoodVideo & Lyrics
      if (data.moodVideoId !== undefined) {
        // Nếu gửi chuỗi rỗng hoặc "null" -> Chuyển về null (để AI tự match)
        if (data.moodVideoId === "" || data.moodVideoId === "null") {
          track.moodVideo = undefined;
        } else {
          track.moodVideo = new Types.ObjectId(data.moodVideoId as string);
        }
      }

      if (data.lyricType) track.lyricType = data.lyricType;
      if (data.plainLyrics !== undefined) track.plainLyrics = data.plainLyrics;

      // 4. Đồng bộ Duration (Chỉ cập nhật nếu có gửi lên)
      const newDuration = data.duration ? Number(data.duration) : oldDuration;
      track.duration = newDuration;

      // 5. Genre Counter Sync (Giữ nguyên logic cũ rất tốt của Phú)
      if (data.genreIds) {
        const added = data.genreIds.filter(
          (id) => !oldGenreIdsStr.includes(id),
        );
        const removed = oldGenreIdsStr.filter(
          (id) => !data.genreIds!.includes(id),
        );

        if (added.length)
          await Genre.updateMany(
            { _id: { $in: added } },
            { $inc: { trackCount: 1 } },
          ).session(session);
        if (removed.length)
          await Genre.updateMany(
            { _id: { $in: removed }, trackCount: { $gt: 0 } },
            { $inc: { trackCount: -1 } },
          ).session(session);
        track.genres = data.genreIds.map((id) => new Types.ObjectId(id));
      }

      // 6. Album Counter Sync
      if (data.albumId !== undefined) {
        const newAlbumId =
          data.albumId === "" || data.albumId === "null" ? null : data.albumId;
        if (newAlbumId !== oldAlbumId) {
          if (oldAlbumId)
            await Album.findByIdAndUpdate(oldAlbumId, {
              $inc: { totalTracks: -1, totalDuration: -oldDuration },
            }).session(session);
          if (newAlbumId) {
            await Album.findByIdAndUpdate(newAlbumId, {
              $inc: { totalTracks: 1, totalDuration: newDuration },
            }).session(session);
            track.album = new Types.ObjectId(newAlbumId);
          } else track.album = null;
        } else if (newAlbumId && newDuration !== oldDuration) {
          await Album.findByIdAndUpdate(newAlbumId, {
            $inc: { totalDuration: newDuration - oldDuration },
          }).session(session);
        }
      }

      // 7. Media Replacement (Audio & Cover)
      if (audioFile) {
        oldTrackFolder = this.getTrackFolderKey(track.trackUrl);
        isAudioChanged = true;
        track.trackUrl = audioFile.location;
        track.status = "pending"; // Reset để transcode lại HLS
        track.hlsUrl = "";
        track.fileSize = audioFile.size;
        track.format = audioFile.mimetype.split("/")[1] || "mp3";
      }

      if (coverFile) {
        if (track.coverImage) {
          const key = this.getB2KeyFromUrl(track.coverImage);
          if (key) coverToCleanup = { type: "s3", key };
        }
        track.coverImage = coverFile.location;
      }

      await track.save({ session });
      await session.commitTransaction();

      // Xóa cache sau khi update thành công
      await cacheRedis.del(`track:detail:${trackId}`);
    } catch (error) {
      await session.abortTransaction();
      for (const key of filesToRollback) deleteFromB2(key).catch(console.error);
      throw error;
    } finally {
      await session.endSession();
    }

    // 8. HẬU KỲ: Dọn rác & Re-queue
    if (isAudioChanged && oldTrackFolder) {
      // Xóa trọn bộ folder HLS cũ
      deleteFolderFromB2(oldTrackFolder).catch(console.error);

      // Đẩy job mới vào Worker v2.0
      addTranscodeJob({
        trackId: track._id.toString(),
        fileUrl: track.trackUrl,
      }).catch((err) => console.error("❌ Re-queue Failed:", err));
    } else if (coverToCleanup && coverToCleanup.type === "s3") {
      deleteFromB2(coverToCleanup.key).catch(console.error);
    }

    return track;
  }

  /**
   * 3. DELETE TRACK (Soft Delete + Physical Cleanup)
   */
  async deleteTrack(trackId: string, currentUser: IUser) {
    const track = await Track.findById(trackId);
    if (!track || track.isDeleted)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy bài hát");

    const isOwner = track.uploader.toString() === currentUser._id.toString();
    if (currentUser.role !== "admin" && !isOwner)
      throw new ApiError(httpStatus.FORBIDDEN, "Không có quyền");

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await Artist.findByIdAndUpdate(track.artist, {
        $inc: { totalTracks: -1 },
      }).session(session);
      if (track.genres?.length) {
        await Genre.updateMany(
          { _id: { $in: track.genres } },
          { $inc: { trackCount: -1 } },
        ).session(session);
      }
      if (track.album) {
        await Album.findByIdAndUpdate(track.album, {
          $inc: { totalTracks: -1, totalDuration: -(track.duration || 0) },
        }).session(session);
      }

      await Track.findByIdAndUpdate(trackId, { isDeleted: true }, { session });
      await session.commitTransaction();

      const trackFolder = this.getTrackFolderKey(track.trackUrl);
      if (trackFolder) deleteFolderFromB2(trackFolder).catch(console.error);

      return true;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * 4. GET TRACKS (Optimized with Lean)
   */
  async getTracks(filter: TrackFilterInput, currentUser?: IUser) {
    const {
      page = 1,
      limit = 20,
      keyword,
      artistId,
      albumId,
      genreId,
      status,
      sort,
    } = filter;

    const skip = (Number(page) - 1) * Number(limit);

    // 1. KHỞI TẠO QUERY GỐC
    const query: any = { isDeleted: false };

    // 2. XỬ LÝ ĐIỀU KIỆN PHÂN QUYỀN VÀ TRẠNG THÁI (Dùng $and để bảo mật)
    const andConditions: any[] = [];

    // Nếu không phải Admin, chỉ thấy nhạc Public/Ready hoặc nhạc mình tự Upload
    if (currentUser?.role !== "admin") {
      const visibilityConditions: any[] = [{ isPublic: true, status: "ready" }];
      if (currentUser) {
        visibilityConditions.push({ uploader: currentUser._id });
      }
      andConditions.push({ $or: visibilityConditions });
    }

    // 3. XỬ LÝ TÌM KIẾM KEYWORD (Không ghi đè logic ở trên)
    if (keyword) {
      const safeKeyword = keyword.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      andConditions.push({
        $or: [
          { title: { $regex: safeKeyword, $options: "i" } },
          { tags: { $regex: safeKeyword, $options: "i" } },
        ],
      });
    }

    // Gộp các điều kiện phức tạp vào query chính
    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    // 4. CÁC FILTER ĐƠN LẺ
    if (status) query.status = status;
    if (artistId) query.artist = artistId;
    if (albumId) query.album = albumId;
    if (genreId) query.genres = genreId;

    // 5. CẤU HÌNH SORT
    let sortOption: any = { createdAt: -1 };
    if (sort === "oldest") sortOption = { createdAt: 1 };
    if (sort === "popular") sortOption = { playCount: -1 };
    if (sort === "name") sortOption = { title: 1 };

    // 6. THỰC THI QUERY (FIX LỖI POPULATE MOODVIDEO)
    const [tracksDocs, total] = await Promise.all([
      Track.find(query)
        .populate("artist", "name avatar slug")
        .populate("album", "title coverImage slug")
        .populate("genres", "name slug color")
        .populate("featuringArtists", "name slug avatar")
        // FIX: Dùng đúng tên trường trong Schema (moodVideo) và chỉ định Model
        .populate({
          path: "moodVideo",
          select: "title videoUrl slug",
          model: "TrackMoodVideo",
        })
        .select("-lyrics -description") // Ẩn bớt data nặng để load danh sách nhanh
        .sort(sortOption)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Track.countDocuments(query),
    ]);

    // 8. MAPPING DỮ LIỆU CUỐI CÙNG
    return {
      data: tracksDocs,

      meta: {
        totalItems: total,
        page: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * 5. GET BY ID / SLUG
   */
  async getTrackById(slugOrId: string, currentUser?: IUser) {
    const isId = Types.ObjectId.isValid(slugOrId);
    const query = isId ? { _id: slugOrId } : { slug: slugOrId };

    const track = await Track.findOne({ ...query, isDeleted: false })
      .populate("artist", "name avatar slug bio totalFollowers")
      .populate("featuringArtists", "name slug avatar")
      .populate("album", "title coverImage releaseYear slug")
      .populate("genres", "name slug color")
      .lean();

    if (!track)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy bài hát");

    const isOwner =
      currentUser && track.uploader.toString() === currentUser._id.toString();
    const isAdmin = currentUser?.role === "admin";

    if (!track.isPublic && !isOwner && !isAdmin) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Bài hát này đang ở chế độ riêng tư",
      );
    }

    return { ...track };
  }

  /**
   * 6. RETRY TRANSCODE (Safe Cleanup & Re-queue)
   */
  async retryTranscode(trackId: string) {
    const track = await Track.findById(trackId);
    if (!track) throw new ApiError(httpStatus.NOT_FOUND, "Track not found");

    // Chặn nếu đang xử lý để tránh xung đột FFmpeg
    if (track.status === "processing") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Bài hát đang trong quá trình xử lý, vui lòng đợi.",
      );
    }

    // 1. Dọn rác folder HLS cũ (nếu có) để tránh ghi đè lỗi
    const trackFolder = this.getTrackFolderKey(track.trackUrl);
    if (trackFolder) {
      // Thêm dấu / ở cuối để đảm bảo xóa đúng folder hls
      deleteFolderFromB2(`${trackFolder}/hls/`).catch(console.error);
    }

    // 2. Reset trạng thái trong Database
    track.status = "pending";
    track.errorReason = "";
    track.hlsUrl = "";
    await track.save();

    // 3. Đẩy lại vào Queue với cấu hình tự dọn dẹp
    await audioQueue.add(
      "transcode",
      {
        trackId: track._id.toString(),
        fileUrl: track.trackUrl,
      },
      {
        // 🔥 QUAN TRỌNG: Dùng trackId làm jobId để tránh trùng lặp job
        jobId: `retry-${track._id}-${Date.now()}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true, // Xóa ngay khi xong để tiết kiệm RAM Redis
        removeOnFail: { count: 10 }, // Chỉ giữ lại 10 bản ghi lỗi gần nhất
      },
    );
    // Sau khi đẩy vào Queue thành công
    await cacheRedis.del(`track:detail:${trackId}`);
    return track;
  }

  /**
   * 7. BULK UPDATE (Transaction Required)
   */
  async bulkUpdateTracks(
    currentUser: IUser,
    trackIds: string[],
    updates: BulkUpdateTrackInput["updates"],
  ) {
    if (currentUser.role !== "admin") {
      const count = await Track.countDocuments({
        _id: { $in: trackIds },
        uploader: currentUser._id,
      });
      if (count !== trackIds.length)
        throw new ApiError(httpStatus.FORBIDDEN, "Từ chối quyền truy cập");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Album Sync Logic for Bulk
      if (updates.albumId !== undefined) {
        const tracks = await Track.find({ _id: { $in: trackIds } })
          .select("album duration")
          .session(session);
        for (const t of tracks) {
          if (t.album)
            await Album.findByIdAndUpdate(t.album, {
              $inc: { totalTracks: -1, totalDuration: -(t.duration || 0) },
            }).session(session);
        }
        if (updates.albumId) {
          const totalDuration = tracks.reduce(
            (sum, t) => sum + (t.duration || 0),
            0,
          );
          await Album.findByIdAndUpdate(updates.albumId, {
            $inc: { totalTracks: trackIds.length, totalDuration },
          }).session(session);
        }
      }

      const updatePayload: any = {};
      if (updates.albumId !== undefined)
        updatePayload.album = updates.albumId || null;
      if (updates.status) updatePayload.status = updates.status;
      if (updates.isPublic !== undefined)
        updatePayload.isPublic = updates.isPublic;

      const result = await Track.updateMany(
        { _id: { $in: trackIds } },
        { $set: updatePayload },
        { session },
      );
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }
  /**
   * 8. CHANGE TRACK STATUS (Transaction Required)
   */
  async changeTrackStatus(trackId: string, newStatus: ChangeStatusInput) {
    const track = await Track.findById(trackId);
    if (!track) {
      throw new ApiError(httpStatus.NOT_FOUND, "Track not found");
    }

    track.status = newStatus.status;
    await track.save();
    return track;
  }
  /**
   * 9. RECORD TRACK VIEW (Transaction Required)
   */
  async recordTrackView(trackId: string, userId?: string, userIp?: string) {
    try {
      // 1. Anti-Spam: 1 User/IP - 1 Bài - 1 View trong 10 phút
      const spamKey = `limit:view:${trackId}:${userId || userIp}`;
      const isSpam = await cacheRedis.get(spamKey);

      if (isSpam) {
        return { status: "ignored", reason: "spam_limit" };
      }

      // 2. Đánh dấu đã đếm view (Hết hạn sau 10 phút)
      await cacheRedis.set(spamKey, "1", "EX", 600);

      // 3. Tăng buffer trong Redis cho Cron Job quét (track:views:ID)
      const viewKey = `track:views:${trackId}`;
      await cacheRedis.incr(viewKey);

      // 4. Đẩy vào Queue để ghi Log chi tiết (Async)
      // Dùng job name chuẩn để Worker dễ filter
      await viewQueue.add(
        "log-listen-history",
        {
          trackId,
          userId,
          ip: userIp,
          timestamp: new Date(),
        },
        {
          // Option thêm: tự xóa job khi hoàn thành để đỡ tốn ram Redis
          removeOnComplete: true,
        },
      );

      return { status: "success" };
    } catch (error) {
      // Log lỗi nhưng không quăng lỗi ra ngoài làm sập request của user
      // Vì đếm view là tính năng phụ, không nên làm user không nghe được nhạc
      console.error("❌ [Service Error] recordTrackView:", error);
      return { status: "error", message: "Ghi nhận view thất bại" };
    }
  }
}

export default new TrackService();
