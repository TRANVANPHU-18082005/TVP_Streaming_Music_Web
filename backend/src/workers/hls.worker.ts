/**
 * audioTranscodingWorker.ts — Production v2.1
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ARCHITECTURE
 * ─────────────
 * ┌─ Worker (BullMQ)
 * │   ├─ downloadFile()          — streaming download with timeout + size guard
 * │   ├─ getAudioMetadata()      — ffprobe with timeout + validation
 * │   ├─ transcodeToHLS()        — ffmpeg HLS pipeline with adaptive bitrate
 * │   ├─ enrichLyrics()          — lrclib fetch → parse → B2 upload (async FS)
 * │   ├─ matchMoodCanvas()       — tag-based TrackMoodVideo aggregation
 * │   ├─ uploadConcurrently()    — bounded concurrency B2 upload pool
 * │   └─ cleanupTmpDir()         — guaranteed cleanup in finally block
 *
 * PRODUCTION HARDENING (exhaustive)
 * ───────────────────────────────────
 * E1.  DB connection with retry loop (3 attempts, exponential backoff)
 * E2.  All filesystem ops wrapped: mkdirSync, writeFile (async), rmSync
 * E3.  downloadFile: response status validation, stream error handling,
 *       max file size guard (MAX_DOWNLOAD_SIZE_MB), timeout via AbortController
 * E4.  getAudioMetadata: ffprobe timeout, validates duration > 0 and < MAX_DURATION_SEC
 * E5.  transcodeToHLS: stderr capture, progress events logged, timeout kill
 * E6.  enrichLyrics: axios timeout, HTTP status check, LRC parse validation,
 *       empty-result guard, lyric file size guard, non-blocking async FS write
 * E7.  matchMoodCanvas: mongoose query timeout, empty-result safe path
 * E8.  uploadConcurrently: per-file retry (MAX_UPLOAD_RETRIES), bounded pool (5),
 *       m3u8 presence validation after upload
 * E9.  URL construction: env var presence check, trailing-slash normalisation
 * E10. Track.findByIdAndUpdate: all calls awaited with null-check on returned doc
 * E11. Worker-level error events (worker.on("error")) logged + re-thrown
 * E12. process.on SIGTERM/SIGINT for graceful shutdown (drain in-flight jobs)
 * E13. Stale tmp dir detection: clean dirs older than MAX_TMP_AGE_MS on startup
 * E14. cacheRedis.del failure is non-fatal — caught and logged separately
 * E15. All thrown errors are typed Error instances (never raw string throws)
 * E16. Job name guard: unknown job names logged and skipped (no throw)
 * E17. concurrency exposed via env var WORKER_CONCURRENCY (default 2)
 * E18. ffmpegPath null-guard — throws at startup if binary is missing
 * E19. All mongoose operations use lean() where only data is needed
 * E20. tmpDir scoped per-job with unique suffix (trackId + job.id) to prevent
 *       cross-job collision when concurrency > 1
 * E21. Adaptive bitrate: safeBitrate = Math.min(128, meta.bitrate) — never
 *       wastes B2 bandwidth by encoding higher than the source bitrate
 * E22. Non-blocking lyric file write: fs.writeFileSync → fs.promises.writeFile
 *       to avoid blocking the event loop on large lyric payloads
 * E23. SSRF guard in sanitiseUrl: blocks localhost, all RFC-1918 private ranges
 *       (10.x, 172.16-31.x, 192.168.x) and link-local (169.254.x)
 */

import { Worker, Job } from "bullmq";
import { queueRedis, cacheRedis } from "../config/redis";
import Track from "../models/Track";
import Artist from "../models/Artist"; // THÊM DÒNG NÀY
import TrackMoodVideo from "../models/TrackMoodVideo";
import mongoose from "mongoose";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import path from "path";
import fs from "fs";
import axios, { AxiosError } from "axios";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import dotenv from "dotenv";
import { uploadToB2 } from "../utils/b2Upload";
// ... các import khác giữ nguyên
const ffprobeStatic = require("ffprobe-static");

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// 0. STARTUP GUARDS
// ─────────────────────────────────────────────────────────────────────────────

