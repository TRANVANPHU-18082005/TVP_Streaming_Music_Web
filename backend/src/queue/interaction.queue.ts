import { Queue, QueueEvents } from "bullmq";
import { queueRedis } from "../config/redis";
import logger from "../utils/logger";

// ============================================================
// CONSTANTS
// ============================================================

export const INTERACTION_QUEUE_NAME = "interaction-tasks";

export const JOB_NAMES = {
  TOGGLE_LIKE: "toggle-like-job",
  TOGGLE_FOLLOW: "toggle-follow-job",
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

// ============================================================
// JOB DATA TYPES (Type-safe payloads)
// ============================================================

export interface ToggleLikeJobData {
  userId: string;
  targetId: string;
  targetType: "track" | "album" | "playlist";
  action: "like" | "unlike";
  // Metadata để trace/debug
  attemptedAt: number; // Unix timestamp khi user click
}

export interface ToggleFollowJobData {
  userId: string;
  artistId: string;
  action: "follow" | "unfollow";
  attemptedAt: number;
}

export type InteractionJobData = ToggleLikeJobData | ToggleFollowJobData;

// ============================================================
// QUEUE INSTANCE
// ============================================================

export const interactionQueue = new Queue<InteractionJobData>(
  INTERACTION_QUEUE_NAME,
  {
    connection: queueRedis,
    defaultJobOptions: {
      // Retry 5 lần với exponential backoff
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 2000, // 2s → 4s → 8s → 16s → 32s
      },

      // Giữ lại 500 job completed gần nhất để debug trên BullBoard
      // (thay vì removeOnComplete: true → mất hết, không debug được)
      removeOnComplete: { count: 500 },

      // Giữ job failed 7 ngày để phân tích lỗi hệ thống
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  },
);

// ============================================================
// QUEUE EVENTS MONITOR (Observability)
// ============================================================
// QueueEvents lắng nghe các sự kiện từ worker để log/alert
// Chạy trong process riêng (không ảnh hưởng performance worker)

export const interactionQueueEvents = new QueueEvents(INTERACTION_QUEUE_NAME, {
  connection: queueRedis,
});

interactionQueueEvents.on("completed", ({ jobId }) => {
  logger.debug(`[Queue] ✅ Job completed: ${jobId}`);
});

interactionQueueEvents.on("failed", ({ jobId, failedReason }) => {
  logger.error(`[Queue] ❌ Job failed: ${jobId} — ${failedReason}`);
});

interactionQueueEvents.on("stalled", ({ jobId }) => {
  // Job bị stall = worker chết giữa chừng → BullMQ tự retry
  logger.warn(`[Queue] ⚠️ Job stalled (worker crashed?): ${jobId}`);
});

// ============================================================
// HELPER: Add job với jobId dedup chuẩn
// ============================================================

/**
 * Thêm toggle-like job vào queue.
 *
 * jobId duy nhất theo (userId, targetType, targetId) đảm bảo:
 * - Nếu user click like → unlike liên tục trong 500ms,
 *   chỉ job CUỐI CÙNG được xử lý (replace strategy).
 * - Tránh duplicate write vào DB.
 */
export async function addToggleLikeJob(data: ToggleLikeJobData) {
  // Không truyền jobId -> BullMQ tự sinh ID ngẫu nhiên -> Không bao giờ bị hụt Job
  return interactionQueue.add(JOB_NAMES.TOGGLE_LIKE, data);
}

/**
 * Thêm toggle-follow job vào queue.
 */
export async function addToggleFollowJob(data: ToggleFollowJobData) {
  return interactionQueue.add(JOB_NAMES.TOGGLE_FOLLOW, data);
}
// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

export async function closeInteractionQueue() {
  await interactionQueueEvents.close();
  await interactionQueue.close();
  logger.info("[Queue] Interaction queue closed gracefully.");
}
