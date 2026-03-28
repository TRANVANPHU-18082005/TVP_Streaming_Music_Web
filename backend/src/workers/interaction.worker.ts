import { Worker, Job, UnrecoverableError } from "bullmq";
import { queueRedis } from "../config/redis";
import Like from "../models/Like";
import Follow from "../models/Follow";
import Artist from "../models/Artist";
import Track from "../models/Track";
import Album from "../models/Album";
import Playlist from "../models/Playlist";
import mongoose from "mongoose";
import {
  INTERACTION_QUEUE_NAME,
  JOB_NAMES,
  ToggleLikeJobData,
  ToggleFollowJobData,
} from "../queue/interaction.queue";
import logger from "../utils/logger";

// ============================================================
// HELPERS
// ============================================================

const TARGET_MODELS: Record<string, mongoose.Model<any>> = {
  track: Track,
  album: Album,
  playlist: Playlist,
};

function getTargetModel(type: string): mongoose.Model<any> {
  const model = TARGET_MODELS[type];
  if (!model) {
    // UnrecoverableError: BullMQ sẽ KHÔNG retry job này
    // Tránh tốn tài nguyên retry với data không hợp lệ
    throw new UnrecoverableError(`Unknown targetType: "${type}"`);
  }
  return model;
}

/**
 * Validate ObjectId để tránh crash ở tầng DB.
 * Ném UnrecoverableError nếu không hợp lệ (không nên retry).
 */
function validateObjectId(id: string, fieldName: string): void {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new UnrecoverableError(
      `Invalid ObjectId for field "${fieldName}": ${id}`,
    );
  }
}

// ============================================================
// JOB PROCESSORS
// ============================================================

/**
 * Xử lý like/unlike cho Track, Album, Playlist.
 *
 * Logic:
 * - "like":   Upsert vào Like collection. Chỉ $inc likeCount nếu document mới được tạo.
 * - "unlike": Xóa khỏi Like collection. Chỉ $dec likeCount nếu thực sự xóa được.
 *
 * Guard: likeCount không bao giờ xuống dưới 0 nhờ điều kiện `{ likeCount: { $gt: 0 } }`.
 */
async function processToggleLike(data: ToggleLikeJobData): Promise<void> {
  const { userId, targetId, targetType, action } = data;
  validateObjectId(userId, "userId");
  validateObjectId(targetId, "targetId");

  const TargetModel = getTargetModel(targetType);

  if (action === "like") {
    // 1. Thêm bản ghi Like (Dùng addToSet hoặc updateOne để đảm bảo không trùng bản ghi trong DB)
    const res = await Like.updateOne(
      { userId, targetId, targetType },
      { $set: { userId, targetId, targetType, createdAt: new Date() } },
      { upsert: true },
    );

    // 2. Chỉ tăng Count nếu thực sự có bản ghi mới được tạo (upsertedCount > 0)
    if (res.upsertedCount > 0) {
      await TargetModel.findByIdAndUpdate(targetId, { $inc: { likeCount: 1 } });
    }
  } else {
    // 3. Xóa bản ghi Like
    const res = await Like.deleteOne({ userId, targetId, targetType });

    // 4. Chỉ giảm Count nếu thực sự có bản ghi bị xóa (deletedCount > 0)
    if (res.deletedCount > 0) {
      await TargetModel.findOneAndUpdate(
        { _id: targetId, likeCount: { $gt: 0 } },
        { $inc: { likeCount: -1 } },
      );
    }
  }
}

/**
 * Xử lý follow/unfollow Artist.
 *
 * Logic tương tự processToggleLike — idempotent với guard chống số âm.
 */
async function processToggleFollow(data: ToggleFollowJobData): Promise<void> {
  const { userId, artistId, action } = data;
  validateObjectId(userId, "userId");
  validateObjectId(artistId, "artistId");

  if (action === "follow") {
    const res = await Follow.updateOne(
      { followerId: userId, artistId },
      { $set: { followerId: userId, artistId, createdAt: new Date() } },
      { upsert: true },
    );

    if (res.upsertedCount > 0) {
      await Artist.findByIdAndUpdate(artistId, { $inc: { totalFollowers: 1 } });
    }
  } else {
    const res = await Follow.deleteOne({ followerId: userId, artistId });

    if (res.deletedCount > 0) {
      await Artist.findOneAndUpdate(
        { _id: artistId, totalFollowers: { $gt: 0 } },
        { $inc: { totalFollowers: -1 } },
      );
    }
  }
}
// ============================================================
// MAIN WORKER
// ============================================================

