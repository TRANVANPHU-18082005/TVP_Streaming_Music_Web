import fs from "fs";
import path from "path";
import {
  KaraokeOutput,
  RawLyricData,
  LyricLine,
  LyricType,
  FinalLyricResult,
} from "../../types/worker.types";
import { plainTextToLyricLines } from "./lrc-parser";
import { uploadWithRetry } from "../upload/b2-upload.service";
import { buildBaseUrl } from "../../utils/url.utils";
import { deleteFolderFromB2 } from "../../utils/fileCleanup";

const LYRIC_PREVIEW_LIMIT = 5;
const MAX_LYRIC_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Serialise a lyric payload → size-guard (with truncation fallback) →
 * write to disk → upload to B2 → return URL.
 *
 * Returns null on upload failure or if payload is unrecoverably too large.
 * Never throws — callers fall through to the next tier on null.
 */
async function writeAndUpload(
  payload: object,
  filename: string,
  label: string,
  tmpDir: string,
  trackFolderKey: string,
  bucketName: string,
  baseUrl: string,
  jobId: string | undefined,
): Promise<string | null> {
  let json = JSON.stringify(payload);

  if (Buffer.byteLength(json) > MAX_LYRIC_BYTES) {
    console.warn(
      `[Job ${jobId}] ⚠️ ${label} payload > 2 MB — attempting truncation.`,
    );
    const obj = payload as any;
    if (Array.isArray(obj.lines) && obj.lines.length > 0) {
      const maxLines = Math.floor(obj.lines.length * 0.6); // keep 60%
      obj.lines = obj.lines.slice(0, maxLines);
      json = JSON.stringify(obj);
      if (Buffer.byteLength(json) > MAX_LYRIC_BYTES) {
        console.warn(
          `[Job ${jobId}] ⚠️ ${label} still > 2 MB after truncation — skipping upload.`,
        );
        return null;
      }
      console.log(
        `[Job ${jobId}] ℹ️ ${label} truncated to ${obj.lines.length} lines.`,
      );
    } else {
      return null;
    }
  }

  const localPath = path.join(tmpDir, filename);
  try {
    await fs.promises.writeFile(localPath, json, "utf8");
    const key = await uploadWithRetry(
      localPath,
      filename,
      `${trackFolderKey}/lyrics`,
    );
    return `${baseUrl}/${bucketName}/${key}`;
  } catch (err) {
    console.warn(
      `[Job ${jobId}] ⚠️ ${label} upload failed: ${(err as Error).message}`,
    );
    return null; // caller will fall through to next tier
  }
}

/**
 * Determine the best available lyric tier, upload the payload exactly once,
 * and return the final lyric metadata for DB persistence.
 *
 * Tier priority: karaoke → synced → plain → none
 * On upload failure for a tier: falls through to the tier below.
 */
export async function buildFinalLyricResult(
  raw: RawLyricData,
  karaokeData: KaraokeOutput | null,
  trackTitle: string,
  tmpDir: string,
  trackFolderKey: string,
  bucketName: string,
  jobId: string | undefined,
): Promise<FinalLyricResult> {
  const baseUrl = buildBaseUrl();

  // Convenience wrapper that binds shared args
  const upload = (payload: object, filename: string, label: string) =>
    writeAndUpload(
      payload,
      filename,
      label,
      tmpDir,
      trackFolderKey,
      bucketName,
      baseUrl,
      jobId,
    );
  // --- BƯỚC MỚI: DỌN DẸP TRƯỚC KHI TẠO ---
  // Thư mục cần dọn: "tracks/ten-bai-hat-123/lyrics/"
  const lyricFolderPrefix = `${trackFolderKey}/lyrics/`;
  try {
    // Gọi hàm dọn dẹp folder bạn vừa cung cấp
    await deleteFolderFromB2(lyricFolderPrefix);
    console.log(
      `[Job ${jobId}] 🧹 Pre-processing: Cleaned lyric folder to prevent storage bloat.`,
    );
  } catch (err) {
    // Chỉ log lỗi, không chặn luồng chính
    console.warn(`[Job ${jobId}] ⚠️ Minor: Failed to clear old lyrics folder.`);
  }
  // ── Tier 1: Karaoke ─────────────────────────────────────────────────────────
  if (karaokeData && karaokeData.lines.length > 0) {
    const karaokeUrl = await upload(
      { type: "karaoke", lines: karaokeData.lines },
      "karaoke.json",
      "Karaoke",
    );

    if (karaokeUrl) {
      console.log(
        `[Job ${jobId}] 🎤 Final lyric type: karaoke (Uploaded to B2)`,
      );
      return {
        finalLyricType: "karaoke",
        finalLyricUrl: karaokeUrl,
        finalLyricPreview: karaokeData.lines
          .slice(0, LYRIC_PREVIEW_LIMIT)
          .map((l) => ({
            startTime: l.start,
            endTime: l.end,
            text: l.text,
          })),
        finalPlainLyrics: raw.plainLyrics,
      };
    }
    console.warn(
      `[Job ${jobId}] ⚠️ Karaoke tier failed — falling through to synced.`,
    );
  }

  // ── Tier 2: Synced (Lời chạy theo dòng - Upload lên B2) ─────────────────────
  if (raw.plainLyrics.length > 0) {
    const syncedUrl = await upload(
      { type: "synced", lines: raw.syncedLines },
      "lyrics_synced.json",
      "Synced",
    );

    if (syncedUrl) {
      console.log(
        `[Job ${jobId}] 🎵 Final lyric type: synced (Uploaded to B2)`,
      );
      return {
        finalLyricType: "synced",
        finalLyricUrl: syncedUrl,
        finalLyricPreview: raw.syncedLines.slice(0, LYRIC_PREVIEW_LIMIT),
        finalPlainLyrics: raw.plainLyrics,
      };
    }
  }

  // ── Tier 3: Plain (Lời văn bản thuần - KHÔNG upload, dùng DB) ──────────────
  if (raw.plainLyrics.trim().length > 0) {
    console.log(`[Job ${jobId}] 📄 Final lyric type: plain (Saved to DB only)`);

    // Tạo preview từ plain text để hiển thị nhanh ở danh sách
    const previewLines = plainTextToLyricLines(
      raw.plainLyrics.slice(0, 1000),
    ).slice(0, LYRIC_PREVIEW_LIMIT);

    return {
      finalLyricType: "plain",
      finalLyricUrl: undefined, // Không có URL trên B2
      finalLyricPreview: previewLines,
      finalPlainLyrics: raw.plainLyrics,
    };
  }

  // ── Tier 4: None ────────────────────────────────────────────────────────────
  console.log(`[Job ${jobId}] ℹ️ Final lyric type: none`);
  return {
    finalLyricType: "none",
    finalLyricUrl: undefined,
    finalLyricPreview: [],
    finalPlainLyrics: "",
  };
}
