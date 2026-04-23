// ─────────────────────────────────────────────────────────────────────────────
// queues/audio.queue.ts  — Producer
// ─────────────────────────────────────────────────────────────────────────────
import { Queue, JobsOptions } from "bullmq";
import { queueRedis } from "../config/redis";
import {
  ProcessTrackJobData,
  TrackProcessingType,
} from "../types/worker.types";

export const audioQueue = new Queue<ProcessTrackJobData>("audio-transcoding", {
  connection: queueRedis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: { count: 10, age: 3_600 },
    removeOnFail: { count: 20, age: 86_400 },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Base helper — dùng nội bộ
// ─────────────────────────────────────────────────────────────────────────────
async function addJob(
  data: ProcessTrackJobData,
  opts: JobsOptions = {},
  label?: string,
): Promise<void> {
  const jobId = opts.jobId ?? `${data.type}-${data.trackId}-${Date.now()}`;
  await audioQueue.add("transcode", data, { ...opts, jobId });
  console.log(
    `📥 [Queue] Job [${label ?? data.type}] added for track ${data.trackId}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/** Upload track mới — full pipeline */
export async function addFullProcessJob(
  trackId: string,
  fileUrl: string,
): Promise<void> {
  await addJob({ trackId, fileUrl, type: "full" }, {}, "full");
}

/** Retry chỉ HLS transcode, giữ nguyên lyrics/mood */
export async function addRetryTranscodeJob(
  trackId: string,
  fileUrl: string,
): Promise<void> {
  await addJob(
    { trackId, fileUrl, type: "transcode_only" },
    { jobId: `retry-transcode-${trackId}-${Date.now()}` },
    "retry:transcode",
  );
}

/** Retry lyrics từ đầu (LRCLIB + karaoke fallback chain) */
export async function addRetryLyricJob(
  trackId: string,
  fileUrl: string,
): Promise<void> {
  await addJob(
    { trackId, fileUrl, type: "lyric_only" },
    { jobId: `retry-lyric-${trackId}-${Date.now()}` },
    "retry:lyric",
  );
}

/** Retry chỉ forced alignment (karaoke), cần plainLyrics đã có trong DB */
export async function addRetryKaraokeJob(
  trackId: string,
  fileUrl: string,
): Promise<void> {
  await addJob(
    { trackId, fileUrl, type: "karaoke_only" },
    { jobId: `retry-karaoke-${trackId}-${Date.now()}` },
    "retry:karaoke",
  );
}

/** Retry mood canvas matching (tags thay đổi, không download audio) */
export async function addRetryMoodJob(
  trackId: string,
  fileUrl: string,
): Promise<void> {
  await addJob(
    { trackId, fileUrl, type: "mood_only" },
    { jobId: `retry-mood-${trackId}-${Date.now()}` },
    "retry:mood",
  );
}
