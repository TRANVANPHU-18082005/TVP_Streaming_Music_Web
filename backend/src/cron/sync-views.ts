import * as cron from "node-cron";
import { cacheRedis } from "../config/redis";
import Track from "../models/Track";
import Album from "../models/Album";
import Playlist from "../models/Playlist";
import Artist from "../models/Artist";
import Genre from "../models/Genre";
import logger from "../utils/logger";

// ─── Constants ────────────────────────────────────────────────────────────────

const BATCH_SIZE = 500;
const SCAN_COUNT = 200; // Hint per SCAN iteration (tăng throughput)
const CRON_SCHEDULE = "*/5 * * * *";
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;
const VIEW_KEY_PREFIX = "views:";
const LOCK_KEY = "lock:viewSync";
const LOCK_TTL_SECONDS = 270; // 4.5 phút < 5 phút cron interval

// ─── Model Registry ───────────────────────────────────────────────────────────

type SupportedModelType = "track" | "album" | "playlist" | "artist" | "genre";

const MODEL_MAP: Record<SupportedModelType, any> = {
  track: Track,
  album: Album,
  playlist: Playlist,
  artist: Artist,
  genre: Genre,
} as const;

const SUPPORTED_TYPES = new Set(Object.keys(MODEL_MAP));

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupedOps {
  ops: object[];
  redisKeys: string[];
  redisViews: number[];
}

interface SyncMetrics {
  totalKeys: number;
  processedKeys: number;
  skippedKeys: number;
  failedTypes: string[];
  durationMs: number;
}

// ─── Distributed Lock ─────────────────────────────────────────────────────────

/**
 * Dùng Redis SET NX EX thay vì biến in-memory `isSyncing`.
 * Giải quyết race condition khi scale nhiều instance.
 */
async function acquireLock(): Promise<boolean> {
  const result = await cacheRedis.set(
    LOCK_KEY,
    "1",
    "EX",
    LOCK_TTL_SECONDS,
    "NX",
  );
  return result === "OK";
}

async function releaseLock(): Promise<void> {
  await cacheRedis.del(LOCK_KEY);
}

// ─── Key Parsing ──────────────────────────────────────────────────────────────

interface ParsedViewKey {
  type: SupportedModelType;
  id: string;
}

/**
 * Parse key pattern `views:<type>:<objectId>`
 * Trả về null nếu key không hợp lệ.
 */
function parseViewKey(key: string): ParsedViewKey | null {
  // views:type:id → split tối đa 3 phần, tránh id chứa dấu ":"
  const withoutPrefix = key.slice(VIEW_KEY_PREFIX.length);
  const colonIdx = withoutPrefix.indexOf(":");
  if (colonIdx === -1) return null;

  const type = withoutPrefix.slice(0, colonIdx);
  const id = withoutPrefix.slice(colonIdx + 1);

  if (!SUPPORTED_TYPES.has(type) || !OBJECT_ID_REGEX.test(id)) return null;

  return { type: type as SupportedModelType, id };
}

// ─── Batch Processing ─────────────────────────────────────────────────────────

async function processBatch(
  keys: string[],
  metrics: SyncMetrics,
): Promise<void> {
  metrics.totalKeys += keys.length;

  // Lấy tất cả view counts trong 1 round-trip
  const values = await cacheRedis.mget(keys);

  // Group ops theo model type
  const groupedOps = new Map<SupportedModelType, GroupedOps>();

  for (let i = 0; i < keys.length; i++) {
    const views = parseInt(values[i] ?? "0", 10);

    if (isNaN(views) || views <= 0) {
      metrics.skippedKeys++;
      continue;
    }

    const parsed = parseViewKey(keys[i]);
    if (!parsed) {
      metrics.skippedKeys++;
      logger.warn("[SyncView] Invalid key format, skipping", { key: keys[i] });
      continue;
    }

    const { type, id } = parsed;

    if (!groupedOps.has(type)) {
      groupedOps.set(type, { ops: [], redisKeys: [], redisViews: [] });
    }

    const group = groupedOps.get(type)!;
    group.ops.push({
      updateOne: {
        filter: { _id: id },
        update: { $inc: { playCount: views } },
      },
    });
    group.redisKeys.push(keys[i]);
    group.redisViews.push(views);
    metrics.processedKeys++;
  }

  // Flush mỗi model type song song
  await Promise.allSettled(
    Array.from(groupedOps.entries()).map(([type, data]) =>
      flushModelGroup(type, data, metrics),
    ),
  );
}

