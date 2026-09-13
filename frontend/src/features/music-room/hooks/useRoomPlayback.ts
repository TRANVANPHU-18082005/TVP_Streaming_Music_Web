// features/music-room/hooks/useRoomPlayback.ts
/**
 * Hook sync playback audio với server clock.
 * Tính currentTime = (Date.now() - startedAt) / 1000
 * Không cần server push mỗi giây — client tự tính.
 */

import { useEffect, useRef, useCallback } from "react";
import { useSelector } from "react-redux";
import { selectPlaybackState } from "../store/roomSlice";

interface UseRoomPlaybackOptions {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  trackUrl?: string;
}

export const useRoomPlayback = ({ audioRef, trackUrl }: UseRoomPlaybackOptions) => {
  const playbackState = useSelector(selectPlaybackState);
  const lastSyncedTrackId = useRef<string | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Sync audio element với server playback state.
   * Gọi khi nhận được room:playback_update hoặc khi track thay đổi.
   */
  const syncAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !playbackState) return;

    const { startedAt, isPaused, pausedAt, currentTrackId } = playbackState;

    // Nếu không có bài nào đang phát
    if (!currentTrackId) {
      audio.pause();
      return;
    }

    if (isPaused) {
      // Seek đến vị trí pause và dừng
      if (Math.abs(audio.currentTime - pausedAt) > 1) {
        audio.currentTime = pausedAt;
      }
      audio.pause();
    } else if (startedAt) {
      // Tính thời điểm hiện tại dựa trên server clock
      const elapsedSeconds = (Date.now() - startedAt) / 1000;

      // Chỉ seek nếu lệch quá 2 giây (tránh jitter)
      if (Math.abs(audio.currentTime - elapsedSeconds) > 2) {
        audio.currentTime = Math.max(0, elapsedSeconds);
      }

      // Phát nếu đang pause
      if (audio.paused) {
        try {
          await audio.play();
        } catch {
          // Autoplay bị chặn → người dùng cần tương tác
        }
      }
    }
  }, [audioRef, playbackState]);

  // Sync khi playback state thay đổi
  useEffect(() => {
    if (!playbackState) return;

    const { currentTrackId } = playbackState;

    // Nếu bài thay đổi, cần load source mới
    if (currentTrackId !== lastSyncedTrackId.current && trackUrl) {
      const audio = audioRef.current;
      if (audio) {
        audio.src = trackUrl;
        audio.load();
        lastSyncedTrackId.current = currentTrackId;
      }
    }

    // Sync sau khi loadedmetadata hoặc ngay lập tức nếu đã có source
    const audio = audioRef.current;
    if (!audio) return;

    const doSync = () => syncAudio();

    // Bug 3 fix: track whether listener was added to ensure cleanup
    let listenerAdded = false;

    if (audio.readyState >= 2) {
      doSync();
    } else {
      audio.addEventListener("loadedmetadata", doSync, { once: true });
      listenerAdded = true;
    }

    return () => {
      // Luôn xóa listener nếu đã thêm (tránh memory leak)
      if (listenerAdded) {
        audio.removeEventListener("loadedmetadata", doSync);
      }
    };
  }, [playbackState, trackUrl, syncAudio]);

  // Drift correction: mỗi 10 giây resync một lần nếu đang phát
  useEffect(() => {
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);

    if (playbackState && !playbackState.isPaused) {
      syncIntervalRef.current = setInterval(() => {
        syncAudio();
      }, 10_000);
    }

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [playbackState, syncAudio]);

  return {
    playbackState,
    syncAudio,
  };
};
