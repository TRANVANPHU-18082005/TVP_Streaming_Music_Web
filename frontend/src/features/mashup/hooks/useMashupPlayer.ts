import { useState, useEffect, useRef, useCallback } from "react";
import { IMashup } from "../types";

/**
 * useMashupPlayer — Production-grade mashup playback engine
 *
 * Dùng Web Audio API để crossfade mượt giữa các shorts.
 * Fix race condition: play() Promise tracking, hard stop, activeRef.
 */
export const useMashupPlayer = (mashup: IMashup | null, shouldPlay: boolean) => {
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const audiosRef      = useRef<HTMLAudioElement[]>([]);
  const gainNodesRef   = useRef<GainNode[]>([]);
  const sourceNodesRef = useRef<MediaElementAudioSourceNode[]>([]);
  const playPromisesRef = useRef<(Promise<void> | null)[]>([]); // Track per-audio play promises
  const activeRef      = useRef(shouldPlay);
  const crossfadingRef = useRef(false);
  const rafRef         = useRef<number>(0);

  const [isPlaying,    setIsPlaying]    = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress,     setProgress]     = useState(0); // 0-100% of entire mashup

  activeRef.current = shouldPlay;

  // ── 1. Init / destroy AudioContext ───────────────────────────────────────
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtxRef.current = new AudioContextClass();

    return () => {
      cancelAnimationFrame(rafRef.current);
      audiosRef.current.forEach((a) => { a.pause(); a.src = ""; });
      if (audioCtxRef.current?.state !== "closed") {
        audioCtxRef.current?.close();
      }
    };
  }, []);

  // ── 2. Rebuild audio graph khi mashup thay đổi ───────────────────────────
  useEffect(() => {
    if (!mashup || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;

    // Hard-stop everything old
    cancelAnimationFrame(rafRef.current);
    audiosRef.current.forEach((a) => { a.pause(); a.src = ""; });
    audiosRef.current    = [];
    gainNodesRef.current = [];
    sourceNodesRef.current = [];
    playPromisesRef.current = [];
    crossfadingRef.current  = false;

    // Build new audio graph
    mashup.shorts.forEach((item) => {
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.preload     = "auto";
      audio.src = item.short.track?.hlsUrl || item.short.track?.trackUrl || "";

      const gain   = ctx.createGain();
      gain.gain.value = 0; // silent initially

      let source: MediaElementAudioSourceNode;
      try {
        source = ctx.createMediaElementSource(audio);
        source.connect(gain);
        gain.connect(ctx.destination);
      } catch {
        // Fallback nếu audio element đã bị dùng
        source = ctx.createMediaElementSource(new Audio(audio.src));
        source.connect(gain);
        gain.connect(ctx.destination);
      }

      audiosRef.current.push(audio);
      gainNodesRef.current.push(gain);
      sourceNodesRef.current.push(source);
      playPromisesRef.current.push(null);
    });

    setCurrentIndex(0);
    setProgress(0);
    setIsPlaying(false);
  }, [mashup]);

  // ── 3. Crossfade helper ───────────────────────────────────────────────────
  const scheduleCrossfade = useCallback(
    (fromIdx: number, toIdx: number, durationMs: number) => {
      if (!audioCtxRef.current || !mashup) return;
      if (toIdx >= mashup.shorts.length) {
        // End of mashup
        setIsPlaying(false);
        setProgress(100);
        crossfadingRef.current = false;
        return;
      }

      const ctx    = audioCtxRef.current;
      const now    = ctx.currentTime;
      const fadeSec = durationMs / 1000;

      const fromGain = gainNodesRef.current[fromIdx];
      const toGain   = gainNodesRef.current[toIdx];
      const toAudio  = audiosRef.current[toIdx];
      const toShort  = mashup.shorts[toIdx];

      // Prepare next audio
      toAudio.currentTime = toShort.short.startTime ?? 0;

      // Fade out current
      fromGain.gain.setValueAtTime(fromGain.gain.value, now);
      fromGain.gain.linearRampToValueAtTime(0, now + fadeSec);

      // Fade in next
      toGain.gain.setValueAtTime(0, now);
      toGain.gain.linearRampToValueAtTime(1, now + fadeSec);

      const promise = toAudio.play().catch(() => {});
      playPromisesRef.current[toIdx] = promise;

      setTimeout(() => {
        audiosRef.current[fromIdx]?.pause();
        gainNodesRef.current[fromIdx].gain.value = 0;
        setCurrentIndex(toIdx);
        crossfadingRef.current = false;
      }, durationMs);
    },
    [mashup],
  );

  // ── 4. RAF progress updater + crossfade trigger ──────────────────────────
  useEffect(() => {
    if (!mashup || audiosRef.current.length === 0) return;

    const tick = () => {
      if (!activeRef.current) return;

      const idx   = currentIndex;
      const audio = audiosRef.current[idx];
      const item  = mashup.shorts[idx];
      if (!audio || !item) { rafRef.current = requestAnimationFrame(tick); return; }

      const start = item.short.startTime ?? 0;
      const end   = item.short.endTime ?? audio.duration ?? 0;
      const dur   = end - start;

      // Progress of current short
      const shortPct = dur > 0 ? Math.max(0, Math.min(100, ((audio.currentTime - start) / dur) * 100)) : 0;

      // Overall progress across all shorts
      const totalDur = mashup.shorts.reduce((acc, s) => acc + ((s.short.endTime ?? 0) - (s.short.startTime ?? 0)), 0);
      const elapsed  = mashup.shorts.slice(0, idx).reduce((acc, s) => acc + ((s.short.endTime ?? 0) - (s.short.startTime ?? 0)), 0)
                       + (audio.currentTime - start);
      setProgress(totalDur > 0 ? Math.max(0, Math.min(100, (elapsed / totalDur) * 100)) : shortPct);

      // Trigger crossfade when near end
      const fadeDur = item.transitionDuration ?? 2000;
      const remaining = end - audio.currentTime;
      if (remaining <= fadeDur / 1000 + 0.1 && !crossfadingRef.current) {
        crossfadingRef.current = true;
        scheduleCrossfade(idx, idx + 1, fadeDur);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    if (isPlaying) {
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, currentIndex, mashup, scheduleCrossfade]);

  // ── 5. Activate / Deactivate (shouldPlay prop) ───────────────────────────
  useEffect(() => {
    if (!mashup || audiosRef.current.length === 0 || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;

    if (shouldPlay) {
      // Resume suspended context (required after first user gesture)
      if (ctx.state === "suspended") ctx.resume();

      const audio = audiosRef.current[currentIndex];
      const item  = mashup.shorts[currentIndex];
      if (!audio || !item) return;

      // Always reset to startTime when activating (TikTok-like behavior)
      audio.currentTime = item.short.startTime ?? 0;
      gainNodesRef.current[currentIndex].gain.value = 1;

      const p = audio.play().catch((err) => {
        if (err?.name !== "AbortError") console.warn("[MashupPlayer] play error:", err);
      });
      playPromisesRef.current[currentIndex] = p;
      setIsPlaying(true);
    } else {
      // Hard stop all
      const stopAll = () => {
        audiosRef.current.forEach((a, i) => {
          a.pause();
          gainNodesRef.current[i].gain.value = 0;
          const item = mashup.shorts[i];
          if (item) a.currentTime = item.short.startTime ?? 0;
        });
        playPromisesRef.current = playPromisesRef.current.map(() => null);
        crossfadingRef.current = false;
        setIsPlaying(false);
        setCurrentIndex(0);
        setProgress(0);
        cancelAnimationFrame(rafRef.current);
      };

      // Wait for any pending play promises before pausing
      const pending = playPromisesRef.current.filter(Boolean);
      if (pending.length > 0) {
        Promise.allSettled(pending).then(stopAll);
      } else {
        stopAll();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldPlay]);

  // ── 6. togglePlay — user taps screen ─────────────────────────────────────
  const togglePlay = useCallback(() => {
    if (!mashup || audiosRef.current.length === 0 || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;

    if (isPlaying) {
      audiosRef.current.forEach((a) => a.pause());
      setIsPlaying(false);
    } else {
      if (ctx.state === "suspended") ctx.resume();
      const audio = audiosRef.current[currentIndex];
      gainNodesRef.current[currentIndex].gain.value = 1;
      const p = audio?.play().catch(console.warn) ?? Promise.resolve();
      playPromisesRef.current[currentIndex] = p;
      setIsPlaying(true);
    }
  }, [isPlaying, currentIndex, mashup]);

  // ── 7. skipTo — jump to a specific short index ────────────────────────────
  const skipTo = useCallback(
    (idx: number) => {
      if (!mashup || idx < 0 || idx >= mashup.shorts.length) return;
      audiosRef.current.forEach((a, i) => {
        a.pause();
        gainNodesRef.current[i].gain.value = 0;
      });
      crossfadingRef.current = false;

      const audio = audiosRef.current[idx];
      const item  = mashup.shorts[idx];
      if (!audio || !item) return;

      audio.currentTime = item.short.startTime ?? 0;
      gainNodesRef.current[idx].gain.value = 1;

      if (isPlaying) {
        const p = audio.play().catch(console.warn);
        playPromisesRef.current[idx] = p;
      }
      setCurrentIndex(idx);
    },
    [mashup, isPlaying],
  );

  return { isPlaying, progress, currentIndex, togglePlay, skipTo };
};
