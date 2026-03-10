import httpStatus from "http-status";
import mongoose, { Types } from "mongoose";
import Track, { ITrack } from "../models/Track";
import User, { IUser } from "../models/User";
import Artist from "../models/Artist";
import Album from "../models/Album";
import Genre from "../models/Genre";
import ApiError from "../utils/ApiError";
import { addTranscodeJob, audioQueue } from "../queue/producer";
import { generateUniqueSlug } from "../utils/slug";
import {
  BulkUpdateTrackInput,
  ChangeStatusInput,
  CreateTrackInput,
  TrackFilterInput,
  UpdateTrackInput,
} from "../validations/track.validation";
import { deleteFolderFromB2, deleteFromB2 } from "../utils/fileCleanup";

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
   * 1. CREATE TRACK (Transaction + Atomic Cleanup)
   */
  async createTrack(
    currentUser: IUser,
    data: CreateTrackInput,
    files: { [fieldname: string]: Express.Multer.File[] },
  ): Promise<ITrack> {
    // A. Permission & Artist Check
    let targetArtistId: Types.ObjectId;
    if (currentUser.role === "admin") {
      if (!data.artistId)
        throw new ApiError(httpStatus.BAD_REQUEST, "Admin phải chọn Artist");
      targetArtistId = new Types.ObjectId(data.artistId);
    } else {
      const artist = await Artist.findOne({ user: currentUser._id }).lean();
      if (!artist)
        throw new ApiError(httpStatus.FORBIDDEN, "Bạn chưa có Profile Nghệ sĩ");
      targetArtistId = artist._id as Types.ObjectId;
    }

    const audioFile = files["audio"]?.[0] as MulterS3File;
    if (!audioFile)
      throw new ApiError(httpStatus.BAD_REQUEST, "Thiếu file Audio");

    // Kiểm tra nếu location chỉ là path tương đối thì ghép thêm Domain
    const formatUrl = (location: string, key: string) => {
      if (location.startsWith("http")) return location;
      const endpoint = process.env.B2_ENDPOINT?.replace(/\/$/, ""); // Loại bỏ / cuối
      const bucket = process.env.B2_BUCKET_NAME;
      // Ghép: https://f004.backblazeb2.com/file/tvp-music-hls/tracks/abc...
      return `${endpoint}/${bucket}/${key}`;
    };
    const fullTrackUrl = formatUrl(audioFile.location, audioFile.key);
    // B. Prepare Data
    const duration = Number(data.duration) || 0;
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
      // C. Create Record (Sử dụng new Track().save() để tránh lỗi TS Overload)
      const track = new Track({
        ...data,
        slug: seoSlug,
        artist: targetArtistId,
        uploader: currentUser._id,
        trackUrl: fullTrackUrl,
        coverImage: coverImageUrl,
        duration,
        fileSize: audioFile.size,
        format: audioFile.mimetype.split("/")[1] || "mp3",
        status: "pending",
        isPublic: String(data.isPublic) === "true",
        isExplicit: String(data.isExplicit) === "true",
        playCount: 0,
        likeCount: 0,
      });

      await track.save({ session });

      // D. Update Counters (Atomic)
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

      // E. Queue (Background)
      addTranscodeJob({
        trackId: track._id.toString(),
        fileUrl: track.trackUrl,
        duration,
      }).catch((err) => console.error("❌ Add Queue Failed:", err));

      return track;
    } catch (error) {
      await session.abortTransaction();
      // Rollback files ngay lập tức nếu DB lỗi
      if (audioFile.key) deleteFromB2(audioFile.key).catch(console.error);
      if (coverFileKey) deleteFromB2(coverFileKey).catch(console.error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * 2. UPDATE TRACK (Safe Lifecycle & Folder Sync)
   */
  async updateTrack(
    trackId: string,
    currentUser: IUser,
    data: UpdateTrackInput,
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

      // Metadata & Slug Sync
      if (data.title && data.title !== track.title) {
        track.title = data.title;
        track.slug = await generateUniqueSlug(Track, data.title, track._id);
      }

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

      const newDuration = data.duration ? Number(data.duration) : oldDuration;
      track.duration = newDuration;

      // Genre Counter Sync
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

      // Album Counter Sync
      if (data.albumId !== undefined) {
        const newAlbumId = data.albumId === "" ? null : data.albumId;
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

      // Media Replacement
      if (audioFile) {
        oldTrackFolder = this.getTrackFolderKey(track.trackUrl);
        isAudioChanged = true;
        track.trackUrl = audioFile.location;
        track.status = "pending";
        track.hlsUrl = "";
        track.fileSize = audioFile.size;
        track.format = audioFile.mimetype.split("/")[1] || "mp3";
      }

      if (coverFile) {
        if (track.coverImage) {
          if (track.coverImage.includes("cloudinary")) {
            const publicId = track.coverImage.split("/").pop()?.split(".")[0];
            if (publicId)
              coverToCleanup = { type: "cloudinary", key: publicId };
          } else {
            const key = this.getB2KeyFromUrl(track.coverImage);
            if (key) coverToCleanup = { type: "s3", key };
          }
        }
        track.coverImage = coverFile.location;
      }

      await track.save({ session });
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      for (const key of filesToRollback) deleteFromB2(key).catch(console.error);
      throw error;
    } finally {
      await session.endSession();
    }

    // Hậu kỳ (Dọn rác & Re-queue)
    if (isAudioChanged && oldTrackFolder) {
      deleteFolderFromB2(oldTrackFolder).catch(console.error);
    } else if (coverToCleanup && coverToCleanup.type === "s3") {
      deleteFromB2(coverToCleanup.key).catch(console.error);
    }

    if (isAudioChanged) {
      addTranscodeJob({
        trackId: track._id.toString(),
        fileUrl: track.trackUrl,
        duration: track.duration,
      }).catch((err) => console.error("❌ Add Queue Failed:", err));
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
    const query: any = { isDeleted: false };

    if (currentUser?.role !== "admin") {
      query.$or = [
        { isPublic: true, status: "ready" },
        ...(currentUser ? [{ uploader: currentUser._id }] : []),
      ];
    }

    if (status) query.status = status;
    if (keyword) {
      const safeKeyword = keyword.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      query.$or = [
        { title: { $regex: safeKeyword, $options: "i" } },
        { tags: { $regex: safeKeyword, $options: "i" } },
      ];
    }

    if (artistId) query.artist = artistId;
    if (albumId) query.album = albumId;
    if (genreId) query.genres = genreId;

    let sortOption: any = { createdAt: -1 };
    if (sort === "oldest") sortOption = { createdAt: 1 };
    if (sort === "popular") sortOption = { playCount: -1 };
    if (sort === "name") sortOption = { title: 1 };

    const [tracksDocs, total] = await Promise.all([
      Track.find(query)
        .populate("artist", "name avatar slug")
        .populate("album", "title coverImage slug")
        .populate("genres", "name slug color")
        .select("-lyrics -description")
        .sort(sortOption)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Track.countDocuments(query),
    ]);

    const likedSet = new Set<string>();
    if (currentUser) {
      const user = await User.findById(currentUser._id)
        .select("likedTracks")
        .lean();
      user?.likedTracks?.forEach((id) => likedSet.add(id.toString()));
    }

    return {
      data: tracksDocs.map((t) => ({
        ...t,
        isLiked: likedSet.has(t._id.toString()),
      })),
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

    let isLiked = false;
    if (currentUser) {
      const user = await User.findById(currentUser._id)
        .select("likedTracks")
        .lean();
      isLiked =
        user?.likedTracks?.some(
          (id) => id.toString() === track._id.toString(),
        ) || false;
    }

    return { ...track, isLiked };
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
        duration: track.duration,
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
}

export default new TrackService();
