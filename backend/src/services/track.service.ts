// ─────────────────────────────────────────────────────────────────────────────
// services/track.service.ts
// ─────────────────────────────────────────────────────────────────────────────
import httpStatus from "http-status";
import mongoose, { Types } from "mongoose";
import Track, { ITrack } from "../models/Track";
import { IUser } from "../models/User";
import Artist from "../models/Artist";
import Album from "../models/Album";
import Genre from "../models/Genre";
import Follow from "../models/Follow";
import TrackMoodVideo from "../models/TrackMoodVideo";
import ApiError from "../utils/ApiError";
import { generateUniqueSlug } from "../utils/slug";
import {
  BulkUpdateTrackInput,
  ChangeStatusInput,
  TrackFilterInput,
} from "../validations/track.validation";
import { deleteFolderFromB2, deleteFromB2 } from "../utils/fileCleanup";
import { cacheRedis } from "../config/redis";
import { notifyQueue } from "../queue/notify.queue";
import { viewQueue } from "../queue/view.queue";
import { CreateTrackDTO, UpdateTrackDTO } from "../dtos/track.dto";
import { CounterTrack } from "../utils/counter";

// ── Job orchestration — chỉ import từ đây, không import audioQueue trực tiếp
import {
  processNewTrack,
  retryTranscode as jobRetryTranscode,
  retryLyrics as jobRetryLyrics,
  retryKaraoke as jobRetryKaraoke,
  retryMoodCanvas as jobRetryMoodCanvas,
  retryFullPipeline,
} from "./Track job.service";
import {
  buildCacheKey,
  invalidateArtistCache,
  invalidateTrackCache,
  invalidateTracksCache,
  withCacheTimeout,
} from "../utils/cacheHelper";
import recommendationService from "./recommendation.service";
import { parseGenreIds } from "../utils/helper";
import { is } from "zod/v4/locales";
import { APP_CONFIG, TRACK_POPULATE, TRACK_SELECT } from "../config/constants";

type MulterS3File = Express.Multer.File & { location: string; key: string };

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const SOFT_DELETE_GRACE_SECONDS = 30 * 24 * 60 * 60; // 30 ngày
const DELETED_TRACKS_SET = "cleanup:deleted_tracks";

// ─────────────────────────────────────────────────────────────────────────────
// CLASS: TrackService
// Responsibilities:
// - CRUD for Track documents
// - Maintain counters (Artist, Genre, Album)
// - Cache invalidation and background job orchestration (transcode/lyrics/mood)
// - Safe transactional updates and non-blocking post-commit side-effects
// ─────────────────────────────────────────────────────────────────────────────

class TrackService {
  // ── PRIVATE HELPERS ────────────────────────────────────────────────────────

  /** Extract B2 object key from a full URL (returns null if not matching bucket) */
  private getB2KeyFromUrl(url: string): string | null {
    const bucket = process.env.B2_BUCKET_NAME;
    if (!url || !bucket || !url.includes(bucket)) return null;
    const parts = url.split(`${bucket}/`);
    return parts.length > 1 ? parts[1] : null;
  }

  /** Derive folder key used by B2 cleanup from a resource URL (e.g. tracks/slug) */
  private getTrackFolderKey(url: string): string | null {
    const fileKey = this.getB2KeyFromUrl(url);
    if (!fileKey) return null;
    const parts = fileKey.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  }

  // ── 1. CREATE TRACK ────────────────────────────────────────────────────────

