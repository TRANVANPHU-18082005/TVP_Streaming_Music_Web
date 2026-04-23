import { cacheRedis } from "../config/redis";
import Like from "../models/Like";
import Follow from "../models/Follow";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import {
  addToggleLikeJob,
  addToggleFollowJob,
} from "../queue/interaction.queue";
import { createModuleLogger } from "../utils/logger";
import mongoose from "mongoose";
import recommendationService from "./recommendation.service";

const log = createModuleLogger("InteractionService");

// ============================================================
// TYPES & CONSTANTS
// ============================================================

export type TargetType = "track" | "album" | "playlist";

export interface CheckInteractionsResult {
  checkedIds: string[];
  interactedIds: string[];
}

const CACHE_TTL = 86_400; // 24h
const LOCK_TTL = 10; // 10s cho distributed lock
const EMPTY_SEED = "__EMPTY__";
const SADD_BATCH_SIZE = 1_000;
const WAIT_FOR_CACHE_MS = 2_000;
const SPAM_WINDOW_SEC = 5;
const SPAM_MAX_COUNT = 12;

// Centralized Key Management
const Keys = {
  like: (userId: string, type: TargetType) => `user:likes:${type}:${userId}`,
  follow: (userId: string) => `user:follows:artist:${userId}`,
  lock: (key: string) => `lock:warmup:${key}`,
  spam: (userId: string, id: string) => `spam:interaction:${userId}:${id}`,
};

class InteractionService {
  /**
   * 🚀 TOGGLE LIKE (Generic cho Track, Album, Playlist)
   */
  async toggleLike(userId: string, targetId: any, targetType: any) {
    // 1. Validation nghiêm ngặt ngay tại Service
    this.validateTargetType(targetType);
    this.validateObjectIds({ userId, targetId });
    await this.checkSpam(userId, targetId);

    const key = await this.ensureCache(userId, "like", targetType);

    // 2. Đọc trạng thái từ Redis (Atomic Check)
    const results = await cacheRedis.pipeline().sismember(key, targetId).exec();
    if (!results || !results[0])
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Redis Pipeline failed",
      );

    const isLiked = results[0][1] === 1;
    const newStatus = !isLiked;

    // 3. Optimistic Update: Cập nhật Cache ngay lập tức để trả về Client
    if (newStatus) await cacheRedis.sadd(key, targetId);
    else await cacheRedis.srem(key, targetId);

    // 4. Offload to Queue: Việc ghi DB và cập nhật count để Worker lo
    await addToggleLikeJob({
      userId,
      targetId,
      targetType,
      action: newStatus ? "like" : "unlike",
      attemptedAt: Date.now(),
    });
    recommendationService.invalidateUserRecommendCache(userId);
    log.debug("toggleLike success", { userId, targetId, newStatus });
    return {
      isLiked: newStatus,
      targetType,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 👥 TOGGLE FOLLOW ARTIST
   */
  async toggleFollowArtist(userId: string, artistId: any) {
    this.validateObjectIds({ userId, artistId });
    await this.checkSpam(userId, artistId);

    const key = await this.ensureCache(userId, "follow");
    const isFollowed = (await cacheRedis.sismember(key, artistId)) === 1;
    const newStatus = !isFollowed;

    if (newStatus) await cacheRedis.sadd(key, artistId);
    else await cacheRedis.srem(key, artistId);

    await addToggleFollowJob({
      userId,
      artistId,
      action: newStatus ? "follow" : "unfollow",
      attemptedAt: Date.now(),
    });

    return { isFollowed: newStatus };
  }

  /**
   * ⚡ BATCH CHECK (Đồng bộ hàng loạt trạng thái cho UI)
   */
  async checkInteractions(
    userId: string,
    ids: any,
    type: any,
    targetType?: any,
  ) {
    if (!Array.isArray(ids) || ids.length === 0)
      throw new ApiError(httpStatus.BAD_REQUEST, "Mảng IDs không hợp lệ");
    if (ids.length > 100)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Tối đa 100 IDs mỗi lần check",
      );
    if (type === "like") this.validateTargetType(targetType);

    const uniqueIds = [...new Set(ids)];
    const key = await this.ensureCache(userId, type, targetType);

    const pipeline = cacheRedis.pipeline();
    uniqueIds.forEach((id) => pipeline.sismember(key, id));
    const results = await pipeline.exec();

    const interactedIds = uniqueIds.filter((id, idx) => {
      return results?.[idx]?.[1] === 1 && id !== EMPTY_SEED;
    });

    return { checkedIds: uniqueIds, interactedIds };
  }

