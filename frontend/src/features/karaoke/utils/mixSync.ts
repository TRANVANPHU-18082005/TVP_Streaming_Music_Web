import axios from "axios";

export interface YoutubePlayerHandle {
  destroy: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  setVolume: (volume: number) => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
}

export interface KaraokeMixSettings {
  backingVolume: number;
  voiceVolume: number;
  syncOffsetMs: number;
  startAtSec: number;
}

export const SYNC_OFFSET_MIN_MS = -2000;
export const SYNC_OFFSET_MAX_MS = 2000;
export const SYNC_OFFSET_STEP_MS = 50;
export const SYNC_DRIFT_SEC = 0.25;

export const DEFAULT_SESSION_MIX: KaraokeMixSettings = {
  backingVolume: 100,
  voiceVolume: 100,
  syncOffsetMs: 0,
  startAtSec: 0,
};

export function clampSyncOffset(ms: number): number {
  const stepped = Math.round(ms / SYNC_OFFSET_STEP_MS) * SYNC_OFFSET_STEP_MS;
  return Math.min(SYNC_OFFSET_MAX_MS, Math.max(SYNC_OFFSET_MIN_MS, stepped));
}

/** Bản cũ không có field mix: phát full volume, không lệch, từ đầu video. */
export function mixFromRecording(recording: Partial<KaraokeMixSettings>): KaraokeMixSettings {
  return {
    backingVolume: recording.backingVolume ?? 100,
    voiceVolume: recording.voiceVolume ?? 100,
    syncOffsetMs: recording.syncOffsetMs ?? 0,
    startAtSec: recording.startAtSec ?? 0,
  };
}

/**
 * Thời điểm trong file giọng ứng với mốc YouTube.
 * syncOffsetMs dương làm giọng ra sau beat.
 */
export function voiceTimeForYoutube(ytTimeSec: number, mix: Pick<KaraokeMixSettings, "startAtSec" | "syncOffsetMs">): number {
  return ytTimeSec - mix.startAtSec - mix.syncOffsetMs / 1000;
}

export type VoiceSyncAction = "hold" | "play";

export function syncVoiceElement(
  audio: HTMLAudioElement,
  ytTimeSec: number,
  mix: Pick<KaraokeMixSettings, "startAtSec" | "syncOffsetMs">,
  options?: { force?: boolean },
): VoiceSyncAction {
  const target = voiceTimeForYoutube(ytTimeSec, mix);
  if (!Number.isFinite(target)) return "hold";

  const duration = audio.duration;
  const pastEnd = Number.isFinite(duration) && duration > 0 && target > duration + 0.05;
  if (target < 0 || pastEnd) {
    if (!audio.paused) audio.pause();
    return "hold";
  }

  const drift = Math.abs(audio.currentTime - target);
  if (options?.force || drift > SYNC_DRIFT_SEC) {
    audio.currentTime = target;
  }
  return "play";
}

export function readApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string }>(err)) {
    return err.response?.data?.message || fallback;
  }
  return fallback;
}

export function formatClock(secs: number): string {
  const safe = Math.max(0, Math.floor(secs));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function loadYoutubeIframeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();

  return new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });
}