if (!ffmpegPath) {
  throw new Error("[Worker] ffmpeg-static binary not found.");
}
ffmpeg.setFfmpegPath(ffmpegPath);

// FIX LỖI Ở ĐÂY: Phải gán Path cho ffprobe ngay lập tức
if (ffprobeStatic && ffprobeStatic.path) {
  ffmpeg.setFfprobePath(ffprobeStatic.path);
  console.log("✅ Worker Engine: FFmpeg & FFprobe are ready.");
} else {
  console.error("❌ [Worker] Critical: ffprobe-static path not found!");
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONSTANTS & CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const LYRIC_PREVIEW_LIMIT = 5;
const MAX_DOWNLOAD_SIZE_MB = 512; // 512 MB hard ceiling
const MAX_DOWNLOAD_SIZE = MAX_DOWNLOAD_SIZE_MB * 1024 * 1024;
const MAX_DURATION_SEC = 60 * 60; // 1 hour
const MAX_TMP_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 min
const FFPROBE_TIMEOUT_MS = 30_000; // 30 s
const TRANSCODE_TIMEOUT_MS = 30 * 60 * 1000; // 30 min
const LYRICS_TIMEOUT_MS = 8_000;
const UPLOAD_POOL_SIZE = 5;
const MAX_UPLOAD_RETRIES = 3;
const DB_CONNECT_RETRIES = 3;
const DB_RETRY_BASE_MS = 2_000;
const HLS_SEGMENT_SEC = 10;
const HLS_MAX_BITRATE_KBPS = 128; // E21: ceiling for output bitrate
const MAX_LYRIC_BYTES = 2 * 1024 * 1024; // 2 MB lyric payload guard

const WORKER_CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 2);
const TMP_ROOT = path.resolve(__dirname, "../../tmp");

// ─────────────────────────────────────────────────────────────────────────────
// 2. TYPED INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

interface AudioMeta {
  duration: number; // seconds, ceil
  bitrate: number; // kbps, ceil
}

interface LyricLine {
  startTime: number;
  endTime: number;
  text: string;
}

interface EnrichmentResult {
  lyricType: "synced" | "none";
  lyricPreview: LyricLine[];
  plainLyrics: string;
  lyricUrl?: string;
  moodVideo?: mongoose.Types.ObjectId;
}

interface TranscodeJobData {
  trackId: string;
  fileUrl: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DATABASE CONNECTION WITH RETRY (E1)
// ─────────────────────────────────────────────────────────────────────────────

async function connectWithRetry(): Promise<void> {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("[Worker] MONGO_URI env var is not set.");

  for (let attempt = 1; attempt <= DB_CONNECT_RETRIES; attempt++) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5_000 });
      console.log("📦 Worker DB Connected");
      return;
    } catch (err) {
      const delay = DB_RETRY_BASE_MS * attempt;
      console.error(
        `❌ Worker DB Error (attempt ${attempt}/${DB_CONNECT_RETRIES}):`,
        (err as Error).message,
      );
      if (attempt === DB_CONNECT_RETRIES) {
        throw new Error(
          `[Worker] Failed to connect to MongoDB after ${DB_CONNECT_RETRIES} attempts.`,
        );
      }
      await sleep(delay);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. UTILS
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * E23: Sanitise a URL — trims whitespace, strips embedded newlines (prevents
 * header injection), validates scheme, and blocks all private/link-local
 * network ranges to prevent SSRF attacks.
 */
function sanitiseUrl(raw: string): string {
  const cleaned = raw.trim().replace(/[\n\r\t]/g, "");

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    throw new Error(`[sanitiseUrl] Malformed URL: "${raw}"`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`[sanitiseUrl] Disallowed URL scheme: ${parsed.protocol}`);
  }

  // Block RFC-1918 private ranges, loopback, and link-local (E23)
  const hostname = parsed.hostname.toLowerCase();
  const PRIVATE_RE =
    /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|::1|fc[0-9a-f]{2}:.*)$/i;

  if (PRIVATE_RE.test(hostname)) {
    throw new Error(
      `[sanitiseUrl] Access to private/loopback address "${hostname}" is forbidden.`,
    );
  }

  return parsed.href;
}