  /**
   * 🧹 CLEAR CACHE (Khi user logout/delete)
   */
  async clearUserCache(userId: string) {
    const keys = [
      Keys.like(userId, "track"),
      Keys.like(userId, "album"),
      Keys.like(userId, "playlist"),
      Keys.follow(userId),
    ];
    await cacheRedis.del(...keys);
    log.info("Cleared interaction cache", { userId });
  }

  // ============================================================
  // PRIVATE METHODS (Core Logic)
  // ============================================================

  /**
   * Đảm bảo cache tồn tại (Distributed Lock chống Thundering Herd)
   */
  private async ensureCache(
    userId: string,
    type: "like" | "follow",
    targetType?: TargetType,
  ): Promise<string> {
    const key =
      type === "like" ? Keys.like(userId, targetType!) : Keys.follow(userId);

    if (await cacheRedis.exists(key)) return key;

    const lockKey = Keys.lock(key);
    const acquired = await cacheRedis.set(lockKey, "1", "EX", LOCK_TTL, "NX");

    if (acquired === "OK") {
      try {
        await this.warmUpCache(userId, type, targetType);
      } finally {
        await cacheRedis.del(lockKey);
      }
    } else {
      const ok = await this.waitForCache(key);
      if (!ok) await this.warmUpCache(userId, type, targetType); // Fallback nếu polling fail
    }
    return key;
  }

  private async waitForCache(key: string): Promise<boolean> {
    const deadline = Date.now() + WAIT_FOR_CACHE_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
      if (await cacheRedis.exists(key)) return true;
    }
    return false;
  }

  private async warmUpCache(
    userId: string,
    type: "like" | "follow",
    targetType?: TargetType,
  ) {
    const key =
      type === "like" ? Keys.like(userId, targetType!) : Keys.follow(userId);
    let ids: string[] = [];

    if (type === "like") {
      const likes = await Like.find({ userId, targetType })
        .select("targetId")
        .lean();
      ids = likes.map((l) => l.targetId.toString());
    } else {
      const follows = await Follow.find({ followerId: userId })
        .select("artistId")
        .lean();
      ids = follows.map((f) => f.artistId.toString());
    }

    const pipeline = cacheRedis.pipeline().del(key);
    if (ids.length > 0) {
      for (let i = 0; i < ids.length; i += SADD_BATCH_SIZE) {
        pipeline.sadd(key, ...ids.slice(i, i + SADD_BATCH_SIZE));
      }
    } else {
      pipeline.sadd(key, EMPTY_SEED);
    }
    pipeline.expire(key, CACHE_TTL);
    await pipeline.exec();
  }

  private async checkSpam(userId: string, targetId: string) {
    const key = Keys.spam(userId, targetId);
    const count = await cacheRedis.incr(key);
    if (count === 1) await cacheRedis.expire(key, SPAM_WINDOW_SEC);
    if (count > SPAM_MAX_COUNT)
      throw new ApiError(httpStatus.TOO_MANY_REQUESTS, "Thao tác quá nhanh!");
  }

  private validateTargetType(type: any) {
    if (!["track", "album", "playlist"].includes(type)) {
      throw new ApiError(httpStatus.BAD_REQUEST, `Loại ${type} không hợp lệ`);
    }
  }

  private validateObjectIds(ids: Record<string, any>) {
    for (const [f, v] of Object.entries(ids)) {
      if (!mongoose.Types.ObjectId.isValid(v))
        throw new ApiError(httpStatus.BAD_REQUEST, `ID ${f} sai định dạng`);
    }
  }
}

export default new InteractionService();
