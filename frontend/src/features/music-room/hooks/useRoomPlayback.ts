// features/music-room/hooks/useRoomPlayback.ts
/**
 * Phát HLS của phòng theo đồng hồ server.
 * Vị trí = (Date.now() + offset - startedAt) / 1000.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useSelector } from "react-redux";
import Hls from "hls.js";
import { createHls, isHlsSource } from "@/features/player/utils/hlsProfile";
import {
  acquirePlayback,
  bindPlaybackOwner,
  releasePlayback,
} from "@/features/player/utils/playbackSession";
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
  const waitingRef = useRef(false);
  const suspendedRef = useRef(false);
  const playbackRef = useRef(playbackState);
  const clockRef = useRef(clockOffsetMs);
  const suspendSelfRef = useRef<() => void>(() => undefined);
  playbackRef.current = playbackState;
  clockRef.current = clockOffsetMs;
  const [needsUnlock, setNeedsUnlock] = useState(false);

  const syncAudio = useCallback(async () => {
    const audio = audioRef.current;
    const state = playbackRef.current;
    const offset = clockRef.current;
    if (!audio || !state?.currentTrackId || suspendedRef.current) {
      if (!state?.currentTrackId) audio?.pause();
      return;
    }
    if (audio.readyState < 2 || audio.seeking) return;
    if (waitingRef.current && !state.isPaused) return;

    const target = roomPositionSeconds(state, offset);
    const threshold = state.isPaused ? SEEK_WHILE_PAUSED : SEEK_WHILE_PLAYING;
    if (Number.isFinite(audio.duration) && audio.duration > 0 && target > audio.duration) {
      audio.currentTime = Math.max(0, audio.duration - 0.05);
    } else if (Math.abs(audio.currentTime - target) > threshold) {
      audio.currentTime = target;
    }

    if (state.isPaused) {
      audio.pause();
      setNeedsUnlock(false);
      return;
    }

    if (audio.paused) {
      try {
        acquirePlayback("room", suspendSelfRef.current);
        await audio.play();
        setNeedsUnlock(false);
      } catch {
        setNeedsUnlock(true);
      }
    }
  }, [audioRef]);

  const unlock = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    suspendedRef.current = false;
    try {
      acquirePlayback("room", suspendSelfRef.current);
      if (hlsRef.current) {
        hlsRef.current.startLoad(Number.isFinite(audio.currentTime) ? audio.currentTime : -1);
      }
      await audio.play();
      setNeedsUnlock(false);
      await syncAudio();
    } catch {
      setNeedsUnlock(true);
    }
  }, [audioRef, syncAudio]);

  useEffect(() => {
    const suspend = () => {
      suspendedRef.current = true;
      waitingRef.current = false;
      audioRef.current?.pause();
      hlsRef.current?.stopLoad();
      setNeedsUnlock(true);
    };
    suspendSelfRef.current = suspend;
    return bindPlaybackOwner("room", suspend);
  }, [audioRef]);

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

    if (Hls.isSupported() && isHlsSource(src)) {
      const hls = createHls("room", { startPosition: startAt });
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
    if (!audio) return;
    const onWaiting = () => {
      waitingRef.current = true;
    };
    const onReady = () => {
      waitingRef.current = false;
      void syncAudio();
    };
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("loadeddata", onReady);
    audio.addEventListener("canplay", onReady);
    return () => {
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("loadeddata", onReady);
      audio.removeEventListener("canplay", onReady);
    };
  }, [audioRef, trackUrl, syncAudio]);

  const syncKey = [
    playbackState?.currentTrackId ?? "",
    playbackState?.isPaused ? "1" : "0",
    playbackState?.startedAt ?? "",
    playbackState?.pausedAt ?? "",
    clockOffsetMs,
  ].join("|");

  useEffect(() => {
    if (!playbackRef.current) return;
    void syncAudio();
  }, [syncKey, syncAudio]);

  useEffect(() => {
    if (!playbackState?.currentTrackId || playbackState.isPaused || suspendedRef.current) {
      if (!playbackState?.currentTrackId || playbackState?.isPaused) {
        releasePlayback("room", suspendSelfRef.current);
      }
      return;
    }
    const timer = setInterval(() => {
      void syncAudio();
    }, 5_000);
    return () => clearInterval(timer);
  }, [playbackState?.currentTrackId, playbackState?.isPaused, syncAudio]);

  return { playbackState, syncAudio, needsUnlock, unlock, clockOffsetMs };
};
