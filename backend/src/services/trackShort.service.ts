import mongoose from "mongoose";
import TrackShort, { ITrackShort } from "../models/TrackShort";
import Track from "../models/Track";
import TrackMoodVideo from "../models/TrackMoodVideo";
import Like from "../models/Like";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import { rememberJson, invalidateCachePrefixes } from "../utils/cacheHelper";
import { cacheRedis } from "../config/redis";

type Actor = { id: string; role?: string };

const trackPopulate = {
  path: "track",
  select: "title slug coverImage hlsUrl trackUrl artist duration isExplicit status isDeleted",
  populate: { path: "artist", select: "name slug avatar" },
};

function isAdmin(actor?: Actor) {
  return actor?.role === "admin";
}

function encodeFeedCursor(doc: { priority?: number; createdAt?: Date; _id: unknown }) {
  const priority = doc.priority ?? 0;
  const createdAt = doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date(0).toISOString();
  return `${priority}|${createdAt}|${String(doc._id)}`;
}

function decodeFeedCursor(cursor?: string) {
  if (!cursor) return null;
  const [priorityRaw, createdAtRaw, id] = cursor.split("|");
  if (!id || !mongoose.Types.ObjectId.isValid(id) || !createdAtRaw) return null;
  const createdAt = new Date(createdAtRaw);
  if (Number.isNaN(createdAt.getTime())) return null;
  return {
    priority: Number(priorityRaw) || 0,
    createdAt,
    id: new mongoose.Types.ObjectId(id),
  };
}

