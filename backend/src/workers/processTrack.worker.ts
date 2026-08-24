// ─────────────────────────────────────────────────────────────────────────────
// workers/audio.worker.ts
// ─────────────────────────────────────────────────────────────────────────────
import { Worker, Job } from "bullmq";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import dotenv from "dotenv";
import config from "../config/env";
import { queueRedis, cacheRedis } from "../config/redis";
import Track from "../models/Track";
import Artist from "../models/Artist";

import {
  ProcessTrackJobData,
  KaraokeOutput,
  JobResult,
} from "../types/worker.types";

import {
  TMP_ROOT,
  cleanStaleTmpDirs,
  safeRmDir,
  calculateGeneratedFilesSize,
} from "../utils/fs.utils";
import { extractRelativePath, buildBaseUrl } from "../utils/url.utils";
import { connectWithRetry } from "../utils/db.utils";
import { CounterTrack } from "../utils/counter";

import { downloadFile } from "../services/audio/downloader.service";
import { getAudioMetadata } from "../services/audio/metadata.service";
import { transcodeToHLS } from "../services/audio/transcoder.service";
import { fetchLyrics } from "../services/lyrics/lrclib.service";
import { buildFinalLyricResult } from "../services/lyrics/lyric-builder.service";
import { uploadConcurrently } from "../services/upload/b2-upload.service";
import { invalidateTrackCache } from "../utils/cacheHelper";
import MoodVideoService from "../services/moodVideo.service";
import { toCdnUrl } from "../utils/url.utils";
import { AudioAnalysisService } from "../services/audio/audio-analysis.service";
import AiService from "../services/ai/ai.service";

const ffprobeStatic = require("ffprobe-static");
dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// STARTUP GUARDS
// ─────────────────────────────────────────────────────────────────────────────

if (!ffmpegPath) throw new Error("[Worker] ffmpeg-static binary not found.");
ffmpeg.setFfmpegPath(ffmpegPath);

if (!ffprobeStatic?.path)
  throw new Error("[Worker] ffprobe-static not found. Aborting.");
ffmpeg.setFfprobePath(ffprobeStatic.path);
console.log("✅ Worker Engine: FFmpeg & FFprobe are ready.");

const WORKER_CONCURRENCY = Number(config.workerConcurrency ?? 2);

// ─────────────────────────────────────────────────────────────────────────────
// STEP RUNNERS — mỗi function = 1 tác vụ độc lập, tái sử dụng được
// ─────────────────────────────────────────────────────────────────────────────

/** Chạy toàn bộ pipeline lyrics: LRCLIB → karaoke → upload 1 lần */
async function runLyricPipeline(
  trackId: string,
  trackTitle: string,
  artistName: string,
  duration: number,
  inputPath: string,
  tmpDir: string,
  trackFolderKey: string,
  bucketName: string,
  jobId: string,
) {
  const rawLyrics = await fetchLyrics(trackTitle, artistName, duration, jobId);
  console.log(
    `[Job ${jobId}] 🎵 LRCLIB: bestAvailable=${rawLyrics.bestAvailable} | plain=${rawLyrics.plainLyrics.length} chars`,
  );

  return buildFinalLyricResult(
    rawLyrics,
    trackTitle,
    tmpDir,
    trackFolderKey,
    bucketName,
    jobId,
  );
}