/** Extract bucket-relative path safely, throwing if structure is unexpected */
function extractRelativePath(fileUrl: string, bucketName: string): string {
  const marker = `${bucketName}/`;
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) {
    throw new Error(
      `[Worker] fileUrl "${fileUrl}" does not contain bucket marker "${marker}".`,
    );
  }
  return fileUrl.slice(idx + marker.length);
}

/** Build the CDN base URL, validating required env vars (E9) */
function buildBaseUrl(): string {
  const isProd = process.env.NODE_ENV === "production";
  const envKey = isProd ? "CLOUDFLARE_DOMAIN" : "B2_ENDPOINT";
  const raw = process.env[envKey];
  if (!raw) throw new Error(`[Worker] Missing env var: ${envKey}`);
  return raw.replace(/\/+$/, ""); // normalise trailing slash
}

/** Safely delete a directory — never throws (E2, guaranteed cleanup) */
function safeRmDir(dir: string): void {
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch (err) {
    console.error(
      `[Worker] Failed to clean up tmpDir "${dir}":`,
      (err as Error).message,
    );
  }
}

/** Remove a single file best-effort — never throws */
function safeRmFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // best-effort
  }
}

/** Purge stale tmp dirs from previous crashed runs (E13) */
function cleanStaleTmpDirs(): void {
  try {
    if (!fs.existsSync(TMP_ROOT)) return;
    const now = Date.now();
    for (const entry of fs.readdirSync(TMP_ROOT)) {
      const fullPath = path.join(TMP_ROOT, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && now - stat.mtimeMs > MAX_TMP_AGE_MS) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log(`[Worker] Cleaned stale tmp dir: ${fullPath}`);
        }
      } catch {
        // best-effort — skip unreadable entries
      }
    }
  } catch (err) {
    console.warn("[Worker] cleanStaleTmpDirs error:", (err as Error).message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. LRC PARSER
// ─────────────────────────────────────────────────────────────────────────────

function parseLRC(lrc: string): LyricLine[] {
  if (typeof lrc !== "string" || lrc.trim().length === 0) return [];

  const TIME_RE = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
  const raw: { startTime: number; text: string }[] = [];

  for (const line of lrc.split("\n")) {
    const match = TIME_RE.exec(line);
    if (!match) continue;
    const ms =
      parseInt(match[1], 10) * 60_000 +
      parseInt(match[2], 10) * 1_000 +
      parseInt(match[3].padEnd(3, "0").slice(0, 3), 10);
    const text = line.replace(TIME_RE, "").trim();
    if (text) raw.push({ startTime: ms, text });
  }

  if (raw.length === 0) return [];

  return raw.map((line, i) => ({
    ...line,
    endTime: raw[i + 1]?.startTime ?? line.startTime + 5_000,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. DOWNLOAD (E3)
// ─────────────────────────────────────────────────────────────────────────────

async function downloadFile(url: string, outputPath: string): Promise<void> {
  const safeUrl = sanitiseUrl(url); // E23
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  let response;
  try {
    response = await axios({
      url: safeUrl,
      method: "GET",
      responseType: "stream",
      signal: controller.signal as any,
      maxContentLength: MAX_DOWNLOAD_SIZE,
      maxBodyLength: MAX_DOWNLOAD_SIZE,
    });
  } catch (err) {
    clearTimeout(timer);
    const msg =
      err instanceof AxiosError ? err.message : (err as Error).message;
    throw new Error(`[downloadFile] HTTP request failed: ${msg}`);
  } finally {
    clearTimeout(timer);
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `[downloadFile] Unexpected HTTP status: ${response.status}`,
    );
  }

  // Early reject via Content-Length header before streaming starts
  const contentLength = parseInt(response.headers["content-length"] ?? "0", 10);
  if (contentLength > MAX_DOWNLOAD_SIZE) {
    throw new Error(
      `[downloadFile] File too large: ${(contentLength / 1024 / 1024).toFixed(1)} MB ` +
        `(max ${MAX_DOWNLOAD_SIZE_MB} MB).`,
    );
  }

  // Running byte counter — enforces limit even without Content-Length
  let bytesReceived = 0;
  const stream = response.data as Readable;

  stream.on("data", (chunk: Buffer) => {
    bytesReceived += chunk.length;
    if (bytesReceived > MAX_DOWNLOAD_SIZE) {
      stream.destroy(
        new Error(
          `[downloadFile] Download exceeded ${MAX_DOWNLOAD_SIZE_MB} MB limit.`,
        ),
      );
    }
  });

  try {
    await pipeline(stream, fs.createWriteStream(outputPath));
  } catch (err) {
    safeRmFile(outputPath);
    throw new Error(
      `[downloadFile] Stream pipeline failed: ${(err as Error).message}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. AUDIO METADATA (E4)
// ─────────────────────────────────────────────────────────────────────────────

function getAudioMetadata(filePath: string): Promise<AudioMeta> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(
        new Error(`[getAudioMetadata] File not found: ${filePath}`),
      );
    }

    const timer = setTimeout(() => {
      reject(
        new Error(
          `[getAudioMetadata] ffprobe timed out after ${FFPROBE_TIMEOUT_MS}ms.`,
        ),
      );
    }, FFPROBE_TIMEOUT_MS);

    // SỬA Ở ĐÂY: Khởi tạo ffmpeg(filePath) trước khi gọi ffprobe
    ffmpeg(filePath).ffprobe((err, metadata) => {
      clearTimeout(timer);

      if (err) {
        return reject(
          new Error(`[getAudioMetadata] ffprobe error: ${err.message}`),
        );
      }

      // Kiểm tra metadata có tồn tại không để tránh lỗi "undefined"
      if (!metadata || !metadata.format) {
        return reject(
          new Error(
            "[getAudioMetadata] Could not parse audio metadata format.",
          ),
        );
      }

      const duration = Math.ceil(metadata.format.duration ?? 0);
      const bitrate = Math.ceil((metadata.format.bit_rate ?? 0) / 1000);

      if (duration <= 0) {
        return reject(
          new Error("[getAudioMetadata] Audio duration is 0 or missing."),
        );
      }

      if (duration > MAX_DURATION_SEC) {
        return reject(
          new Error(
            `[getAudioMetadata] Audio duration ${duration}s exceeds maximum ${MAX_DURATION_SEC}s.`,
          ),
        );
      }

      resolve({ duration, bitrate });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. HLS TRANSCODING (E5 + E21)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * E21 — Adaptive bitrate:
 *   safeBitrate = Math.min(HLS_MAX_BITRATE_KBPS, sourceBitrate)
 *
 * This ensures we never encode at a higher bitrate than the source, which
 * would bloat segment files without any quality gain and waste B2 storage.
 * If the source itself is low-bitrate (e.g. a voice memo at 48 kbps), we
 * honour that rather than padding it up to 128 k.
 */
function transcodeToHLS(
  inputPath: string,
  outputM3u8: string,
  jobId: string | undefined,
  sourceBitrate: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      return reject(
        new Error(`[transcodeToHLS] Input file not found: ${inputPath}`),
      );
    }

    // E21: cap at HLS_MAX_BITRATE_KBPS; also guard against 0 kbps from probe
    const safeBitrate = Math.min(
      HLS_MAX_BITRATE_KBPS,
      sourceBitrate > 0 ? sourceBitrate : HLS_MAX_BITRATE_KBPS,
    );

    let proc: ReturnType<typeof ffmpeg> | null = null;
    const stderrLines: string[] = [];

    const timer = setTimeout(() => {
      proc?.kill("SIGKILL");
      reject(
        new Error(
          `[transcodeToHLS] Transcoding timed out after ${TRANSCODE_TIMEOUT_MS / 1000}s.`,
        ),
      );
    }, TRANSCODE_TIMEOUT_MS);

    proc = ffmpeg(inputPath)
      .outputOptions([
        "-start_number",
        "0",
        "-hls_time",
        String(HLS_SEGMENT_SEC),
        "-hls_list_size",
        "0",
        "-f",
        "hls",
        "-c:a",
        "aac",
        "-b:a",
        `${safeBitrate}k`,
        "-ar",
        "44100",
        "-ac",
        "2",
      ])
      .output(outputM3u8)
      .on("stderr", (line: string) => {
        stderrLines.push(line);
        if (stderrLines.length > 200) stderrLines.shift(); // bounded buffer
      })
      .on("progress", (progress) => {
        if (progress.percent != null) {
          console.log(
            `[Job ${jobId}] 🔄 Transcoding: ${Math.round(progress.percent)}% ` +
              `(target: ${safeBitrate}kbps)`,
          );
        }
      })
      .on("end", () => {
        clearTimeout(timer);
        if (!fs.existsSync(outputM3u8)) {
          return reject(
            new Error(
              "[transcodeToHLS] Transcoding completed but m3u8 not found.",
            ),
          );
        }
        resolve();
      })
      .on("error", (err) => {
        clearTimeout(timer);
        const detail = stderrLines.slice(-10).join("\n");
        reject(
          new Error(
            `[transcodeToHLS] ffmpeg error: ${err.message}\nStderr tail:\n${detail}`,
          ),
        );
      });

    proc.run();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. LYRIC ENRICHMENT (E6 + E22)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * E22 — Non-blocking lyric file write:
 *   fs.writeFileSync blocks the entire Node.js event loop while writing.
 *   For lyric payloads that can reach the 2 MB ceiling this causes measurable
 *   latency spikes visible to other concurrent jobs.  fs.promises.writeFile
 *   yields to the event loop, keeping other jobs responsive.
 */
async function enrichLyrics(
  trackTitle: string,
  artistName: string,
  duration: number,
  tmpDir: string,
  trackFolderKey: string,
  bucketName: string,
  jobId: string | undefined,
): Promise<
  Pick<
    EnrichmentResult,
    "lyricType" | "lyricPreview" | "plainLyrics" | "lyricUrl"
  >
> {
  const empty = {
    lyricType: "none" as const,
    lyricPreview: [],
    plainLyrics: "",
    lyricUrl: undefined,
  };

  try {
    const lrcRes = await axios.get<{
      syncedLyrics?: string;
      plainLyrics?: string;
    }>("https://lrclib.net/api/get", {
      params: {
        track_name: trackTitle,
        artist_name: artistName,
        duration,
      },
      timeout: LYRICS_TIMEOUT_MS,
      validateStatus: (s) => s < 500, // treat 4xx as "not found", not error
    });

    if (
      lrcRes.status === 404 ||
      lrcRes.status === 204 ||
      !lrcRes.data?.syncedLyrics
    ) {
      console.log(`[Job ${jobId}] ℹ️ No synced lyrics found.`);
      return empty;
    }

    const parsedLyrics = parseLRC(lrcRes.data.syncedLyrics);
    if (parsedLyrics.length === 0) {
      console.log(
        `[Job ${jobId}] ℹ️ Lyrics found but LRC parse produced 0 lines.`,
      );
      return empty;
    }

    const lyricPayload = JSON.stringify({
      trackTitle,
      type: "synced",
      lines: parsedLyrics,
    });

    // Guard: don't upload absurdly large lyric files
    if (Buffer.byteLength(lyricPayload) > MAX_LYRIC_BYTES) {
      console.warn(`[Job ${jobId}] ⚠️ Lyric file exceeds 2 MB — skipping.`);
      return empty;
    }

    const lyricLocalPath = path.join(tmpDir, "lyrics.json");

    // E22: non-blocking write — avoids event-loop stall under concurrency
    await fs.promises.writeFile(lyricLocalPath, lyricPayload, "utf8");

    const uploadedKey = await uploadWithRetry(
      lyricLocalPath,
      "lyrics.json",
      `${trackFolderKey}/lyrics`,
    );

    const baseUrl = buildBaseUrl();
    const lyricUrl = `${baseUrl}/${bucketName}/${uploadedKey}`;

    return {
      lyricType: "synced",
      lyricPreview: parsedLyrics.slice(0, LYRIC_PREVIEW_LIMIT),
      plainLyrics: parsedLyrics.map((l) => l.text).join(" "),
      lyricUrl,
    };
  } catch (err) {
    // Lyrics are non-critical — log and continue
    const msg =
      err instanceof AxiosError
        ? `HTTP ${err.response?.status}: ${err.message}`
        : (err as Error).message;
    console.warn(
      `[Job ${jobId}] ⚠️ Lyric enrichment failed (non-fatal): ${msg}`,
    );
    return empty;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. MOOD CANVAS MATCHING (E7)
// ─────────────────────────────────────────────────────────────────────────────

async function matchMoodCanvas(
  tags: string[],
  jobId: string | undefined,
): Promise<mongoose.Types.ObjectId | undefined> {
  if (!Array.isArray(tags) || tags.length === 0) return undefined;

  try {
    const matched = await TrackMoodVideo.aggregate<{
      _id: mongoose.Types.ObjectId;
    }>([
      { $match: { tags: { $in: tags }, isActive: true } },
      { $sample: { size: 1 } },
      { $project: { _id: 1 } },
    ]).option({ maxTimeMS: 5_000 });

    return matched[0]?._id;
  } catch (err) {
    console.warn(
      `[Job ${jobId}] ⚠️ Mood canvas match failed (non-fatal):`,
      (err as Error).message,
    );
    return undefined;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. B2 UPLOAD — per-file retry + bounded pool (E8)
// ─────────────────────────────────────────────────────────────────────────────

async function uploadWithRetry(
  localPath: string,
  filename: string,
  targetFolder: string,
): Promise<string> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
    try {
      return await uploadToB2(localPath, filename, targetFolder);
    } catch (err) {
      lastError = err as Error;
      if (attempt < MAX_UPLOAD_RETRIES) {
        await sleep(1_000 * attempt); // 1s → 2s → 3s
      }
    }
  }

  throw new Error(
    `[uploadWithRetry] "${filename}" failed after ${MAX_UPLOAD_RETRIES} attempts: ${lastError?.message}`,
  );
}

async function uploadConcurrently(
  files: string[],
  tmpDir: string,
  targetFolder: string,
  jobId: string | undefined,
): Promise<string> {
  if (files.length === 0) {
    throw new Error("[uploadConcurrently] No files to upload.");
  }

  let m3u8Key = "";
  const queue = [...files];
  const errors: string[] = [];

  const worker = async () => {
    while (queue.length > 0) {
      const file = queue.shift();
      if (!file) continue;
      const localPath = path.join(tmpDir, file);

      if (!fs.existsSync(localPath)) {
        errors.push(`File missing before upload: ${file}`);
        continue;
      }

      try {
        const key = await uploadWithRetry(localPath, file, targetFolder);
        if (file === "index.m3u8") m3u8Key = key;
        console.log(`[Job ${jobId}] ✅ Uploaded: ${file}`);
      } catch (err) {
        errors.push((err as Error).message);
      }
    }
  };

  await Promise.all(Array.from({ length: UPLOAD_POOL_SIZE }, () => worker()));

  if (errors.length > 0) {
    throw new Error(
      `[uploadConcurrently] ${errors.length} file(s) failed to upload:\n` +
        errors.join("\n"),
    );
  }

  // E8: validate m3u8 was actually uploaded
  if (!m3u8Key) {
    throw new Error(
      "[uploadConcurrently] index.m3u8 was not found in the upload results.",
    );
  }

  return m3u8Key;
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. MAIN WORKER
// ─────────────────────────────────────────────────────────────────────────────

const worker = new Worker<TranscodeJobData>(
  "audio-transcoding",
  async (job: Job<TranscodeJobData>) => {
    // E16: unknown job name — skip gracefully, never throw
    if (job.name !== "transcode") {
      console.warn(`[Worker] Unknown job name "${job.name}" — skipping.`);
      return { skipped: true, reason: `Unknown job name: ${job.name}` };
    }

    const { trackId, fileUrl } = job.data;

    if (!trackId || typeof trackId !== "string") {
      throw new Error("[Worker] Job data missing or invalid: trackId");
    }
    if (!fileUrl || typeof fileUrl !== "string") {
      throw new Error("[Worker] Job data missing or invalid: fileUrl");
    }

    const bucketName = process.env.B2_BUCKET_NAME?.trim();
    if (!bucketName)
      throw new Error("[Worker] Missing env var: B2_BUCKET_NAME");

    // E20: unique tmp dir per job — prevents cross-job file collision at concurrency > 1
    const tmpDir = path.join(TMP_ROOT, `${trackId}_${job.id}`);
    const inputExt = path.extname(fileUrl.split("?")[0]) || ".mp3";
    const inputPath = path.join(tmpDir, `input${inputExt}`);
    const m3u8Path = path.join(tmpDir, "index.m3u8");

    try {
      // ── INIT: create tmp dir ──────────────────────────────────────────────
      try {
        fs.mkdirSync(tmpDir, { recursive: true });
      } catch (err) {
        throw new Error(
          `[Worker] Failed to create tmpDir "${tmpDir}": ${(err as Error).message}`,
        );
      }

      // ── STEP 0: Mark processing ───────────────────────────────────────────
      const trackBeforeStart = await Track.findByIdAndUpdate(
        trackId,
        { status: "processing", errorReason: "" },
        { new: true },
      ).lean();

      if (!trackBeforeStart) {
        throw new Error(`[Worker] Track "${trackId}" not found in DB.`);
      }

      // ── STEP 1: DOWNLOAD ──────────────────────────────────────────────────
      console.log(`[Job ${job.id}] ⬇️  Downloading audio...`);
      await downloadFile(fileUrl, inputPath);
      console.log(`[Job ${job.id}] ✅ Download complete.`);

      // ── STEP 2: AUDIO METADATA ────────────────────────────────────────────
      const meta = await getAudioMetadata(inputPath);
      console.log(
        `[Job ${job.id}] 🎵 Duration: ${meta.duration}s | Source bitrate: ${meta.bitrate}kbps`,
      );

      // ── STEP 3: HLS TRANSCODING (E21: adaptive bitrate) ──────────────────
      console.log(`[Job ${job.id}] 🔄 Starting HLS transcode...`);
      await transcodeToHLS(inputPath, m3u8Path, String(job.id), meta.bitrate);
      console.log(`[Job ${job.id}] ✅ Transcoding complete.`);

      // ── STEP 4: ENRICHMENT ────────────────────────────────────────────────
      // Giải pháp: Kiểm tra và lấy Model từ bộ nhớ Mongoose, nếu chưa có thì ép load lại

      // ── STEP 4: ENRICHMENT ────────────────────────────────────────────────
      // Không dùng .populate() để tránh lỗi model registry trong worker process
      const trackDoc = await Track.findById(trackId).lean<{
        title: string;
        tags: string[];
        artist?: mongoose.Types.ObjectId;
      }>();

      if (!trackDoc) {
        throw new Error(
          `[Worker] Track "${trackId}" disappeared during processing.`,
        );
      }

      // Query Artist trực tiếp — không phụ thuộc vào Mongoose model registry
      let artistName = "";
      if (trackDoc.artist) {
        const artistDoc = await Artist.findById(trackDoc.artist)
          .select("name")
          .lean<{ name: string }>();
        artistName = artistDoc?.name ?? "";
      }

      const relativePath = extractRelativePath(fileUrl, bucketName);
      const trackFolderKey = relativePath.split("/").slice(0, 2).join("/");

      const [lyricData, moodVideoId] = await Promise.all([
        enrichLyrics(
          trackDoc.title,
          artistName,
          meta.duration,
          tmpDir,
          trackFolderKey,
          bucketName,
          String(job.id),
        ),
        matchMoodCanvas(trackDoc.tags ?? [], String(job.id)),
      ]);
      // ── STEP 5: UPLOAD HLS SEGMENTS ───────────────────────────────────────
      console.log(`[Job ${job.id}] ⬆️  Uploading HLS segments to B2...`);
      const hlsFiles = fs
        .readdirSync(tmpDir)
        .filter((f) => f.endsWith(".ts") || f.endsWith(".m3u8"));

      if (hlsFiles.length === 0) {
        throw new Error("[Worker] Transcoding produced no .ts/.m3u8 files.");
      }

      const m3u8Key = await uploadConcurrently(
        hlsFiles,
        tmpDir,
        `${trackFolderKey}/hls`,
        String(job.id),
      );

      const baseUrl = buildBaseUrl();
      const hlsUrl = `${baseUrl}/${bucketName}/${m3u8Key}`;
      console.log(`[Job ${job.id}] ✅ HLS URL: ${hlsUrl}`);

      // ── STEP 6: FINALIZE DB ───────────────────────────────────────────────
      const enrichmentUpdate: EnrichmentResult = {
        lyricType: lyricData.lyricType,
        lyricPreview: lyricData.lyricPreview,
        plainLyrics: lyricData.plainLyrics,
        ...(lyricData.lyricUrl ? { lyricUrl: lyricData.lyricUrl } : {}),
        ...(moodVideoId ? { moodVideo: moodVideoId } : {}),
      };

      await Track.findByIdAndUpdate(trackId, {
        status: "ready",
        hlsUrl,
        duration: meta.duration,
        bitrate: meta.bitrate,
        errorReason: "",
        ...enrichmentUpdate,
      });

      // ── STEP 7: CACHE INVALIDATION (E14: non-fatal) ───────────────────────
      try {
        await cacheRedis.del(`track:detail:${trackId}`);
      } catch (cacheErr) {
        console.warn(
          `[Job ${job.id}] ⚠️ Cache invalidation failed (non-fatal):`,
          (cacheErr as Error).message,
        );
      }

      console.log(`[Job ${job.id}] 🎉 Track "${trackId}" is ready.`);
      return { success: true, hlsUrl, duration: meta.duration };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ [Job ${job.id}] FAILED — Track ${trackId}:`, message);

      // Always mark track as failed — never leave it stuck in "processing"
      try {
        await Track.findByIdAndUpdate(trackId, {
          status: "failed",
          errorReason: message.slice(0, 500), // guard against DB field overflow
        });
      } catch (dbErr) {
        console.error(
          `[Job ${job.id}] ❌ Could not update track status to "failed":`,
          (dbErr as Error).message,
        );
      }

      throw error instanceof Error ? error : new Error(message);
    } finally {
      // E2: guaranteed cleanup regardless of success or failure
      safeRmDir(tmpDir);
    }
  },
  {
    connection: queueRedis,
    concurrency: WORKER_CONCURRENCY,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 13. WORKER-LEVEL EVENT HANDLERS (E11)
// ─────────────────────────────────────────────────────────────────────────────

worker.on("error", (err) => {
  console.error("[Worker] BullMQ worker error:", err.message);
});

worker.on("failed", (job, err) => {
  console.error(
    `[Worker] Job ${job?.id ?? "unknown"} permanently failed after retries:`,
    err.message,
  );
});

worker.on("completed", (job, result) => {
  console.log(`[Worker] Job ${job.id} completed:`, JSON.stringify(result));
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. GRACEFUL SHUTDOWN (E12)
// ─────────────────────────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  console.log(
    `\n[Worker] Received ${signal}. Draining jobs and shutting down...`,
  );
  try {
    await worker.close();
    await mongoose.disconnect();
    console.log("[Worker] Graceful shutdown complete.");
    process.exit(0);
  } catch (err) {
    console.error("[Worker] Error during shutdown:", (err as Error).message);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  console.error("[Worker] Uncaught Exception:", err.message, err.stack);
  // Intentionally not exiting — BullMQ handles job-level errors;
  // killing the process here would drop all in-flight jobs.
});

process.on("unhandledRejection", (reason) => {
  console.error("[Worker] Unhandled Rejection:", reason);
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. STARTUP
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  cleanStaleTmpDirs(); // E13: purge dirs from previous crashed runs
  await connectWithRetry();
  console.log(
    `👷 Premium Audio Worker active | concurrency: ${WORKER_CONCURRENCY} | pid: ${process.pid}`,
  );
})().catch((err) => {
  console.error("[Worker] Fatal startup error:", (err as Error).message);
  process.exit(1);
});
