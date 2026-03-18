import Like from "../models/Like";
import Follow from "../models/Follow";
import Track from "../models/Track";
import Artist from "../models/Artist";
import { cacheRedis } from "../config/redis";
import mongoose from "mongoose";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";

class InteractionService {
  private readonly CACHE_TTL = 86400; // 24 giờ
  private readonly EMPTY_SEED = "EMPTY_SEED";

  // 🚀 Cấu hình này giúp bạn linh hoạt giữa Local và Production
  private readonly USE_TRANSACTIONS = process.env.NODE_ENV === "production";

  private getLikeKey(userId: string) {
    return `user:likes:${userId}`;
  }
  private getFollowKey(userId: string) {
    return `user:follows:${userId}`;
  }

  /**
   * Đảm bảo Cache luôn sẵn sàng
   */
  private async ensureCache(
    userId: string,
    type: "like" | "follow",
  ): Promise<string> {
    const key =
      type === "like" ? this.getLikeKey(userId) : this.getFollowKey(userId);
    const exists = await cacheRedis.exists(key);
    if (!exists) await this.warmUpCache(userId, type);
    return key;
  }

  /**
   * TOGGLE LIKE TRACK
   */
  async toggleLikeTrack(userId: string, trackId: string) {
    const key = await this.ensureCache(userId, "like");
    const isLikedInCache = await cacheRedis.sismember(key, trackId);

    const executeUpdate = async (session?: mongoose.ClientSession) => {
      if (isLikedInCache) {
        // --- THỰC HIỆN UNLIKE ---
        const deleteRes = await Like.deleteOne({ userId, trackId }).session(
          session || null,
        );
        if (deleteRes.deletedCount > 0) {
          await Track.findByIdAndUpdate(trackId, {
            $inc: { likeCount: -1 },
          }).session(session || null);
        }
        return false;
      } else {
        // --- THỰC HIỆN LIKE ---
        try {
          await Like.create([{ userId, trackId }], {
            session: session || null,
          });
          await Track.findByIdAndUpdate(trackId, {
            $inc: { likeCount: 1 },
          }).session(session || null);
          return true;
        } catch (err: any) {
          if (err.code === 11000) return true; // Đã like trước đó
          throw err;
        }
      }
    };

    try {
      let finalStatus: boolean;

      if (this.USE_TRANSACTIONS) {
        // Chế độ Production: Dùng Transaction
        const session = await mongoose.startSession();
        await session.withTransaction(async () => {
          finalStatus = await executeUpdate(session);
        });
        session.endSession();
      } else {
        // Chế độ Dev: Không dùng Transaction
        finalStatus = await executeUpdate();
      }

      // Sync Redis sau khi DB thành công
      if (finalStatus!) await cacheRedis.sadd(key, trackId);
      else await cacheRedis.srem(key, trackId);

      return { isLiked: finalStatus! };
    } catch (error) {
      await cacheRedis.del(key); // Xóa cache để tránh lệch data
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Lỗi xử lý tương tác Like",
      );
    }
  }

  /**
   * TOGGLE FOLLOW ARTIST
   */
  async toggleFollowArtist(userId: string, artistId: string) {
    const key = await this.ensureCache(userId, "follow");
    const isFollowedInCache = await cacheRedis.sismember(key, artistId);

    const executeUpdate = async (session?: mongoose.ClientSession) => {
      if (isFollowedInCache) {
        const deleteRes = await Follow.deleteOne({
          followerId: userId,
          artistId,
        }).session(session || null);
        if (deleteRes.deletedCount > 0) {
          await Artist.findByIdAndUpdate(artistId, {
            $inc: { followerCount: -1 },
          }).session(session || null);
        }
        return false;
      } else {
        try {
          await Follow.create([{ followerId: userId, artistId }], {
            session: session || null,
          });
          await Artist.findByIdAndUpdate(artistId, {
            $inc: { followerCount: 1 },
          }).session(session || null);
          return true;
        } catch (err: any) {
          if (err.code === 11000) return true;
          throw err;
        }
      }
    };

    try {
      let finalStatus: boolean;

      if (this.USE_TRANSACTIONS) {
        const session = await mongoose.startSession();
        await session.withTransaction(async () => {
          finalStatus = await executeUpdate(session);
        });
        session.endSession();
      } else {
        finalStatus = await executeUpdate();
      }

      if (finalStatus!) await cacheRedis.sadd(key, artistId);
      else await cacheRedis.srem(key, artistId);

      return { isFollowed: finalStatus! };
    } catch (error) {
      await cacheRedis.del(key);
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Lỗi xử lý tương tác Follow",
      );
    }
  }

  /**
   * CHECK BATCH (Likes & Follows)
   */
  async checkInteractions(
    userId: string,
    ids: string[],
    type: "like" | "follow",
  ) {
    if (!ids.length) return [];
    const key = await this.ensureCache(userId, type);

    const pipeline = cacheRedis.pipeline();
    ids.forEach((id) => pipeline.sismember(key, id));
    const results = await pipeline.exec();

    return ids.filter((id, idx) => (results?.[idx]?.[1] as number) === 1);
  }

  /**
   * WARM UP CACHE (Nạp data vào Redis)
   */
  private async warmUpCache(userId: string, type: "like" | "follow") {
    const key =
      type === "like" ? this.getLikeKey(userId) : this.getFollowKey(userId);

    let ids: string[] = [];
    if (type === "like") {
      const likes = await Like.find({ userId }).select("trackId").lean();
      ids = likes.map((l) => l.trackId.toString());
    } else {
      const follows = await Follow.find({ followerId: userId })
        .select("artistId")
        .lean();
      ids = follows.map((f) => f.artistId.toString());
    }

    await cacheRedis.del(key);
    if (ids.length > 0) {
      // Chunking 1000 items để không làm block Redis
      for (let i = 0; i < ids.length; i += 1000) {
        await cacheRedis.sadd(key, ...ids.slice(i, i + 1000));
      }
    } else {
      await cacheRedis.sadd(key, this.EMPTY_SEED);
    }
    await cacheRedis.expire(key, this.CACHE_TTL);
  }
}

export default new InteractionService();
