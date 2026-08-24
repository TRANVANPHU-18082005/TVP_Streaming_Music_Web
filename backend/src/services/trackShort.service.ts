import mongoose from "mongoose";
import TrackShort, { ITrackShort } from "../models/TrackShort";
import Track from "../models/Track";
import TrackMoodVideo from "../models/TrackMoodVideo";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";

class TrackShortService {
  async createShort(data: Partial<ITrackShort>): Promise<ITrackShort> {
    const track = await Track.findById(data.track);
    if (!track) {
      throw new ApiError(httpStatus.NOT_FOUND, "Track not found");
    }
    
    const moodVideo = await TrackMoodVideo.findById(data.moodVideo);
    if (!moodVideo) {
      throw new ApiError(httpStatus.NOT_FOUND, "Mood video not found");
    }

    const short = await TrackShort.create(data);
    return short.populate(["track", "moodVideo"]);
  }

  async updateShort(id: string, data: Partial<ITrackShort>): Promise<ITrackShort> {
    const short = await TrackShort.findByIdAndUpdate(id, data, { new: true, runValidators: true })
      .populate(["track", "moodVideo"]);
      
    if (!short) {
      throw new ApiError(httpStatus.NOT_FOUND, "TrackShort not found");
    }
    return short;
  }

  async deleteShort(id: string): Promise<void> {
    const short = await TrackShort.findByIdAndDelete(id);
    if (!short) {
      throw new ApiError(httpStatus.NOT_FOUND, "TrackShort not found");
    }
  }

  async getShortById(id: string): Promise<ITrackShort> {
    const short = await TrackShort.findById(id).populate(["track", "moodVideo"]);
    if (!short) {
      throw new ApiError(httpStatus.NOT_FOUND, "TrackShort not found");
    }
    return short;
  }

  async getAllShorts(filters: any = {}): Promise<{ data: ITrackShort[]; total: number }> {
    const { page = 1, limit = 20, trackId, isPublished, search } = filters;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (trackId) query.track = trackId;
    if (isPublished !== undefined) query.isPublished = isPublished;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { caption: { $regex: search, $options: "i" } },
      ];
    }

    const [data, total] = await Promise.all([
      TrackShort.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate(["track", "moodVideo"]),
      TrackShort.countDocuments(query),
    ]);

    return { data, total };
  }

  async getShortsFeed(
    limit: number = 10,
    cursor?: string,
  ): Promise<{ feed: ITrackShort[]; nextCursor: string | null }> {
    const query: any = { isPublished: true };

    // Cursor-based pagination: lấy các doc có _id < cursor (sort desc)
    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const shorts = await TrackShort.find(query)
      .sort({ priority: -1, _id: -1 })
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

    // Nếu trả về đúng limit → còn trang tiếp theo
    const nextCursor =
      shorts.length === Number(limit)
        ? String(shorts[shorts.length - 1]._id)
        : null;

    return { feed: shorts as unknown as ITrackShort[], nextCursor };
  }

  async togglePublish(id: string, isPublished: boolean): Promise<ITrackShort> {
    const short = await TrackShort.findByIdAndUpdate(
      id,
      { isPublished },
      { new: true }
    ).populate(["track", "moodVideo"]);
    
    if (!short) {
      throw new ApiError(httpStatus.NOT_FOUND, "TrackShort not found");
    }
    return short;
  }

  async incrementView(id: string): Promise<void> {
    await TrackShort.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });
  }
}

export default new TrackShortService();