export const interactionWorker = new Worker(
  INTERACTION_QUEUE_NAME,

  // Processor: router phân luồng job theo tên
  async (job: Job) => {
    const startTime = Date.now();

    try {
      switch (job.name) {
        case JOB_NAMES.TOGGLE_LIKE:
          await processToggleLike(job.data as ToggleLikeJobData);
          break;

        case JOB_NAMES.TOGGLE_FOLLOW:
          await processToggleFollow(job.data as ToggleFollowJobData);
          break;

        default:
          // Job name lạ → không retry (lỗi code, không phải lỗi runtime)
          throw new UnrecoverableError(`Unknown job name: "${job.name}"`);
      }

      logger.debug(
        `[Worker] Job ${job.id} (${job.name}) done in ${Date.now() - startTime}ms`,
      );
    } catch (error) {
      // UnrecoverableError: re-throw để BullMQ skip retry
      if (error instanceof UnrecoverableError) throw error;

      // Lỗi thường (network, DB timeout): log rồi re-throw để BullMQ retry
      logger.error(
        `[Worker] Job ${job.id} (${job.name}) attempt ${job.attemptsMade + 1} failed:`,
        error,
      );
      throw error;
    }
  },

  {
    connection: queueRedis,

    // 20 jobs song song — cân bằng giữa throughput và áp lực MongoDB
    concurrency: 20,

    // Rate limiter: tối đa 1000 jobs / 5 giây → bảo vệ MongoDB khỏi spike
    limiter: { max: 1000, duration: 5000 },

    // Stalledinterval: phát hiện worker chết giữa chừng sau 30s
    // (BullMQ mặc định 30000ms, ghi rõ cho dễ đọc)
    stalledInterval: 30_000,

    // Sau maxStalledCount lần stall liên tiếp → đánh dấu job failed
    maxStalledCount: 2,
  },
);

// ============================================================
// WORKER EVENT LISTENERS (Observability & Alerting)
// ============================================================

interactionWorker.on("completed", (job: Job) => {
  logger.info(`[Worker] ✅ Completed: ${job.name} | jobId=${job.id}`);
});

interactionWorker.on("failed", (job: Job | undefined, error: Error) => {
  if (!job) return;

  const isUnrecoverable = error instanceof UnrecoverableError;
  const logLevel = isUnrecoverable ? "warn" : "error";

  logger[logLevel](
    `[Worker] ❌ Failed: ${job.name} | jobId=${job.id} | attempt=${job.attemptsMade}/${job.opts.attempts} | reason=${error.message}`,
    {
      jobData: job.data,
      stack: error.stack,
    },
  );

  // TODO: Tích hợp Sentry / PagerDuty nếu attemptsMade >= maxAttempts
  // Ví dụ: if (job.attemptsMade >= (job.opts.attempts ?? 5)) { Sentry.captureException(error); }
});

interactionWorker.on("error", (error: Error) => {
  // Lỗi ở tầng worker (connection issue, etc.) — không liên quan đến job cụ thể
  logger.error("[Worker] 🔴 Worker-level error:", error);
});

interactionWorker.on("stalled", (jobId: string) => {
  logger.warn(
    `[Worker] ⚠️ Job stalled (worker may have crashed): jobId=${jobId}`,
  );
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

/**
 * Gọi hàm này khi nhận SIGTERM / SIGINT để:
 * 1. Ngừng nhận job mới
 * 2. Chờ các job đang chạy hoàn thành (tối đa 30s)
 * 3. Đóng connection Redis
 */
export async function closeInteractionWorker(): Promise<void> {
  logger.info("[Worker] Shutting down interaction worker...");
  await interactionWorker.close();
  logger.info("[Worker] Interaction worker closed gracefully.");
}

// Tự động hook vào process signals
// (Có thể chuyển ra server.ts nếu muốn quản lý tập trung)
process.on("SIGTERM", closeInteractionWorker);
process.on("SIGINT", closeInteractionWorker);