/**
 * Ghi DB trước, sau đó mới decrement Redis.
 * Nếu DB lỗi → Redis giữ nguyên → retry lần sau (at-least-once semantics).
 */
async function flushModelGroup(
  type: SupportedModelType,
  data: GroupedOps,
  metrics: SyncMetrics,
): Promise<void> {
  try {
    const result = await MODEL_MAP[type].bulkWrite(data.ops, {
      ordered: false,
    });

    logger.debug(`[SyncView] bulkWrite ${type}`, {
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });

    // Decrement Redis chỉ khi DB thành công
    const pipeline = cacheRedis.pipeline();
    for (let i = 0; i < data.redisKeys.length; i++) {
      pipeline.decrby(data.redisKeys[i], data.redisViews[i]);
    }
    const pipelineResults = await pipeline.exec();

    // Dọn key có giá trị ≤ 0 để tránh rác Redis
    const cleanupPipeline = cacheRedis.pipeline();
    let hasCleanup = false;
    pipelineResults?.forEach(([err, val], idx) => {
      if (!err && typeof val === "number" && val <= 0) {
        cleanupPipeline.del(data.redisKeys[idx]);
        hasCleanup = true;
      }
    });
    if (hasCleanup) await cleanupPipeline.exec();
  } catch (err) {
    metrics.failedTypes.push(type);
    logger.error(`[SyncView] Failed to sync type: ${type}`, { error: err });
    // Không re-throw → tiếp tục xử lý các type còn lại
  }
}

// ─── Main Job ─────────────────────────────────────────────────────────────────

async function runSyncJob(): Promise<void> {
  const acquired = await acquireLock();
  if (!acquired) {
    logger.warn("[SyncView] Lock already held, skipping this run.");
    return;
  }

  const startTime = Date.now();
  const metrics: SyncMetrics = {
    totalKeys: 0,
    processedKeys: 0,
    skippedKeys: 0,
    failedTypes: [],
    durationMs: 0,
  };

  logger.info("[SyncView] Starting sync job...");

  try {
    const stream = cacheRedis.scanStream({
      match: `${VIEW_KEY_PREFIX}*`,
      count: SCAN_COUNT,
    });

    let keysBatch: string[] = [];

    for await (const resultKeys of stream) {
      keysBatch.push(...(resultKeys as string[]));

      if (keysBatch.length >= BATCH_SIZE) {
        await processBatch(keysBatch, metrics);
        keysBatch = [];
      }
    }

    // Flush phần dư
    if (keysBatch.length > 0) {
      await processBatch(keysBatch, metrics);
    }
  } catch (error) {
    logger.error("[SyncView] Critical error during scan", { error });
  } finally {
    await releaseLock();

    metrics.durationMs = Date.now() - startTime;
    logger.info("[SyncView] Sync completed", { metrics });
  }
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

let cronTask: cron.ScheduledTask | null = null;

export const startViewSyncJob = (): void => {
  if (cronTask) {
    logger.warn("[SyncView] Job already started, ignoring duplicate call.");
    return;
  }

  cronTask = cron.schedule(CRON_SCHEDULE, () => {
    // Không await ở đây → cron callback không block event loop
    runSyncJob().catch((err) =>
      logger.error("[SyncView] Unhandled error in sync job", { error: err }),
    );
  });

  logger.info(`[SyncView] Scheduled view sync job: ${CRON_SCHEDULE}`);
};

export const stopViewSyncJob = (): void => {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    logger.info("[SyncView] View sync job stopped.");
  }
};

// Graceful shutdown
process.on("SIGTERM", stopViewSyncJob);
process.on("SIGINT", stopViewSyncJob);
