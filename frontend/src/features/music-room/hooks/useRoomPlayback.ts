// features/music-room/hooks/useRoomPlayback.ts
/**
 * Phát HLS của phòng theo đồng hồ server.
 * Vị trí = (Date.now() + offset - startedAt) / 1000.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useSelector } from "react-redux";
import Hls from "hls.js";
import { selectClockOffsetMs, selectPlaybackState } from "../store/roomSlice";
import type { PlaybackState } from "../types/room.types";

interface UseRoomPlaybackOptions {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  trackUrl?: string;
}

const SEEK_WHILE_PLAYING = 0.8;
const SEEK_WHILE_PAUSED = 0.3;

export const roomPositionSeconds = (
  playbackState: PlaybackState | null,
  clockOffsetMs: number,
  now = Date.now(),
) => {
  if (!playbackState?.currentTrackId) return 0;
  if (playbackState.isPaused) return playbackState.pausedAt ?? 0;
  if (!playbackState.startedAt) return 0;
  return Math.max(0, (now + clockOffsetMs - playbackState.startedAt) / 1000);
};

export const useRoomPlayback = ({ audioRef, trackUrl }: UseRoomPlaybackOptions) => {
  const playbackState = useSelector(selectPlaybackState);
  const clockOffsetMs = useSelector(selectClockOffsetMs);
  const lastSyncedTrackId = useRef<string | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [needsUnlock, setNeedsUnlock] = useState(false);

  const syncAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !playbackState?.currentTrackId) {
      audio?.pause();
      return;
    }

    const target = roomPositionSeconds(playbackState, clockOffsetMs);
    const threshold = playbackState.isPaused ? SEEK_WHILE_PAUSED : SEEK_WHILE_PLAYING;
    if (Number.isFinite(audio.duration) && audio.duration > 0 && target > audio.duration) {
      audio.currentTime = Math.max(0, audio.duration - 0.05);
    } else if (Math.abs(audio.currentTime - target) > threshold) {
      audio.currentTime = target;
    }

    if (playbackState.isPaused) {
      audio.pause();
      setNeedsUnlock(false);
      return;
    }

    if (audio.paused) {
      try {
        await audio.play();
        setNeedsUnlock(false);
      } catch {
        setNeedsUnlock(true);
      }
    }
  }, [audioRef, clockOffsetMs, playbackState]);

  const unlock = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.play();
      setNeedsUnlock(false);
      await syncAudio();
    } catch {
      setNeedsUnlock(true);
    }
  }, [audioRef, syncAudio]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const src = trackUrl;
    const trackId = playbackState?.currentTrackId ?? null;

    if (!src || !trackId) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      audio.removeAttribute("src");
      audio.load();
      lastSyncedTrackId.current = null;
      return;
    }

    if (trackId === lastSyncedTrackId.current && (hlsRef.current || audio.src)) {
      return;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    lastSyncedTrackId.current = trackId;
    const startAt = roomPositionSeconds(playbackState, clockOffsetMs);

    if (Hls.isSupported() && src.endsWith(".m3u8")) {
      const hls = new Hls({
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        enableWorker: true,
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 4,
        fragLoadingMaxRetry: 4,
        startPosition: startAt,
      });
      hls.loadSource(src);
      hls.attachMedia(audio);
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void syncAudio();
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        else hls.destroy();
      });
    } else {
      audio.src = src;
      audio.load();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // Re-attach only when the track source changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackUrl, playbackState?.currentTrackId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playbackState) return;
    const run = () => {
      void syncAudio();
    };
    if (audio.readyState >= 2) run();
    else audio.addEventListener("loadedmetadata", run, { once: true });
    return () => audio.removeEventListener("loadedmetadata", run);
  }, [audioRef, playbackState, syncAudio]);

  useEffect(() => {
    if (!playbackState || playbackState.isPaused) return;
    const timer = setInterval(() => {
      void syncAudio();
    }, 5_000);
    return () => clearInterval(timer);
  }, [playbackState, syncAudio]);

  return { playbackState, syncAudio, needsUnlock, unlock, clockOffsetMs };
};