const worker = new Worker<ProcessTrackJobData>(
  "audio-transcoding",
  async (job: Job<ProcessTrackJobData>): Promise<JobResult> => {
    if (job.name !== "transcode") {
      console.warn(`[Worker] Unknown job name "${job.name}" — skipping.`);
      return {
        success: false,
        skipped: true,
        reason: `Unknown job name: ${job.name}`,
      };
    }

    const { trackId, fileUrl, type } = job.data;

    if (!trackId || typeof trackId !== "string")
      throw new Error("[Worker] Invalid: trackId");
    if (!fileUrl || typeof fileUrl !== "string")
      throw new Error("[Worker] Invalid: fileUrl");

    const bucketName = config.b2.bucketName?.trim();
    if (!bucketName)
      throw new Error("[Worker] Missing env var: B2_BUCKET_NAME");

    // ── Route flags ────────────────────────────────────────────────────────────
    const isCustom = type === "custom";
    const tasks = job.data.tasks || [];

    const doTranscode = type === "full" || type === "transcode_only" || (isCustom && tasks.includes("transcode"));
    const doLyrics = type === "full" || type === "lyric_only" || (isCustom && tasks.includes("lyrics"));
    // Karaoke is part of lyric fallback, but if we need a specific doKaraoke flag later it goes here.
    const doMood = type === "full" || type === "mood_only" || (isCustom && tasks.includes("mood"));
    const doAi = type === "full" || type === "ai_only" || (isCustom && tasks.includes("ai"));

    // Only transcode and lyrics tasks require downloading the audio
    const requiresAudio = doTranscode || doLyrics;

    const tmpDir = path.join(TMP_ROOT, `${trackId}_${job.id}`);
    const inputExt = path.extname(fileUrl.split("?")[0]) || ".mp3";
    const inputPath = path.join(tmpDir, `input${inputExt}`);
    const m3u8Path = path.join(tmpDir, "index.m3u8");

    try {
      fs.mkdirSync(tmpDir, { recursive: true });

      // ── STEP 0: Mark processing ────────────────────────────────────────────
      const trackBefore = await Track.findByIdAndUpdate(
        trackId,
        { status: "processing", errorReason: "" },
        { new: true },
      ).lean();
      if (!trackBefore)
        throw new Error(`[Worker] Track "${trackId}" not found in DB.`);

      // ── STEP 1: Download (bắt buộc với mọi type — cần file audio) ─────────
      // mood_only hoặc custom (chỉ có mood) không cần download vì không xử lý audio
      if (requiresAudio) {
        console.log(`[Job ${job.id}] ⬇️  Downloading audio [type=${type}]...`);
        await downloadFile(fileUrl, inputPath);
        console.log(`[Job ${job.id}] ✅ Download complete.`);
      }

      // ── STEP 2: Audio metadata ─────────────────────────────────────────────
      let meta = { duration: 0, bitrate: 0 };
      if (requiresAudio) {
        meta = await getAudioMetadata(inputPath);
        console.log(
          `[Job ${job.id}] 🎵 Duration: ${meta.duration}s | Bitrate: ${meta.bitrate}kbps`,
        );
      }
      const relativePath = extractRelativePath(fileUrl, bucketName);

      const trackFolderKey = relativePath.split("/").slice(0, 2).join("/");

      // ── STEP 3: HLS transcode ─────────────────────────────────────────────
      if (doTranscode) {
        console.log(`[Job ${job.id}] 🔄 Starting HLS transcode...`);
        // audio.worker.ts — STEP 3
        await transcodeToHLS(
          inputPath,
          m3u8Path,
          String(job.id),
          meta.bitrate,
          trackFolderKey,
        );
        console.log(`[Job ${job.id}] ✅ Transcoding complete.`);
      }

      // ── Fetch track + artist (cần cho lyrics và mood) ─────────────────────
      const trackDoc = await Track.findById(trackId).lean<{
        title: string;
        tags: string[];
        plainLyrics?: string;
        artist?: mongoose.Types.ObjectId;
      }>();
      if (!trackDoc)
        throw new Error(`[Worker] Track "${trackId}" disappeared.`);

      let artistName = "";
      if (trackDoc.artist) {
        const artistDoc = await Artist.findById(trackDoc.artist)
          .select("name")
          .lean<{ name: string }>();
        artistName = artistDoc?.name ?? "";
      }

      // ── STEP 4 & 5: Lyrics pipeline ───────────────────────────────────────
      let finalLyricType: string | undefined;
      let finalLyricUrl: string | undefined;
      let finalLyricPreview: any[] = [];
      let finalPlainLyrics: string = "";
      console.log(
        `[Job ${job.id}] ℹ️ artistName: ${artistName} — track: ${trackDoc.title} - durion: ${meta.duration}.`,
      );
      if (doLyrics) {
        // full hoặc lyric_only → chạy toàn bộ LRCLIB
        try {
          const result = await runLyricPipeline(
            trackId,
            trackDoc.title,
            artistName,
            meta.duration,
            inputPath,
            tmpDir,
            trackFolderKey,
            bucketName,
            String(job.id),
          );
          finalLyricType = result.finalLyricType;
          finalLyricUrl = result.finalLyricUrl;
          finalLyricPreview = result.finalLyricPreview;
          finalPlainLyrics = result.finalPlainLyrics;
        } catch (lyricErr: any) {
          console.error(`[Job ${job.id}] ⚠️ Lyrics pipeline failed (non-blocking for full):`, lyricErr.message);
          if (type === "lyric_only" || (isCustom && tasks.includes("lyrics"))) {
            throw lyricErr; // Throw to trigger BullMQ auto-retry and mark track as failed
          }
        }
      }


      // ── STEP 7: Upload HLS segments (chỉ khi có transcode) ───────────────
      let hlsUrl = (trackBefore as any).hlsUrl ?? "";
      let generatedBytes = 0;

      if (doTranscode) {
        console.log(`[Job ${job.id}] ⬆️  Uploading HLS segments...`);
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
        hlsUrl = `${baseUrl}/${bucketName}/${m3u8Key}`;
        console.log(`[Job ${job.id}] ✅ HLS URL: ${hlsUrl}`);
      }

      generatedBytes = calculateGeneratedFilesSize(tmpDir);
      console.log(
        `[Job ${job.id}] 📊 Generated: ${(generatedBytes / 1024 / 1024).toFixed(2)} MB`,
      );

      // ── STEP 7: Run Audio Analysis & AI Metadata Extraction ────────────────
      if (doAi) {
        try {
          let audioAnalysis = null;
          if (requiresAudio) {
            console.log(`[Job ${job.id}] 🎶 Starting Audio Analysis (BPM/Energy) for ${trackId}`);
            audioAnalysis = await AudioAnalysisService.analyzeAudio(inputPath);
          } else {
            console.log(`[Job ${job.id}] ⏭️ Skipping Audio Analysis (BPM/Energy) to save bandwidth.`);
          }

          console.log(`[Job ${job.id}] 🤖 Starting AI Metadata Analysis for ${trackId}`);
          await AiService.analyzeTrack(trackId);

          if (audioAnalysis) {
            await Track.findByIdAndUpdate(trackId, {
              "aiMetadata.energy": audioAnalysis.energy,
              "aiMetadata.tempo": audioAnalysis.tempo
            });
          }
        } catch (analyzeErr: any) {
          console.error(`[Job ${job.id}] ⚠️ Metadata analysis failed (non-blocking for full):`, analyzeErr.message);
          if (type === "ai_only" || (isCustom && tasks.includes("ai"))) {
            throw analyzeErr; // Throw to trigger BullMQ auto-retry and mark track as failed
          }
        }
      }

      // ── STEP 8: Mood canvas ────────────────────────────────────────────────
      // Fetch lại track để lấy aiMetadata mới nhất
      const updatedTrackDoc = await Track.findById(trackId).lean<any>();
      let moodVideoId: mongoose.Types.ObjectId | undefined;

      if (doMood) {
        console.log(`[Job ${job.id}] 🎨 Matching mood canvas...`);
        moodVideoId = await MoodVideoService.matchMoodCanvas(
          updatedTrackDoc?.tags ?? [],
          updatedTrackDoc?.aiMetadata?.moods ?? [],
          String(job.id),
        );
      }

      // mood_only hoặc custom chỉ có mood: cập nhật moodVideo rồi xong
      if (!requiresAudio) {
        await Track.findByIdAndUpdate(trackId, {
          status: "ready",
          errorReason: "",
          ...(moodVideoId ? { moodVideo: moodVideoId } : {}),
        });
        await cacheRedis.del(`track:detail:${trackId}`).catch(() => { });
        console.log(`[Job ${job.id}] ✅ mood_only/custom mood done.`);
        return { success: true, lyricType: undefined };
      }

      // ── STEP 9: Finalize DB ────────────────────────────────────────────────
      const currentTrack = await Track.findById(trackId)
        .select("fileSize")
        .lean();
      const originalSize = (currentTrack as any)?.fileSize ?? 0;

      // Build update payload — chỉ set field nào thực sự được xử lý trong job này
      const dbUpdate: Record<string, any> = {
        status: "ready",
        errorReason: "",
      };

      if (doTranscode) {
        dbUpdate.hlsUrl = toCdnUrl(hlsUrl);
        dbUpdate.duration = meta.duration;
        dbUpdate.bitrate = meta.bitrate;
        dbUpdate.fileSize = originalSize + generatedBytes;
      }

      if (doLyrics) {
        if (finalLyricType) dbUpdate.lyricType = finalLyricType;
        if (finalLyricUrl) dbUpdate.lyricUrl = toCdnUrl(finalLyricUrl);
        if (finalLyricPreview) dbUpdate.lyricPreview = finalLyricPreview;
        if (finalPlainLyrics) dbUpdate.plainLyrics = finalPlainLyrics;
      }

      if (moodVideoId) dbUpdate.moodVideo = moodVideoId;

      await Track.findByIdAndUpdate(trackId, dbUpdate);

      if (generatedBytes > 0) {
        await CounterTrack.increment(generatedBytes, "audio/mpeg").catch(
          () => { },
        );
      }

      // ── STEP 9: Cache invalidation ────────────────────────────────────────
      await invalidateTrackCache(trackId).catch((err) => {
        console.warn(
          `[Job ${job.id}] ⚠️ Cache invalidation failed:`,
          err.message,
        );
      });

      console.log(
        `[Job ${job.id}] 🎉 Track "${trackId}" ready | type=${type} | lyric=${finalLyricType ?? "unchanged"} | hls=${hlsUrl || "unchanged"}`,
      );

      return {
        success: true,
        hlsUrl: hlsUrl || undefined,
        duration: meta.duration || undefined,
        lyricType: finalLyricType as any,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `❌ [Job ${job.id}] FAILED [type=${type}] — Track ${trackId}:`,
        message,
      );

      try {
        await Track.findByIdAndUpdate(trackId, {
          status: "failed",
          errorReason: message.slice(0, 500),
        });
      } catch (dbErr) {
        console.error(
          `[Job ${job.id}] ❌ Could not update track status to "failed":`,
          (dbErr as Error).message,
        );
      }

      throw error instanceof Error ? error : new Error(message);
    } finally {
      safeRmDir(tmpDir);
    }
  },
  {
    connection: queueRedis,
    concurrency: WORKER_CONCURRENCY,
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// WORKER-LEVEL EVENT HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

worker.on("error", (err) =>
  console.error("[Worker] BullMQ error:", err.message),
);
worker.on("failed", (job, err) =>
  console.error(
    `[Worker] Job ${job?.id ?? "?"} permanently failed:`,
    err.message,
  ),
);
worker.on("completed", (job, result) =>
  console.log(`[Worker] Job ${job.id} completed:`, JSON.stringify(result)),
);

// ─────────────────────────────────────────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Worker] ${signal} received — draining...`);
  try {
    await worker.close();
    await mongoose.disconnect();
    console.log("[Worker] Graceful shutdown complete.");
    process.exit(0);
  } catch (err) {
    console.error("[Worker] Shutdown error:", (err as Error).message);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (err) =>
  console.error("[Worker] Uncaught Exception:", err.message, err.stack),
);
process.on("unhandledRejection", (reason) =>
  console.error("[Worker] Unhandled Rejection:", reason),
);

// ─────────────────────────────────────────────────────────────────────────────
// STARTUP
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  cleanStaleTmpDirs();
  await connectWithRetry();
  console.log(
    `👷 Audio Worker | concurrency: ${WORKER_CONCURRENCY} | pid: ${process.pid}`,
  );
})().catch((err) => {
  console.error("[Worker] Fatal startup error:", (err as Error).message);
  process.exit(1);
});
