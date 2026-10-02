import { useState, useEffect, useRef, useCallback } from "react";
import {
  attachHighlightSource,
  isAutoplayBlocked,
  type HighlightAttachment,
} from "@/features/player/utils/highlightAudio";

/**
 * Plays one highlight window [startTime, endTime].
 * HLS playlists go through hls.js. Seek runs only after the media is ready.
 */
export const useShortAudio = (
  src: string,
  startTime: number,
  endTime: number,
  isActive: boolean,
  onEnd?: () => void,
) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const attachmentRef = useRef<HighlightAttachment | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const activeRef = useRef(isActive);
  const onEndRef = useRef(onEnd);
  const startRef = useRef(startTime);
  const endRef = useRef(endTime);
  const readyRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  activeRef.current = isActive;
  onEndRef.current = onEnd;
  startRef.current = startTime;
  endRef.current = endTime;

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    return () => {
      attachmentRef.current?.destroy();
      attachmentRef.current = null;
      audio.pause();
      audioRef.current = null;
      playPromiseRef.current = null;
    };
  }, []);

  const playFromStart = useCallback(async () => {
    const audio = audioRef.current;
    const attachment = attachmentRef.current;
    if (!audio || !attachment || !activeRef.current) return;

    setIsLoading(true);
    try {
      await attachment.prime(startRef.current);
      if (!activeRef.current) return;
      const pending = audio.play();
      playPromiseRef.current = pending;
      await pending;
      if (!activeRef.current) {
        audio.pause();
        return;
      }
      setAutoplayBlocked(false);
      setIsPlaying(true);
      setIsLoading(false);
    } catch (err) {
      setIsPlaying(false);
      setIsLoading(false);
      playPromiseRef.current = null;
      if (isAutoplayBlocked(err)) {
        setAutoplayBlocked(true);
        return;
      }
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.warn("[ShortAudio] play error:", err);
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    attachmentRef.current?.destroy();
    readyRef.current = false;
    setProgress(0);
    setIsPlaying(false);
    setIsLoading(true);
    setAutoplayBlocked(false);
    playPromiseRef.current = null;

    const attachment = attachHighlightSource(audio, src);
    attachmentRef.current = attachment;
    let cancelled = false;

    attachment.whenReady
      .then(async () => {
        if (cancelled) return;
        readyRef.current = true;
        await attachment.prime(startRef.current);
        if (cancelled || !activeRef.current) {
          setIsLoading(false);
          return;
        }
        await playFromStart();
      })
      .catch(() => {
        if (!cancelled) {
          setIsLoading(false);
          setIsPlaying(false);
        }
      });

    return () => {
      cancelled = true;
      attachment.destroy();
      if (attachmentRef.current === attachment) attachmentRef.current = null;
    };
  }, [src, playFromStart]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!activeRef.current) return;
      const start = startRef.current;
      const end = endRef.current;
      const duration = end - start;
      if (duration <= 0) return;

      const rawProgress = ((audio.currentTime - start) / duration) * 100;
      setProgress(Math.max(0, Math.min(100, rawProgress)));

      if (audio.currentTime >= end) {
        if (onEndRef.current) {
          audio.pause();
          setIsPlaying(false);
          playPromiseRef.current = null;
          onEndRef.current();
        } else {
          audio.currentTime = start;
          playPromiseRef.current = audio.play().catch(() => {
            if (activeRef.current) setIsPlaying(false);
          });
        }
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setIsLoading(false);
      setAutoplayBlocked(false);
    };
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => {
      if (activeRef.current) setIsLoading(true);
    };
    const handleCanPlay = () => setIsLoading(false);
    const handleError = () => {
      setIsLoading(false);
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("error", handleError);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isActive) {
      setProgress(0);
      if (readyRef.current) {
        void playFromStart();
      }
      return;
    }

    const stopAudio = () => {
      const current = audioRef.current;
      if (!current) return;
      current.pause();
      if (readyRef.current && Number.isFinite(startRef.current)) {
        try {
          current.currentTime = startRef.current;
        } catch {
          /* metadata may not be ready yet */
        }
      }
      setProgress(0);
      setIsPlaying(false);
      setIsLoading(false);
      playPromiseRef.current = null;
    };

    if (playPromiseRef.current) {
      playPromiseRef.current.then(stopAudio).catch(stopAudio);
    } else {
      stopAudio();
    }
  }, [isActive, playFromStart]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setAutoplayBlocked(false);

    if (audio.paused) {
      void playFromStart();
      return;
    }

    if (playPromiseRef.current) {
      playPromiseRef.current.then(() => audio.pause()).catch(() => audio.pause());
    } else {
      audio.pause();
    }
  }, [playFromStart]);

  const seek = useCallback((percent: number) => {
    const audio = audioRef.current;
    if (!audio || !readyRef.current) return;
    const clampedPercent = Math.max(0, Math.min(100, percent));
    const duration = endRef.current - startRef.current;
    try {
      audio.currentTime = startRef.current + (clampedPercent / 100) * duration;
    } catch {
      /* ignore seek before the first fragment */
    }
    setProgress(clampedPercent);
  }, []);

  return { isPlaying, progress, isLoading, autoplayBlocked, togglePlay, seek };
};
