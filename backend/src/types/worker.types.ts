// ─────────────────────────────────────────────────────────────────────────────
// types/worker.types.ts
// ─────────────────────────────────────────────────────────────────────────────

export type TrackProcessingType =
  | "full" // download → transcode → lyrics → karaoke → mood → upload
  | "transcode_only" // chỉ HLS
  | "lyric_only" // chỉ LRCLIB + karaoke fallback chain
  | "karaoke_only" // chỉ forced alignment (plainLyrics đã có trong DB)
  | "mood_only"; // chỉ match mood canvas (không cần download)

export interface ProcessTrackJobData {
  trackId: string;
  fileUrl: string;
  type: TrackProcessingType;
}

export type LyricType = "none" | "plain" | "synced" | "karaoke";

export interface LyricLine {
  startTime: number;
  endTime: number;
  text: string;
}

export interface KaraokeLine {
  text: string;
  start: number;
  end: number;
  words: { word: string; startTime: number; endTime: number }[];
}

export interface KaraokeOutput {
  type: "karaoke";
  lines: KaraokeLine[];
}

/**
 * Raw in-memory lyric data từ LRCLIB — chưa upload lên B2.
 * Upload xảy ra đúng 1 lần trong buildFinalLyricResult().
 */
export interface RawLyricData {
  bestAvailable: "none" | "plain" | "synced";
  syncedLines: LyricLine[];
  plainLyrics: string;
}

export interface AudioMeta {
  duration: number; // seconds
  bitrate: number; // kbps
}

export interface JobResult {
  success: boolean;
  hlsUrl?: string;
  duration?: number;
  lyricType?: LyricType;
  skipped?: boolean;
  reason?: string;
}

export interface FinalLyricResult {
  finalLyricType: LyricType;
  finalLyricUrl: string | undefined;
  finalLyricPreview: LyricLine[];
  finalPlainLyrics: string;
}
