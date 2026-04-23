// ─────────────────────────────────────────────────────────────────────────────
// services/track-job.service.ts
//
// Trung tâm điều phối tất cả tác vụ xử lý track.
// Mọi nơi (controller, service khác) chỉ gọi vào đây — không gọi audioQueue trực tiếp.
// ─────────────────────────────────────────────────────────────────────────────
import httpStatus from "http-status";
import Track from "../models/Track";
import { cacheRedis } from "../config/redis";
import { deleteFolderFromB2 } from "../utils/fileCleanup";
import ApiError from "../utils/ApiError";
import {
  addFullProcessJob,
  addRetryKaraokeJob,
  addRetryLyricJob,
  addRetryMoodJob,
  addRetryTranscodeJob,
} from "../queue/processTrack.queue";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getTrackFolderKey(trackUrl: string): string | null {
  try {
    const bucketName = process.env.B2_BUCKET_NAME ?? "";
    const marker = `${bucketName}/`;
    const idx = trackUrl.indexOf(marker);
    if (idx === -1) return null;
    const relative = trackUrl.slice(idx + marker.length);
    const parts = relative.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  } catch {
    return null;
  }
}

/** Guard chung: track phải tồn tại, không bị xoá mềm, không đang processing */
async function guardTrack(trackId: string) {
  const track = await Track.findById(trackId);
  if (!track || track.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "Track not found");
  }
  if (track.status === "processing") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Track đang được xử lý, vui lòng đợi.",
    );
  }
  return track;
}

async function invalidateCache(trackId: string): Promise<void> {
  await cacheRedis.del(`track:detail:${trackId}`).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Xử lý track mới — full pipeline.
 * Gọi từ: TrackService.createTrack() sau khi save thành công.
 */
export async function processNewTrack(
  trackId: string,
  fileUrl: string,
): Promise<void> {
  await addFullProcessJob(trackId, fileUrl);
}

/**
 * Retry toàn bộ pipeline (full).
 * Xoá HLS + lyrics cũ trên B2 → reset status → queue job mới.
 */
export async function retryFullPipeline(trackId: string) {
  const track = await guardTrack(trackId);
  const folder = getTrackFolderKey(track.trackUrl);

  if (folder) {
    await Promise.allSettled([
      deleteFolderFromB2(`${folder}/hls/`),
      deleteFolderFromB2(`${folder}/lyrics/`),
    ]);
  }

  track.status = "pending";
  track.errorReason = "";
  track.hlsUrl = "";
  track.lyricType = "none";
  track.lyricUrl = undefined;
  track.lyricPreview = [];
  track.plainLyrics = "";
  await track.save();

  await addFullProcessJob(track._id.toString(), track.trackUrl);
  await invalidateCache(trackId);
  return track;
}

/**
 * Retry chỉ HLS transcode — lyrics và mood giữ nguyên.
 * Dùng khi: HLS URL hỏng, segments corrupt, user báo không phát được.
 */
export async function retryTranscode(trackId: string) {
  const track = await guardTrack(trackId);
  const folder = getTrackFolderKey(track.trackUrl);

  if (folder) {
    deleteFolderFromB2(`${folder}/hls/`).catch(console.error);
  }

  track.status = "pending";
  track.errorReason = "";
  track.hlsUrl = "";
  await track.save();

  await addRetryTranscodeJob(track._id.toString(), track.trackUrl);
  await invalidateCache(trackId);
  return track;
}

/**
 * Retry lyrics từ đầu — xoá lyrics cũ, chạy lại LRCLIB + karaoke fallback chain.
 * Dùng khi: lyricType = none/plain, hoặc lyrics sai nội dung.
 */
export async function retryLyrics(trackId: string) {
  const track = await guardTrack(trackId);

  if (!track.trackUrl) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Track không có fileUrl — không thể retry lyrics.",
    );
  }

  const folder = getTrackFolderKey(track.trackUrl);
  if (folder) {
    deleteFolderFromB2(`${folder}/lyrics/`).catch(console.error);
  }

  track.status = "pending";
  track.errorReason = "";
  track.lyricType = "none";
  track.lyricUrl = undefined;
  track.lyricPreview = [];
  track.plainLyrics = "";
  await track.save();

  await addRetryLyricJob(track._id.toString(), track.trackUrl);
  await invalidateCache(trackId);
  return track;
}

/**
 * Retry chỉ forced alignment (karaoke).
 * Guard: phải có plainLyrics trong DB và lyricType chưa phải karaoke.
 * Dùng khi: đang synced, muốn nâng cấp lên karaoke sau khi aligner sửa.
 */
export async function retryKaraoke(trackId: string) {
  const track = await guardTrack(trackId);

  if (!track.plainLyrics?.trim()) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Track chưa có plainLyrics — hãy retry lyrics trước.",
    );
  }

  if (track.lyricType === "karaoke") {
    throw new ApiError(
      httpStatus.CONFLICT,
      "Track đã có karaoke, không cần retry.",
    );
  }

  // Chỉ xoá karaoke.json cũ nếu có, không xoá lyrics.json
  const folder = getTrackFolderKey(track.trackUrl);
  if (folder) {
    deleteFolderFromB2(`${folder}/lyrics/karaoke.json`).catch(() => {});
  }

  track.status = "pending";
  track.errorReason = "";
  await track.save();

  await addRetryKaraokeJob(track._id.toString(), track.trackUrl);
  await invalidateCache(trackId);
  return track;
}

/**
 * Retry mood canvas matching.
 * Không cần download audio → nhanh nhất trong các loại retry.
 * Dùng khi: tags thay đổi, moodVideo hiển thị sai.
 */
export async function retryMoodCanvas(trackId: string) {
  const track = await guardTrack(trackId);

  track.status = "pending";
  track.errorReason = "";
  await track.save();

  await addRetryMoodJob(track._id.toString(), track.trackUrl);
  await invalidateCache(trackId);
  return track;
}
