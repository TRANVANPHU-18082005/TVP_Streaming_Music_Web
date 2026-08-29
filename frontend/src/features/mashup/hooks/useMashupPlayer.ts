import { useState, useEffect, useRef, useCallback } from "react";
import { IMashup, TransitionType } from "../types";

export type TransitionState = 'idle' | 'transitioning';

export interface MashupPlayerState {
  isPlaying: boolean;
  progress: number;       // 0-100% overall mashup progress
  currentIndex: number;
  transitionState: TransitionState;
  activeTransitionType: TransitionType | null;
  analyserNode: AnalyserNode | null;
}

/**
 * useMashupPlayer — Production-grade DJ mashup playback engine
 *
 * Features:
 * - Web Audio API crossfade, cut, beatmatch, echo-out, filter-sweep, stutter,
 *   build-drop, vinyl-scratch transitions
 * - Exposes AnalyserNode for realtime waveform visualization
 * - Exposes transitionState for UI overlay effects
 * - Fix race condition: play() Promise tracking, hard stop, activeRef
 */
export const useMashupPlayer = (
  mashup: IMashup | null,
  shouldPlay: boolean,
  onTransitionStart?: (fromIdx: number, toIdx: number, type: TransitionType) => void,
) => {
  const audioCtxRef     = useRef<AudioContext | null>(null);
  const analyserRef     = useRef<AnalyserNode | null>(null);
  const audiosRef       = useRef<HTMLAudioElement[]>([]);
  const gainNodesRef    = useRef<GainNode[]>([]);
  const sourceNodesRef  = useRef<MediaElementAudioSourceNode[]>([]);
  const filterNodesRef  = useRef<(BiquadFilterNode | null)[]>([]);
  const playPromisesRef = useRef<(Promise<void> | null)[]>([]);
  const activeRef       = useRef(shouldPlay);
  const crossfadingRef  = useRef(false);
  const rafRef          = useRef<number>(0);
  const stutterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isPlaying,    setIsPlaying]    = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress,     setProgress]     = useState(0);
  const [transitionState, setTransitionState] = useState<TransitionState>('idle');
  const [activeTransitionType, setActiveTransitionType] = useState<TransitionType | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  activeRef.current = shouldPlay;

  // ── 1. Init AudioContext + AnalyserNode ─────────────────────────────────
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;

    // Create a master analyser
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    analyser.connect(ctx.destination);
    analyserRef.current = analyser;
    setAnalyserNode(analyser);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearStutterTimer();
      audiosRef.current.forEach(a => { a.pause(); a.src = ""; });
      if (ctx.state !== "closed") ctx.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearStutterTimer = () => {
    if (stutterTimerRef.current) {
      clearInterval(stutterTimerRef.current);
      stutterTimerRef.current = null;
    }
  };

  // ── 2. Rebuild audio graph when mashup changes ──────────────────────────
  useEffect(() => {
    if (!mashup || !audioCtxRef.current || !analyserRef.current) return;
    const ctx = audioCtxRef.current;
    const masterAnalyser = analyserRef.current;

    cancelAnimationFrame(rafRef.current);
    clearStutterTimer();
    audiosRef.current.forEach(a => { a.pause(); a.src = ""; });
    audiosRef.current    = [];
    gainNodesRef.current = [];
    sourceNodesRef.current = [];
    filterNodesRef.current = [];
    playPromisesRef.current = [];
    crossfadingRef.current  = false;

    mashup.shorts.forEach(item => {
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.preload     = "metadata"; // Optimized: prevent mass loading of all 8 tracks
      audio.src = item.short.track?.hlsUrl || item.short.track?.trackUrl || "";

      const gain = ctx.createGain();
      gain.gain.value = 0;

      // Per-track low-pass filter (for filter-sweep effect)
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 22050; // pass-through by default

      let source: MediaElementAudioSourceNode;
      try {
        source = ctx.createMediaElementSource(audio);
      } catch {
        source = ctx.createMediaElementSource(new Audio(audio.src));
      }

      source.connect(filter);
      filter.connect(gain);
      gain.connect(masterAnalyser); // route all through master analyser

      audiosRef.current.push(audio);
      gainNodesRef.current.push(gain);
      sourceNodesRef.current.push(source);
      filterNodesRef.current.push(filter);
      playPromisesRef.current.push(null);
    });

    setCurrentIndex(0);
    setProgress(0);
    setIsPlaying(false);
    setTransitionState('idle');
    setActiveTransitionType(null);
  }, [mashup]);

  // ── 3. DJ Crossfade / Effect transitions ───────────────────────────────
  const scheduleCrossfade = useCallback(
    (fromIdx: number, toIdx: number, durationMs: number, type: TransitionType) => {
      if (!audioCtxRef.current || !mashup) return;
      if (toIdx >= mashup.shorts.length) {
        setIsPlaying(false);
        setProgress(100);
        setTransitionState('idle');
        setActiveTransitionType(null);
        crossfadingRef.current = false;
        return;
      }

      const ctx      = audioCtxRef.current;
      const now      = ctx.currentTime;
      const fadeSec  = Math.max(0.1, durationMs / 1000);

      const fromGain   = gainNodesRef.current[fromIdx];
      const toGain     = gainNodesRef.current[toIdx];
      const fromFilter = filterNodesRef.current[fromIdx];
      const toFilter   = filterNodesRef.current[toIdx];
      const toAudio    = audiosRef.current[toIdx];
      const toItem     = mashup.shorts[toIdx];

      toAudio.currentTime = toItem.trimStart ?? toItem.short.startTime ?? 0;

      setTransitionState('transitioning');
      setActiveTransitionType(type);
      onTransitionStart?.(fromIdx, toIdx, type);

      const doFinish = () => {
        audiosRef.current[fromIdx]?.pause();
        gainNodesRef.current[fromIdx].gain.value = 0;
        if (filterNodesRef.current[fromIdx]) {
          filterNodesRef.current[fromIdx]!.frequency.value = 22050;
        }
        setCurrentIndex(toIdx);
        setTransitionState('idle');
        setActiveTransitionType(null);
        crossfadingRef.current = false;
      };

      switch (type) {
        // ── Standard Crossfade ──────────────────────────────────────────
        case 'crossfade':
        default: {
          fromGain.gain.setValueAtTime(fromGain.gain.value, now);
          fromGain.gain.linearRampToValueAtTime(0, now + fadeSec);
          toGain.gain.setValueAtTime(0, now);
          toGain.gain.linearRampToValueAtTime(1, now + fadeSec);
          playPromisesRef.current[toIdx] = toAudio.play().catch(() => {});
          setTimeout(doFinish, durationMs);
          break;
        }

        // ── Hard Cut ────────────────────────────────────────────────────
        case 'cut': {
          audiosRef.current[fromIdx]?.pause();
          fromGain.gain.setValueAtTime(0, now);
          toGain.gain.setValueAtTime(1, now);
          playPromisesRef.current[toIdx] = toAudio.play().catch(() => {});
          setTimeout(doFinish, 50);
          break;
        }

        // ── Beat Match (sync-based crossfade) ───────────────────────────
        case 'beatmatch': {
          fromGain.gain.setValueAtTime(fromGain.gain.value, now);
          fromGain.gain.linearRampToValueAtTime(0, now + fadeSec);
          toGain.gain.setValueAtTime(0, now);
          toGain.gain.linearRampToValueAtTime(1, now + fadeSec);
          playPromisesRef.current[toIdx] = toAudio.play().catch(() => {});
          setTimeout(doFinish, durationMs);
          break;
        }

        // ── Echo Out (fade + reverb-like echo) ──────────────────────────
        case 'echo-out': {
          // Simulate echo by quickly oscillating gain
          let echoCount = 0;
          const maxEchoes = 5;
          const echoInterval = (durationMs / maxEchoes) / 1000;
          const echoId = setInterval(() => {
            echoCount++;
            const echoGain = Math.max(0, 1 - echoCount / maxEchoes);
            fromGain.gain.setValueAtTime(echoGain * 0.5, ctx.currentTime);
            setTimeout(() => fromGain.gain.setValueAtTime(echoGain, ctx.currentTime + 0.02), 30);
            if (echoCount >= maxEchoes) clearInterval(echoId);
          }, (durationMs / maxEchoes));
          fromGain.gain.setValueAtTime(fromGain.gain.value, now);
          fromGain.gain.linearRampToValueAtTime(0, now + fadeSec);
          toGain.gain.setValueAtTime(0, now + fadeSec * 0.5);
          toGain.gain.linearRampToValueAtTime(1, now + fadeSec);
          playPromisesRef.current[toIdx] = toAudio.play().catch(() => {});
          setTimeout(doFinish, durationMs);
          break;
        }

        // ── Filter Sweep (low-pass filter sweep out → in) ────────────────
        case 'filter-sweep': {
          // Sweep from full range down to 200Hz (muffle), then next track sweeps up
          if (fromFilter) {
            fromFilter.frequency.setValueAtTime(22050, now);
            fromFilter.frequency.linearRampToValueAtTime(200, now + fadeSec * 0.6);
          }
          fromGain.gain.setValueAtTime(fromGain.gain.value, now);
          fromGain.gain.linearRampToValueAtTime(0, now + fadeSec * 0.7);
          if (toFilter) {
            toFilter.frequency.setValueAtTime(200, now + fadeSec * 0.5);
            toFilter.frequency.linearRampToValueAtTime(22050, now + fadeSec);
          }
          toGain.gain.setValueAtTime(0, now + fadeSec * 0.5);
          toGain.gain.linearRampToValueAtTime(1, now + fadeSec);
          playPromisesRef.current[toIdx] = toAudio.play().catch(() => {});
          setTimeout(doFinish, durationMs);
          break;
        }

        // ── Stutter (rapid gate effect) ─────────────────────────────────
        case 'stutter': {
          let stutterCount = 0;
          const totalStutters = 8;
          const stutterInterval = durationMs / totalStutters;
          stutterTimerRef.current = setInterval(() => {
            stutterCount++;
            const isOn = stutterCount % 2 === 0;
            fromGain.gain.setValueAtTime(isOn ? 1 : 0, ctx.currentTime);
            if (stutterCount >= totalStutters) {
              clearStutterTimer();
              fromGain.gain.setValueAtTime(0, ctx.currentTime);
              toGain.gain.setValueAtTime(1, ctx.currentTime);
              playPromisesRef.current[toIdx] = toAudio.play().catch(() => {});
              doFinish();
            }
          }, stutterInterval);
          break;
        }

        // ── Build → Drop ─────────────────────────────────────────────────
        case 'build-drop': {
          // Rapidly lower pitch/filter then hard cut + volume spike
          if (fromFilter) {
            fromFilter.frequency.setValueAtTime(22050, now);
            fromFilter.frequency.linearRampToValueAtTime(100, now + fadeSec * 0.8);
          }
          fromGain.gain.setValueAtTime(fromGain.gain.value, now);
          fromGain.gain.linearRampToValueAtTime(0, now + fadeSec * 0.85);
          // Short silence before drop
          toGain.gain.setValueAtTime(0, now + fadeSec * 0.85);
          toGain.gain.linearRampToValueAtTime(1.0, now + fadeSec);
          playPromisesRef.current[toIdx] = toAudio.play().catch(() => {});
          setTimeout(doFinish, durationMs);
          break;
        }

        // ── Vinyl Scratch ─────────────────────────────────────────────────
        case 'vinyl-scratch': {
          // Quick reverse-gain + hard cut
          let scratchCount = 0;
          const scratchSteps = 6;
          const scratchInt = (durationMs * 0.4) / scratchSteps;
          const scratchId = setInterval(() => {
            scratchCount++;
            fromGain.gain.setValueAtTime(scratchCount % 2 === 0 ? 0.8 : 0.2, ctx.currentTime);
            if (scratchCount >= scratchSteps) {
              clearInterval(scratchId);
              fromGain.gain.setValueAtTime(0, ctx.currentTime);
              toGain.gain.setValueAtTime(1, ctx.currentTime);
              playPromisesRef.current[toIdx] = toAudio.play().catch(() => {});
              doFinish();
            }
          }, scratchInt);
          break;
        }
      }
    },
    [mashup, onTransitionStart],
  );

  // ── 4. RAF progress updater + crossfade trigger ─────────────────────────
  useEffect(() => {
    if (!mashup || audiosRef.current.length === 0) return;

    // Cache total duration calculation to avoid doing it 60 times a second
    const totalDur = mashup.shorts.reduce(
      (acc, s) => acc + Math.max(0, (s.trimEnd ?? s.short.endTime ?? 0) - (s.trimStart ?? s.short.startTime ?? 0)), 0,
    );
    
    // Array of elapsed durations prior to each track
    const cumulativeDurs: number[] = [];
    let acc = 0;
    for (const s of mashup.shorts) {
      cumulativeDurs.push(acc);
      acc += Math.max(0, (s.trimEnd ?? s.short.endTime ?? 0) - (s.trimStart ?? s.short.startTime ?? 0));
    }

    let lastProgressUpdate = 0;

    const tick = () => {
      if (!activeRef.current) return;

      const idx   = currentIndex;
      const audio = audiosRef.current[idx];
      const item  = mashup.shorts[idx];
      if (!audio || !item) { rafRef.current = requestAnimationFrame(tick); return; }

      const start  = item.trimStart ?? item.short.startTime ?? 0;
      const end    = item.trimEnd   ?? item.short.endTime   ?? audio.duration ?? 0;
      const dur    = end - start;

      // HARD STOP GUARD: If it played past the end boundary, pause it!
      if (audio.currentTime >= end && end > 0) {
        // We've hit the end of this track. Wait for transition or force end.
        if (!crossfadingRef.current && idx < mashup.shorts.length - 1) {
          crossfadingRef.current = true;
          scheduleCrossfade(idx, idx + 1, item.transitionDuration ?? 2000, item.transitionType ?? 'crossfade');
        } else if (idx === mashup.shorts.length - 1) {
          audio.pause();
          setIsPlaying(false);
          setProgress(100);
          setTransitionState('idle');
          setActiveTransitionType(null);
          return; // Stop RAF
        }
      }

      // Throttle Progress State Updates (Every 100ms) to fix React lag
      const nowMs = performance.now();
      if (nowMs - lastProgressUpdate > 100) {
        lastProgressUpdate = nowMs;
        const elapsed = cumulativeDurs[idx] + (audio.currentTime - start);
        const shortPct = dur > 0 ? Math.max(0, Math.min(100, ((audio.currentTime - start) / dur) * 100)) : 0;
        const newProgress = totalDur > 0 ? Math.max(0, Math.min(100, (elapsed / totalDur) * 100)) : shortPct;
        
        setProgress(p => (Math.abs(p - newProgress) > 0.1 ? newProgress : p));
      }

      // Trigger transition near end
      const fadeDur   = item.transitionDuration ?? 2000;
      const remaining = end - audio.currentTime;
      if (remaining <= fadeDur / 1000 + 0.1 && !crossfadingRef.current && idx < mashup.shorts.length - 1) {
        crossfadingRef.current = true;
        scheduleCrossfade(idx, idx + 1, fadeDur, item.transitionType ?? 'crossfade');
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    if (isPlaying) {
      lastProgressUpdate = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, currentIndex, mashup, scheduleCrossfade]);

  // ── 5. Activate / Deactivate (shouldPlay prop) ──────────────────────────
  useEffect(() => {
    if (!mashup || audiosRef.current.length === 0 || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;

    if (shouldPlay) {
      if (ctx.state === "suspended") ctx.resume();
      const audio = audiosRef.current[currentIndex];
      const item  = mashup.shorts[currentIndex];
      if (!audio || !item) return;
      audio.currentTime = item.trimStart ?? item.short.startTime ?? 0;
      gainNodesRef.current[currentIndex].gain.value = item.volume ?? 1;
      const p = audio.play().catch(err => {
        if (err?.name !== "AbortError") console.warn("[MashupPlayer] play error:", err);
      });
      playPromisesRef.current[currentIndex] = p;
      setIsPlaying(true);
    } else {
      const stopAll = () => {
        clearStutterTimer();
        audiosRef.current.forEach((a, i) => {
          a.pause();
          gainNodesRef.current[i].gain.value = 0;
          const item = mashup.shorts[i];
          if (item) a.currentTime = item.trimStart ?? item.short.startTime ?? 0;
          if (filterNodesRef.current[i]) filterNodesRef.current[i]!.frequency.value = 22050;
        });
        playPromisesRef.current = playPromisesRef.current.map(() => null);
        crossfadingRef.current = false;
        setIsPlaying(false);
        setCurrentIndex(0);
        setProgress(0);
        setTransitionState('idle');
        setActiveTransitionType(null);
        cancelAnimationFrame(rafRef.current);
      };
      const pending = playPromisesRef.current.filter(Boolean);
      if (pending.length > 0) {
        Promise.allSettled(pending).then(stopAll);
      } else {
        stopAll();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldPlay]);

  // ── 6. togglePlay ────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    if (!mashup || audiosRef.current.length === 0 || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (isPlaying) {
      audiosRef.current.forEach(a => a.pause());
      setIsPlaying(false);
    } else {
      if (ctx.state === "suspended") ctx.resume();
      const audio = audiosRef.current[currentIndex];
      const item  = mashup.shorts[currentIndex];
      gainNodesRef.current[currentIndex].gain.value = item?.volume ?? 1;
      const p = audio?.play().catch(console.warn) ?? Promise.resolve();
      playPromisesRef.current[currentIndex] = p;
      setIsPlaying(true);
    }
  }, [isPlaying, currentIndex, mashup]);

  // ── 7. skipTo ────────────────────────────────────────────────────────────
  const skipTo = useCallback(
    (idx: number) => {
      if (!mashup || idx < 0 || idx >= mashup.shorts.length) return;
      clearStutterTimer();
      audiosRef.current.forEach((a, i) => {
        a.pause();
        gainNodesRef.current[i].gain.value = 0;
        if (filterNodesRef.current[i]) filterNodesRef.current[i]!.frequency.value = 22050;
      });
      crossfadingRef.current = false;
      setTransitionState('idle');
      setActiveTransitionType(null);

      const audio = audiosRef.current[idx];
      const item  = mashup.shorts[idx];
      if (!audio || !item) return;

      audio.currentTime = item.trimStart ?? item.short.startTime ?? 0;
      gainNodesRef.current[idx].gain.value = item.volume ?? 1;

      if (isPlaying) {
        const p = audio.play().catch(console.warn);
        playPromisesRef.current[idx] = p;
      }
      setCurrentIndex(idx);
    },
    [mashup, isPlaying],
  );

  return {
    isPlaying,
    progress,
    currentIndex,
    transitionState,
    activeTransitionType,
    analyserNode,
    togglePlay,
    skipTo,
  };
};
