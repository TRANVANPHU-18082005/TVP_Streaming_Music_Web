import { useState, useRef, useEffect, useCallback } from "react";
import { IMashupShort } from "../types";
import {
  attachHighlightSource,
  type HighlightAttachment,
} from "@/features/player/utils/highlightAudio";

const clipWindow = (item: IMashupShort) => {
  const start = item.trimStart ?? item.short.startTime ?? 0;
  const end = item.trimEnd ?? item.short.endTime ?? start;
  return { start, end: Math.max(end, start) };
};

export const useMashupPreview = (shorts: IMashupShort[]) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const attachmentsRef = useRef<HighlightAttachment[]>([]);
  const cancelRef = useRef(false);
  const playingRef = useRef(false);

  const cleanup = useCallback(() => {
    cancelRef.current = true;
    playingRef.current = false;
    attachmentsRef.current.forEach((item) => item.destroy());
    attachmentsRef.current = [];
    setIsPlaying(false);
    setCurrentIndex(-1);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const playSequence = useCallback(async () => {
    if (shorts.length === 0) return;
    cleanup();
    cancelRef.current = false;
    playingRef.current = true;
    setIsPlaying(true);

    for (let index = 0; index < shorts.length; index++) {
      if (cancelRef.current) return;
      const item = shorts[index];
      const src = item.short.track?.hlsUrl || item.short.track?.trackUrl || "";
      if (!src) continue;

      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.preload = "auto";
      const attachment = attachHighlightSource(audio, src);
      attachmentsRef.current.push(attachment);

      const { start, end } = clipWindow(item);
      const volume = item.volume ?? 1;
      const transitionMs = Math.max(100, item.transitionDuration ?? 2000);
      setCurrentIndex(index);

      try {
        await attachment.prime(start);
        if (cancelRef.current) return;
        audio.volume = 0;
        await audio.play();
        const fadeSteps = 12;
        const fadeStepMs = Math.min(80, transitionMs / fadeSteps);
        for (let step = 1; step <= fadeSteps; step++) {
          if (cancelRef.current) return;
          audio.volume = Math.min(volume, (volume * step) / fadeSteps);
          await new Promise((resolve) => setTimeout(resolve, fadeStepMs));
        }
        const holdMs = Math.max(200, (end - start) * 1000 - transitionMs);
        await new Promise((resolve) => setTimeout(resolve, holdMs));
        if (cancelRef.current) return;
        for (let step = fadeSteps; step >= 0; step--) {
          if (cancelRef.current) return;
          audio.volume = Math.max(0, (volume * step) / fadeSteps);
          await new Promise((resolve) => setTimeout(resolve, fadeStepMs));
        }
        audio.pause();
      } catch (err) {
        console.warn("[MashupPreview] play error:", err);
        audio.pause();
      }
    }

    if (!cancelRef.current) {
      playingRef.current = false;
      setIsPlaying(false);
      setCurrentIndex(-1);
    }
  }, [shorts, cleanup]);

  const togglePlay = () => {
    if (playingRef.current) {
      cleanup();
    } else {
      void playSequence();
    }
  };

  return {
    isPlaying,
    currentIndex,
    togglePlay,
    stop: cleanup,
  };
};