class TrackShortService {
  private async assertPlayableWindow(
    trackId: unknown,
    startTime?: number,
    endTime?: number,
  ) {
    const track = await Track.findById(trackId).select("+isDeleted");
    if (!track || track.isDeleted) {
      throw new ApiError(httpStatus.NOT_FOUND, "Track not found");
    }
    if (track.status !== "ready") {
      throw new ApiError(httpStatus.BAD_REQUEST, "Track is not ready");
    }
    if (startTime !== undefined && endTime !== undefined && track.duration) {
      if (startTime >= track.duration || endTime > track.duration + 0.5) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Highlight is outside the track duration");
      }
    }
    return track;
  }

  async createShort(data: Partial<ITrackShort>, actor: Actor): Promise<ITrackShort> {
    await this.assertPlayableWindow(data.track, data.startTime, data.endTime);

    if (data.moodVideo) {
      const moodVideo = await TrackMoodVideo.findById(data.moodVideo);
      if (!moodVideo) {
        throw new ApiError(httpStatus.NOT_FOUND, "Mood video not found");
      }
    }

    const short = await TrackShort.create({
      ...data,
      createdBy: actor.id,
      isPublished: false,
      moderationStatus: "pending",
      rejectionReason: undefined,
    });
    invalidateCachePrefixes(["short:feed:*"]);
    return short.populate(["track", "moodVideo", "createdBy"]);
  }

  async updateShort(id: string, data: Partial<ITrackShort>, actor: Actor): Promise<ITrackShort> {
    const existing = await TrackShort.findById(id);
    if (!existing) {
      throw new ApiError(httpStatus.NOT_FOUND, "TrackShort not found");
    }

    const ownerId = existing.createdBy?.toString();
    const owner = ownerId === actor.id;
    if (!isAdmin(actor) && !owner) {
      throw new ApiError(httpStatus.FORBIDDEN, "No permission to edit this short");
    }
    if (!isAdmin(actor) && !["pending", "rejected"].includes(existing.moderationStatus)) {
      throw new ApiError(httpStatus.FORBIDDEN, "Approved shorts can only be edited by an admin");
    }

    const nextTrack = data.track ?? existing.track;
    const nextStart = data.startTime ?? existing.startTime;
    const nextEnd = data.endTime ?? existing.endTime;
    await this.assertPlayableWindow(nextTrack, nextStart, nextEnd);

    if (data.moodVideo) {
      const moodVideo = await TrackMoodVideo.findById(data.moodVideo);
      if (!moodVideo) {
        throw new ApiError(httpStatus.NOT_FOUND, "Mood video not found");
      }
    }

    const patch: Partial<ITrackShort> = { ...data };
    if (!isAdmin(actor)) {
      delete patch.isPublished;
      delete patch.priority;
      delete patch.moderationStatus;
      patch.isPublished = false;
      patch.moderationStatus = "pending";
      patch.rejectionReason = "";
    }

    const short = await TrackShort.findByIdAndUpdate(id, patch, { new: true, runValidators: true })
      .populate(["track", "moodVideo", "createdBy"]);
    if (!short) {
      throw new ApiError(httpStatus.NOT_FOUND, "TrackShort not found");
    }
    invalidateCachePrefixes(["short:feed:*"]);
    return short;
  }

  async deleteShort(id: string, actor: Actor): Promise<void> {
    const existing = await TrackShort.findById(id);
    if (!existing) {
      throw new ApiError(httpStatus.NOT_FOUND, "TrackShort not found");
    }
    const owner = existing.createdBy?.toString() === actor.id;
    if (!isAdmin(actor) && !owner) {
      throw new ApiError(httpStatus.FORBIDDEN, "No permission to delete this short");
    }
    if (!isAdmin(actor) && !["pending", "rejected"].includes(existing.moderationStatus)) {
      throw new ApiError(httpStatus.FORBIDDEN, "Approved shorts can only be deleted by an admin");
    }
    await existing.deleteOne();
    invalidateCachePrefixes(["short:feed:*"]);
  }

  async getShortById(id: string): Promise<ITrackShort> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(httpStatus.NOT_FOUND, "TrackShort not found");
    }
    const short = await TrackShort.findById(id).populate([trackPopulate, { path: "moodVideo" }]);
    if (!short) {
      throw new ApiError(httpStatus.NOT_FOUND, "TrackShort not found");
    }
    const track = short.track as { status?: string; isDeleted?: boolean } | null;
    const approved = short.moderationStatus === "approved" || short.moderationStatus == null;
    if (!short.isPublished || !approved || !track || track.status !== "ready" || track.isDeleted) {
      throw new ApiError(httpStatus.NOT_FOUND, "TrackShort not found");
    }
    return short;
  }

  async getMyShorts(userId: string, filters: { page?: number; limit?: number } = {}) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(filters.limit) || 20));
    const query = { createdBy: userId };
    const [data, total] = await Promise.all([
      TrackShort.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate(["track", "moodVideo"]),
      TrackShort.countDocuments(query),
    ]);
    return { data, total };
  }

  async getAllShorts(filters: Record<string, unknown> = {}): Promise<{ data: ITrackShort[]; total: number }> {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;
    const query: Record<string, unknown> = {};

    if (filters.trackId) query.track = filters.trackId;
    if (filters.moderationStatus) query.moderationStatus = filters.moderationStatus;
    if (filters.isPublished === "true" || filters.isPublished === true) query.isPublished = true;
    if (filters.isPublished === "false" || filters.isPublished === false) query.isPublished = false;

    if (typeof filters.search === "string" && filters.search.trim()) {
      const search = filters.search.trim();
      const regex = { $regex: search, $options: "i" };
      const tracks = await Track.find({ title: regex }).select("_id").limit(50);
      query.$or = [
        { title: regex },
        { caption: regex },
        { track: { $in: tracks.map((track) => track._id) } },
      ];
    }

    const [data, total] = await Promise.all([
      TrackShort.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate(["track", "moodVideo", "createdBy"]),
      TrackShort.countDocuments(query),
    ]);

    return { data, total };
  }

  async listPublished(filters: { page?: number; limit?: number; search?: string } = {}) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(filters.limit) || 20));
    const readyTrackIds = await Track.find({ status: "ready", isDeleted: { $ne: true } }).distinct("_id");
    const query: Record<string, unknown> = {
      isPublished: true,
      track: { $in: readyTrackIds },
      $or: [
        { moderationStatus: "approved" },
        { moderationStatus: { $exists: false } },
        { moderationStatus: null },
      ],
    };
    if (filters.search?.trim()) {
      const regex = { $regex: filters.search.trim(), $options: "i" };
      const tracks = await Track.find({ title: regex }).select("_id").limit(30);
      query.$and = [
        {
          $or: [
            { title: regex },
            { caption: regex },
            { track: { $in: tracks.map((track) => track._id) } },
          ],
        },
      ];
    }
    const [data, total] = await Promise.all([
      TrackShort.find(query)
        .sort({ priority: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate([trackPopulate, { path: "moodVideo", select: "videoUrl thumbnailUrl" }]),
      TrackShort.countDocuments(query),
    ]);
    return { data, total };
  }

  async getShortsFeed(
    limit: number = 10,
    cursor?: string,
  ): Promise<{ feed: ITrackShort[]; nextCursor: string | null }> {
    const cacheKey = `short:feed:${Number(limit)}:${cursor ?? "start"}`;
    return rememberJson(cacheKey, 60, () => this.loadShortsFeed(limit, cursor));
  }

  private async loadShortsFeed(
    limit: number = 10,
    cursor?: string,
  ): Promise<{ feed: ITrackShort[]; nextCursor: string | null }> {
    const readyTrackIds = await Track.find({
      status: "ready",
      isDeleted: { $ne: true },
    }).distinct("_id");

    const visible: Record<string, unknown> = {
      isPublished: true,
      track: { $in: readyTrackIds },
      $or: [
        { moderationStatus: "approved" },
        { moderationStatus: { $exists: false } },
        { moderationStatus: null },
      ],
    };

    const parsed = decodeFeedCursor(cursor);
    const query: Record<string, unknown> = parsed
      ? {
          $and: [
            visible,
            {
              $or: [
                { priority: { $lt: parsed.priority } },
                { priority: parsed.priority, createdAt: { $lt: parsed.createdAt } },
                {
                  priority: parsed.priority,
                  createdAt: parsed.createdAt,
                  _id: { $lt: parsed.id },
                },
              ],
            },
          ],
        }
      : visible;

    const shorts = await TrackShort.find(query)
      .sort({ priority: -1, createdAt: -1, _id: -1 })
      .limit(Number(limit))
      .populate([
        {
          path: "track",
          select: "title slug coverImage hlsUrl trackUrl artist duration isExplicit",
          populate: { path: "artist", select: "name slug avatar" },
        },
        {
          path: "moodVideo",
          select: "videoUrl thumbnailUrl",
        },
      ])
      .lean();

    const nextCursor =
      shorts.length === Number(limit) ? encodeFeedCursor(shorts[shorts.length - 1]) : null;

    return { feed: shorts as unknown as ITrackShort[], nextCursor };
  }

  async togglePublish(id: string, isPublished: boolean): Promise<ITrackShort> {
    const patch: Record<string, unknown> = { isPublished };
    if (isPublished) {
      patch.moderationStatus = "approved";
      patch.rejectionReason = "";
    }
    const short = await TrackShort.findByIdAndUpdate(id, patch, { new: true }).populate([
      "track",
      "moodVideo",
    ]);

    if (!short) {
      throw new ApiError(httpStatus.NOT_FOUND, "TrackShort not found");
    }
    invalidateCachePrefixes(["short:feed:*"]);
    return short;
  }

  async rejectShort(id: string, reason?: string): Promise<ITrackShort> {
    const short = await TrackShort.findByIdAndUpdate(
      id,
      {
        isPublished: false,
        moderationStatus: "rejected",
        rejectionReason: reason ?? "",
      },
      { new: true },
    ).populate(["track", "moodVideo"]);
    if (!short) {
      throw new ApiError(httpStatus.NOT_FOUND, "TrackShort not found");
    }
    invalidateCachePrefixes(["short:feed:*"]);
    return short;
  }

  async incrementView(id: string, identity: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(id)) return;
    const spamKey = `limit:play:short:${id}:${identity}`;
    if (await cacheRedis.get(spamKey)) return;

    const updated = await TrackShort.findOneAndUpdate(
      {
        _id: id,
        isPublished: true,
        $or: [
          { moderationStatus: "approved" },
          { moderationStatus: { $exists: false } },
          { moderationStatus: null },
        ],
      },
      { $inc: { viewCount: 1 } },
    );
    if (!updated) return;
    await cacheRedis.set(spamKey, "1", "EX", 600);
  }

  async toggleLike(userId: string, id: string): Promise<{ likeCount: number; liked: boolean }> {
    const short = await TrackShort.findById(id);
    if (!short || !short.isPublished) {
      throw new ApiError(httpStatus.NOT_FOUND, "TrackShort not found");
    }

    const filter = { userId, targetId: id, targetType: "short" as const };
    const existing = await Like.findOne(filter);
    if (existing) {
      const deleted = await Like.deleteOne({ _id: existing._id });
      if (deleted.deletedCount > 0) {
        const updated = await TrackShort.findOneAndUpdate(
          { _id: id, likeCount: { $gt: 0 } },
          { $inc: { likeCount: -1 } },
          { new: true },
        );
        return { likeCount: updated?.likeCount ?? short.likeCount, liked: false };
      }
    }

    try {
      await Like.create(filter);
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 11000) {
        const current = await TrackShort.findById(id);
        return { likeCount: current?.likeCount ?? short.likeCount, liked: true };
      }
      throw err;
    }

    const updated = await TrackShort.findByIdAndUpdate(id, { $inc: { likeCount: 1 } }, { new: true });
    return { likeCount: updated?.likeCount ?? short.likeCount + 1, liked: true };
  }

  async recordShare(id: string): Promise<void> {
    await TrackShort.findOneAndUpdate(
      { _id: id, isPublished: true },
      { $inc: { shareCount: 1 } },
    );
  }
}

export default new TrackShortService();