  /**
   * Create a new track and related counters inside a DB transaction.
   * Post-commit tasks (non-blocking): counter increment, cache invalidation,
   * enqueue processing job, optionally notify followers.
   */
  async createTrack(
    currentUser: IUser,
    data: CreateTrackDTO,
    files: { [fieldname: string]: Express.Multer.File[] },
  ): Promise<ITrack> {
    // ── Artist resolution ────────────────────────────────────────────────────
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
    const slug = await generateUniqueSlug(Track, data.title);
    // ── File handling ────────────────────────────────────────────────────────
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
    let featuringArtists: Types.ObjectId[] = [];
    if (data.featuringArtistIds) {
      featuringArtists = parseGenreIds(data.featuringArtistIds);
    }
    let genres: Types.ObjectId[] = [];
    if (data.genreIds) {
      genres = parseGenreIds(data.genreIds);
    }
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const track = new Track({
        ...data,
        featuringArtists,
        genres,
        slug,
        artist: targetArtistId,
        uploader: currentUser._id,
        trackUrl: fullTrackUrl,
        coverImage: coverImageUrl,
        moodVideo: data.moodVideoId
          ? new Types.ObjectId(data.moodVideoId)
          : null,

        duration,
        fileSize: audioFile.size, // file gốc; HLS size cộng thêm sau transcode
        format: audioFile.mimetype.split("/")[1] || "mp3",
        status: "pending",
        isPublic: String(data.isPublic) === "true",
        isExplicit: String(data.isExplicit) === "true",
        playCount: 0,
        likeCount: 0,
      });

      await track.save({ session });

      // 3. Update Stats (Đã bọc session)
      await Promise.all([
        Artist.findByIdAndUpdate(
          targetArtistId,
          { $inc: { totalTracks: 1 } },
          { session },
        ),
        featuringArtists.length > 0
          ? Artist.updateMany(
              { _id: { $in: featuringArtists } },
              { $inc: { totalTracks: 1 } }, // Hoặc totalFeats: 1 nếu bạn muốn tách biệt
              { session },
            )
          : Promise.resolve(),
        data.genreIds?.length
          ? Genre.updateMany(
              { _id: { $in: data.genreIds } },
              { $inc: { trackCount: 1 } },
              { session },
            )
          : Promise.resolve(),
        data.albumId
          ? Album.findByIdAndUpdate(
              data.albumId,
              { $inc: { totalTracks: 1, totalDuration: duration } },
              { session },
            )
          : Promise.resolve(),
      ]);

      await session.commitTransaction();

      // ── Post-commit (non-fatal) ───────────────────────────────────────────
      this.handlePostTrackCreation(track, audioFile, targetArtistName).catch(
        console.error,
      );

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
  /** Non-blocking tasks after track creation: counters, cache, processing, notifications */
  private async handlePostTrackCreation(
    track: ITrack,
    audioFile: MulterS3File,
    artistName: string,
  ) {
    const tasks: Promise<any>[] = [
      CounterTrack.increment(audioFile.size, audioFile.mimetype),
      invalidateTrackCache(track._id.toString()),
      processNewTrack(track._id.toString(), track.trackUrl),
    ];

    // Push notification to followers only for public releases
    // try {
    //   if ((track as any).isPublic) {
    //     tasks.push(this.pushNewTrackNotification(track, artistName));
    //   }
    // } catch (err) {
    //   // Non-fatal — continue
    //   console.warn("[PostTrack] push notification skipped:", err ?? err);
    // }

    await Promise.allSettled(tasks);
  }
  // ── 2. UPDATE TRACK ────────────────────────────────────────────────────────

  /**
   * Update track metadata and media replacements.
   * - Writes within a DB transaction to keep counters consistent.
   * - After commit: invalidate caches, enqueue re-processing if audio changed,
   *   and perform non-blocking file cleanup.
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

    const filesToRollback: string[] = [];
    let oldTrackFolder: string | null = null;
    let coverToCleanup: string | null = null;
    let isAudioChanged = false;
    const oldAudioSize = track.fileSize ?? 0;

    const audioFile = files["audio"]?.[0] as MulterS3File | undefined;
    const coverFile = files["coverImage"]?.[0] as MulterS3File | undefined;

    if (audioFile) filesToRollback.push(audioFile.key);
    if (coverFile) filesToRollback.push(coverFile.key);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const oldAlbumId = track.album?.toString();
      const oldDuration = track.duration || 0;
      const oldArtistId = track.artist.toString();
      const oldFeaturingIds = track.featuringArtists.map((id) => id.toString());
      const oldGenreIdsStr = track.genres.map((g) => g.toString());

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

      if (data.moodVideoId !== undefined) {
        track.moodVideo =
          !data.moodVideoId || data.moodVideoId === "null"
            ? undefined
            : new Types.ObjectId(data.moodVideoId as string);
      }

      const newDuration = data.duration ? Number(data.duration) : oldDuration;
      track.duration = newDuration;

      // 2. Sync Counters (Artists, Genre, Album)
      // --- Artist Sync (Primary + Featuring) ---
      if (data.artistId || data.featuringArtistIds) {
        const newArtistId = data.artistId || oldArtistId;
        const newFeaturingIds = data.featuringArtistIds || oldFeaturingIds;

        // Tránh double-count: Nếu artist chính nằm trong featuring, loại bỏ khỏi featuring
        const cleanFeaturing = newFeaturingIds.filter(
          (id) => id !== newArtistId,
        );

        // Sync Primary
        if (newArtistId !== oldArtistId) {
          await Artist.findByIdAndUpdate(
            oldArtistId,
            { $inc: { totalTracks: -1 } },
            { session },
          );
          await Artist.findByIdAndUpdate(
            newArtistId,
            { $inc: { totalTracks: 1 } },
            { session },
          );
          track.artist = new Types.ObjectId(newArtistId);
        }

        // Sync Featuring (Diffing)
        const addedFeat = cleanFeaturing.filter(
          (id) => !oldFeaturingIds.includes(id),
        );
        const removedFeat = oldFeaturingIds.filter(
          (id) => !cleanFeaturing.includes(id),
        );

        if (addedFeat.length)
          await Artist.updateMany(
            { _id: { $in: addedFeat } },
            { $inc: { totalTracks: 1 } },
            { session },
          );
        if (removedFeat.length)
          await Artist.updateMany(
            { _id: { $in: removedFeat }, totalTracks: { $gt: 0 } },
            { $inc: { totalTracks: -1 } },
            { session },
          );

        track.featuringArtists = cleanFeaturing.map(
          (id) => new Types.ObjectId(id),
        );

        // Invalidate
        invalidateArtistCache(oldArtistId);
        invalidateArtistCache(newArtistId);
      }
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
            { session },
          );
        if (removed.length)
          await Genre.updateMany(
            { _id: { $in: removed }, trackCount: { $gt: 0 } },
            { $inc: { trackCount: -1 } },
            { session },
          );

        track.genres = data.genreIds.map((id) => new Types.ObjectId(id));
      }
      // Album counter sync
      if (data.albumId !== undefined) {
        const newAlbumId =
          data.albumId === "" || data.albumId === "null" ? null : data.albumId;

        if (newAlbumId !== oldAlbumId) {
          const albumOps: Promise<any>[] = [];
          if (oldAlbumId) {
            albumOps.push(
              Album.findByIdAndUpdate(
                oldAlbumId,
                { $inc: { totalTracks: -1, totalDuration: -oldDuration } },
                { session },
              ),
            );
          }
          if (newAlbumId) {
            albumOps.push(
              Album.findByIdAndUpdate(
                newAlbumId,
                { $inc: { totalTracks: 1, totalDuration: newDuration } },
                { session },
              ),
            );
            track.album = new Types.ObjectId(newAlbumId);
          } else {
            track.album = null;
          }
          await Promise.all(albumOps);
        } else if (newAlbumId && newDuration !== oldDuration) {
          await Album.findByIdAndUpdate(newAlbumId, {
            $inc: { totalDuration: newDuration - oldDuration },
          }).session(session);
        }
      }

      // Audio replacement
      if (audioFile) {
        oldTrackFolder = this.getTrackFolderKey(track.trackUrl);
        isAudioChanged = true;
        track.trackUrl = audioFile.location;
        track.status = "pending";
        track.hlsUrl = "";
        track.lyricType = "none";
        track.lyricUrl = undefined;
        track.plainLyrics = "";
        track.fileSize = audioFile.size;
        track.format = audioFile.mimetype.split("/")[1] || "mp3";
      }

      // Cover replacement
      if (coverFile) {
        const key = this.getB2KeyFromUrl(track.coverImage);
        if (key) coverToCleanup = key;
        track.coverImage = coverFile.location;
      }

      await track.save({ session });
      await session.commitTransaction();
      if (data.genreIds || data.artistId) {
        recommendationService.invalidateSimilarCache(trackId);
      }
      // ── Post-commit ───────────────────────────────────────────────────────
      const postCommitTasks: Promise<any>[] = [
        invalidateTrackCache(track._id.toString()),
      ];

      if (isAudioChanged) {
        // Bytes counter: trừ cũ, cộng mới
        const redisPipeline = cacheRedis.pipeline();
        if (oldAudioSize > 0)
          redisPipeline.decrby("stats:storage:audio_bytes", oldAudioSize);
        redisPipeline.incrby("stats:storage:audio_bytes", audioFile!.size);
        postCommitTasks.push(redisPipeline.exec().catch(() => {}));

        // Queue full pipeline cho audio mới
        postCommitTasks.push(
          processNewTrack(track._id.toString(), track.trackUrl),
        );

        // Cleanup folder cũ trên B2
        if (oldTrackFolder) {
          deleteFolderFromB2(oldTrackFolder).catch(console.error);
        }
      }

      if (coverToCleanup) {
        deleteFromB2(coverToCleanup).catch(console.error);
      }

      await Promise.allSettled(postCommitTasks);
    } catch (error) {
      await session.abortTransaction();
      for (const key of filesToRollback) deleteFromB2(key).catch(console.error);
      throw error;
    } finally {
      await session.endSession();
    }

    return track;
  }

  // ── 3. DELETE TRACK (Hard delete) ─────────────────────────────────────────
  /**
   * Permanently delete a track and decrement related counters inside a transaction.
   * Post-commit: attempt to remove associated files from B2 storage.
   */
  async deleteTrack(trackId: string, currentUser: IUser) {
    const track = await Track.findById(trackId);
    if (!track)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy bài hát");

    const isOwner = track.uploader.toString() === currentUser._id.toString();
    if (currentUser.role !== "admin" && !isOwner)
      throw new ApiError(httpStatus.FORBIDDEN, "Không có quyền");

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Trừ thông số trong các bảng liên quan (giữ nguyên logic của bạn)
      await Promise.all([
        Artist.findByIdAndUpdate(
          track.artist,
          { $inc: { totalTracks: -1 } },
          { session },
        ),
        track.genres?.length
          ? Genre.updateMany(
              { _id: { $in: track.genres }, trackCount: { $gt: 0 } },
              { $inc: { trackCount: -1 } },
              { session },
            )
          : null,
        track.album
          ? Album.findByIdAndUpdate(
              track.album,
              {
                $inc: {
                  totalTracks: -1,
                  totalDuration: -(track.duration || 0),
                },
              },
              { session },
            )
          : null,
      ]);

      // 2. Xóa cứng khỏi Database
      await Track.findByIdAndDelete(trackId, { session });

      await session.commitTransaction();

      // 3. Xóa file trên B2 (Post-commit)
      // Lưu ý: folderKey thường được cấu trúc từ trackUrl — dùng helper để trích
      const folderKey = this.getTrackFolderKey(track.trackUrl);
      if (folderKey) await deleteFolderFromB2(folderKey).catch(console.error);

      return true;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  // async deleteTrack(trackId: string, currentUser: IUser) {
  //   const track = await Track.findById(trackId);
  //   if (!track || track.isDeleted)
  //     throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy bài hát");

  //   const isOwner = track.uploader.toString() === currentUser._id.toString();
  //   if (currentUser.role !== "admin" && !isOwner)
  //     throw new ApiError(httpStatus.FORBIDDEN, "Không có quyền");

  //   const session = await mongoose.startSession();
  //   session.startTransaction();

  //   try {
  //     // 1. Transactional Updates
  //     await Promise.all([
  //       Artist.findByIdAndUpdate(track.artist, {
  //         $inc: { totalTracks: -1 },
  //       }).session(session),

  //       track.genres?.length
  //         ? Genre.updateMany(
  //             { _id: { $in: track.genres }, trackCount: { $gt: 0 } }, // Thêm $gt: 0 an toàn
  //             { $inc: { trackCount: -1 } },
  //           ).session(session)
  //         : Promise.resolve(),

  //       track.album
  //         ? Album.findByIdAndUpdate(track.album, {
  //             $inc: { totalTracks: -1, totalDuration: -(track.duration || 0) },
  //           }).session(session)
  //         : Promise.resolve(),

  //       Track.findByIdAndUpdate(
  //         trackId,
  //         { isDeleted: true, status: "failed" },
  //         { session },
  //       ),
  //     ]);

  //     await session.commitTransaction();

  //     // 2. Post-commit: Cleanup & Cache
  //     // Tách riêng để chạy ngầm không chặn response
  //     this.handlePostTrackDeletion(track).catch(console.error);

  //     return true;
  //   } catch (error) {
  //     await session.abortTransaction();
  //     throw error;
  //   } finally {
  //     session.endSession();
  //   }
  // }

  // ── 3B. PHYSICAL CLEANUP (cron job gọi hàng ngày) ─────────────────────────

  async physicalCleanupExpiredTracks(): Promise<number> {
    // Cron helper: remove expired entries from the zset and delete their B2 folders
    const now = Date.now();
    const expired = await cacheRedis.zrangebyscore(
      DELETED_TRACKS_SET,
      "-inf",
      now,
    );
    if (!expired.length) return 0;

    let cleaned = 0;
    for (const raw of expired) {
      try {
        const { trackId, folderKey } = JSON.parse(raw) as {
          trackId: string;
          folderKey: string;
        };

        if (folderKey) await deleteFolderFromB2(folderKey);
        await Track.findByIdAndDelete(trackId);
        await cacheRedis.zrem(DELETED_TRACKS_SET, raw);
        cleaned++;
      } catch (err) {
        console.error("[Cleanup] Failed to clean track:", err);
      }
    }

    console.log(`[Cleanup] Physically deleted ${cleaned} expired tracks`);
    return cleaned;
  }

  // ── 4. GET TRACKS ─────────────────────────────────────────────────────────
  async getTracks(filter: TrackFilterInput, currentUser?: IUser) {
    // 3. BUILD QUERY
    const {
      page = 1,
      limit = APP_CONFIG.PAGINATION_LIMIT,
      keyword,
      artistId,
      albumId,
      genreId,
      isPublic,
      isDeleted,
      status,
      lyricType,
      sort,
    } = filter as any;

    const skip = (Number(page) - 1) * Number(limit);

    const query: any = {};
    const andConditions: any[] = [];

    let useTextScore = false;
    if (keyword) {
      if (!sort) {
        query.$text = { $search: keyword };
        useTextScore = true;
      } else {
        const safe = String(keyword).replace(
          /[-[\]{}()*+?.,\\^$|#\s]/g,
          "\\$&",
        );
        andConditions.push({ title: { $regex: `^${safe}`, $options: "i" } });
      }
    }

    if (andConditions.length > 0) query.$and = andConditions;
    if (status) query.status = status;
    if (lyricType) query.lyricType = lyricType;
    if (isPublic !== undefined)
      query.isPublic = String(isPublic) === "true" ? true : false;
    if (isDeleted !== undefined)
      query.isDeleted = String(isDeleted) === "true" ? true : false;
    if (artistId)
      query.$or = [{ artist: artistId }, { featuringArtists: artistId }];
    if (albumId) query.album = albumId;
    if (genreId) query.genres = genreId;

    // 4. SORT
    let sortOption: any = useTextScore
      ? { score: { $meta: "textScore" }, _id: 1 }
      : { createdAt: -1 };

    if (!useTextScore) {
      if (sort === "newest") sortOption = { createdAt: -1 };
      if (sort === "oldest") sortOption = { createdAt: 1 };
      if (sort === "popular") sortOption = { playCount: -1, _id: 1 };
      if (sort === "name") sortOption = { title: 1, _id: 1 };
      if (sort === "trending")
        sortOption = { likeCount: -1, playCount: -1, _id: 1 };
    }

    // 5. EXECUTE QUERY & POPULATE
    let baseQuery = Track.find(query)
      .populate("artist", "name avatar slug")
      .populate("featuringArtists", "name slug avatar")
      .populate("album", "title coverImage slug")
      .populate("genres", "name slug")
      .populate({
        path: "moodVideo",
        select: "title videoUrl thumbnailUrl slug loop",
        model: "TrackMoodVideo",
      })
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    if (useTextScore) {
      baseQuery = (baseQuery as any).select({ score: { $meta: "textScore" } });
    }

    const [tracksDocs, total] = await Promise.all([
      baseQuery.exec(),
      Track.countDocuments(query),
    ]);

    const result = {
      data: tracksDocs,
      meta: {
        totalItems: total,
        page: Number(page),
        pageSize: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
        hasNextPage: skip + Number(limit) < total,
      },
    };

    return result;
  }

  // ── 5. GET BY ID / SLUG ───────────────────────────────────────────────────

  async getTrackDetail(id: string, currentUser?: IUser) {
    const userRole = currentUser?.role ?? "guest";
    const cacheKey = buildCacheKey(`track:detail:${id}`, userRole, {});
    // 2. KIỂM TRA CACHE
    const cached = await withCacheTimeout(() => cacheRedis.get(cacheKey));
    if (cached) {
      const track = JSON.parse(cached as string);
      // Logic phân quyền sau khi lấy từ Cache (Bảo vệ dữ liệu Private)

      return track;
    }
    const trackDoc = await Track.findOne({
      _id: id,
      
    })
      .populate(TRACK_POPULATE as any)
      .lean();

    if (!trackDoc)
      throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy bài hát");

    // Quyền truy cập: admin hoặc chính uploader có thể xem mọi trạng thái.
    const isAdmin = userRole === "admin";
    const isOwner =
      currentUser && trackDoc.uploader
        ? String(trackDoc.uploader) === String(currentUser._id)
        : false;

    if (!isAdmin && !isOwner) {
      if (
        !(
          trackDoc.isPublic &&
          trackDoc.status === "ready" &&
          !trackDoc.isDeleted
        )
      )
        throw new ApiError(httpStatus.NOT_FOUND, "Không tìm thấy bài hát");
    }

    // Sanitize result: không trả về các trường nội bộ
    const sanitized: any = { ...trackDoc };
    delete sanitized.uploader;
    delete sanitized.status;
    delete sanitized.isPublic;
    delete sanitized.isDeleted;
    delete sanitized.errorReason;

    const ttl = 1800 + Math.floor(Math.random() * 600);
    withCacheTimeout(() =>
      cacheRedis.set(cacheKey, JSON.stringify(sanitized), "EX", ttl),
    ).catch((err) => console.error("[Cache] Set Track Detail Error:", err));

    return sanitized;
  }

  // ── 6. RETRY OPERATIONS ───────────────────────────────────────────────────
  // Lightweight wrappers that validate the track exists then delegate to the
  // Track job service. These methods intentionally do minimal logic so the
  // job orchestration remains centralized in `Track job.service`.

  /** Retry toàn bộ pipeline (xoá HLS + lyrics cũ) */
  async retryFull(trackId: string) {
    const exists = await Track.exists({ _id: trackId });
    if (!exists) throw new ApiError(httpStatus.NOT_FOUND, "Track not found");
    return retryFullPipeline(trackId);
  }

  /** Retry chỉ HLS transcode — lyrics và mood giữ nguyên */
  async retryTranscode(trackId: string) {
    const exists = await Track.exists({ _id: trackId });
    if (!exists) throw new ApiError(httpStatus.NOT_FOUND, "Track not found");
    return jobRetryTranscode(trackId);
  }

  /** Retry lyrics từ đầu (LRCLIB + karaoke fallback chain) */
  async retryLyrics(trackId: string) {
    const exists = await Track.exists({ _id: trackId });
    if (!exists) throw new ApiError(httpStatus.NOT_FOUND, "Track not found");
    return jobRetryLyrics(trackId);
  }

  /** Retry chỉ forced alignment (karaoke) — cần plainLyrics trong DB */
  async retryKaraoke(trackId: string) {
    const exists = await Track.exists({ _id: trackId });
    if (!exists) throw new ApiError(httpStatus.NOT_FOUND, "Track not found");
    return jobRetryKaraoke(trackId);
  }

  /** Retry mood canvas matching (tags thay đổi) */
  async retryMoodCanvas(trackId: string) {
    const exists = await Track.exists({ _id: trackId });
    if (!exists) throw new ApiError(httpStatus.NOT_FOUND, "Track not found");
    return jobRetryMoodCanvas(trackId);
  }

  // ── BULK RETRY HELPERS (Chunked, admin-safe) ───────────────────────────
  private async _chunkAndRun<T extends any>(
    ids: string[],
    handler: (id: string) => Promise<T>,
    chunkSize = 20,
  ) {
    // Process ids in chunks to avoid overwhelming downstream services.
    const results: Array<{ id: string; success: boolean; error?: string }> = [];
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      // Run chunk in parallel, but sequential between chunks
      const promises = chunk.map(async (id) => {
        try {
          await handler.call(this, id);
          return { id, success: true };
        } catch (err: any) {
          return { id, success: false, error: err?.message ?? String(err) };
        }
      });
      const settled = await Promise.all(promises);
      results.push(...settled);
      // optional small delay could be inserted here if needed
    }
    return results;
  }

  /**
   * Ensure the current user is admin or owner (uploader) for all given tracks.
   * Throws `ApiError(403)` on permission mismatch.
   */
  private async _ensureAdminOrOwnerForTracks(
    currentUser: IUser,
    trackIds: string[],
  ) {
    if (currentUser.role === "admin") return;
    const count = await Track.countDocuments({
      _id: { $in: trackIds },
      uploader: currentUser._id,
    });
    if (count !== trackIds.length)
      throw new ApiError(httpStatus.FORBIDDEN, "Từ chối quyền truy cập");
  }

  /** Bulk retry HLS transcode for multiple tracks (chunked) */
  async bulkRetryTranscode(currentUser: IUser, trackIds: string[]) {
    await this._ensureAdminOrOwnerForTracks(currentUser, trackIds);

    const details = await this._chunkAndRun(trackIds, this.retryTranscode);
    const queued = details.filter((d) => d.success).length;
    return {
      requested: trackIds.length,
      queued,
      failed: details.length - queued,
      details,
    };
  }

  /** Bulk retry lyrics (LRCLIB + karaoke) */
  async bulkRetryLyrics(currentUser: IUser, trackIds: string[]) {
    await this._ensureAdminOrOwnerForTracks(currentUser, trackIds);

    const details = await this._chunkAndRun(trackIds, this.retryLyrics);
    const queued = details.filter((d) => d.success).length;
    return {
      requested: trackIds.length,
      queued,
      failed: details.length - queued,
      details,
    };
  }

  /** Bulk retry karaoke (forced alignment) */
  async bulkRetryKaraoke(currentUser: IUser, trackIds: string[]) {
    await this._ensureAdminOrOwnerForTracks(currentUser, trackIds);

    const details = await this._chunkAndRun(trackIds, this.retryKaraoke);
    const queued = details.filter((d) => d.success).length;
    return {
      requested: trackIds.length,
      queued,
      failed: details.length - queued,
      details,
    };
  }

  /** Bulk retry mood canvas matching */
  async bulkRetryMood(currentUser: IUser, trackIds: string[]) {
    await this._ensureAdminOrOwnerForTracks(currentUser, trackIds);

    const details = await this._chunkAndRun(trackIds, this.retryMoodCanvas);
    const queued = details.filter((d) => d.success).length;
    return {
      requested: trackIds.length,
      queued,
      failed: details.length - queued,
      details,
    };
  }

  /** Bulk retry full pipeline (HLS + Lyrics + Mood) */
  async bulkRetryFull(currentUser: IUser, trackIds: string[]) {
    await this._ensureAdminOrOwnerForTracks(currentUser, trackIds);

    const details = await this._chunkAndRun(trackIds, this.retryFull);
    const queued = details.filter((d) => d.success).length;
    return {
      requested: trackIds.length,
      queued,
      failed: details.length - queued,
      details,
    };
  }

  // ── 7. BULK UPDATE ────────────────────────────────────────────────────────

  async bulkUpdateTracks(
    currentUser: IUser,
    trackIds: string[],
    updates: BulkUpdateTrackInput["updates"],
  ) {
    // 1. Phân quyền
    await this._ensureAdminOrOwnerForTracks(currentUser, trackIds);

    // 2. Thu thập dữ liệu TRƯỚC khi Update (để Invalidate cache)
    // Lấy thêm moodVideo + tags để có thể điều chỉnh thống kê hoặc re-calc
    const tracksBefore = await Track.find({ _id: { $in: trackIds } })
      .select("artist album genres duration moodVideo tags")
      .lean();

    if (!tracksBefore.length) return { modifiedCount: 0 };

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 3. Xây dựng Update Payload
      const updatePayload: any = {};
      if (updates.status) updatePayload.status = updates.status;
      if (updates.isPublic !== undefined)
        updatePayload.isPublic = String(updates.isPublic) === "true";

      // Album — giữ nguyên logic cũ
      if (updates.albumId !== undefined) {
        const albumId = updates.albumId;

        if (albumId === "" || albumId === "null" || albumId === null) {
          updatePayload.album = null; // Mongoose tự hiểu null là xóa liên kết
        } else {
          updatePayload.album = new Types.ObjectId(albumId);
        }
      }

      // Mood Video (Canvas) — hỗ trợ gán / gỡ
      if (updates.moodVideoId !== undefined) {
        const mv = updates.moodVideoId;
        if (mv === "" || mv === "null" || mv === null) {
          updatePayload.moodVideo = null;
        } else {
          updatePayload.moodVideo = new Types.ObjectId(mv as string);
        }
      }

      // Tags (ghi đè)
      if (updates.tags !== undefined) {
        updatePayload.tags = updates.tags;
      }

      // Genres (ghi đè)
      if (updates.genreIds !== undefined) {
        updatePayload.genres = (updates.genreIds || []).map(
          (id: string) => new Types.ObjectId(id),
        );
      }

      // 4. Cập nhật Album Counters (BulkWrite tối ưu)
      if (updates.albumId !== undefined) {
        const albumChanges = new Map<
          string,
          { trackDelta: number; durationDelta: number }
        >();
        const totalDuration = tracksBefore.reduce(
          (sum, t) => sum + (t.duration || 0),
          0,
        );

        // Trừ các album cũ
        for (const t of tracksBefore) {
          if (t.album) {
            const id = t.album.toString();
            const curr = albumChanges.get(id) || {
              trackDelta: 0,
              durationDelta: 0,
            };
            albumChanges.set(id, {
              trackDelta: curr.trackDelta - 1,
              durationDelta: curr.durationDelta - (t.duration || 0),
            });
          }
        }
        // Cộng album mới
        if (
          updates.albumId &&
          updates.albumId !== "null" &&
          updates.albumId !== ""
        ) {
          const id = updates.albumId;
          const curr = albumChanges.get(id) || {
            trackDelta: 0,
            durationDelta: 0,
          };
          albumChanges.set(id, {
            trackDelta: curr.trackDelta + trackIds.length,
            durationDelta: curr.durationDelta + totalDuration,
          });
        }

        const bulkOps = Array.from(albumChanges.entries()).map(
          ([id, delta]) => ({
            updateOne: {
              filter: { _id: id },
              update: {
                $inc: {
                  totalTracks: delta.trackDelta,
                  totalDuration: delta.durationDelta,
                },
              },
            },
          }),
        );
        if (bulkOps.length > 0) await Album.bulkWrite(bulkOps, { session });
      }

      // 4b. Genres Counters (Nếu thay đổi thể loại hàng loạt)
      if (updates.genreIds !== undefined) {
        const genreChanges = new Map<string, number>();

        // Trừ các genre cũ (mỗi track trừ 1 cho mỗi genre hiện có)
        for (const t of tracksBefore) {
          if (t.genres && Array.isArray(t.genres)) {
            for (const g of t.genres) {
              const id = g.toString();
              genreChanges.set(id, (genreChanges.get(id) || 0) - 1);
            }
          }
        }

        // Cộng genre mới (mỗi track cộng 1 cho mỗi genre mới)
        if (updates.genreIds && updates.genreIds.length) {
          for (const id of updates.genreIds) {
            genreChanges.set(id, (genreChanges.get(id) || 0) + trackIds.length);
          }
        }

        const genreBulkOps = Array.from(genreChanges.entries()).map(
          ([id, delta]) => ({
            updateOne: {
              filter:
                delta < 0 ? { _id: id, trackCount: { $gt: 0 } } : { _id: id },
              update: { $inc: { trackCount: delta } },
            },
          }),
        );

        if (genreBulkOps.length > 0)
          await Genre.bulkWrite(genreBulkOps, { session });
      }

      // 5. Thực hiện Update Many
      const result = await Track.updateMany(
        { _id: { $in: trackIds } },
        { $set: updatePayload },
        { session },
      );

      await session.commitTransaction();

      const postTasks: Promise<any>[] = [invalidateTracksCache(trackIds)]; // Dọn dẹp cache track chi tiết

      // Nếu có cập nhật moodVideoId, tính lại usage count cho các mood video cũ + mới
      if (updates.moodVideoId !== undefined) {
        const idsToRecalc = new Set<string>();
        for (const t of tracksBefore) {
          if (t && (t as any).moodVideo)
            idsToRecalc.add(String((t as any).moodVideo));
        }
        if (
          updates.moodVideoId &&
          updates.moodVideoId !== "" &&
          updates.moodVideoId !== "null"
        ) {
          idsToRecalc.add(updates.moodVideoId as string);
        }

        for (const id of idsToRecalc) {
          postTasks.push(
            TrackMoodVideo.calculateUsage(id).catch(console.error),
          );
        }
      }

      Promise.allSettled(postTasks);

      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ── 8. CHANGE STATUS ─────────────────────────────────────────────────────

  async changeTrackStatus(trackId: string, newStatus: ChangeStatusInput) {
    const track = await Track.findById(trackId);
    if (!track) throw new ApiError(httpStatus.NOT_FOUND, "Track not found");
    track.status = newStatus.status;
    await track.save();
    await invalidateTrackCache(track._id.toString());
    return track;
  }

  // ── PRIVATE: Fan-out notification ──────────────────────────────────────────

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
        artistName,
        followerIds,
      });
    }
  }
}

export default new TrackService();
