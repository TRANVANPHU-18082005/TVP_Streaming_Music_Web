import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setIsPlaying,
  setVolume,
  stopPlaying,
} from "@/features/player/slice/playerSlice";

type SleepMode = "fade" | "pause" | "stop" | "after-track";

interface SleepTimerContextValue {
  active: boolean;
  remainingMs: number;
  mode: SleepMode;
  fadeDurationMs: number;
  open: (
    minutes: number,
    opts?: { mode?: SleepMode; fadeDurationMs?: number },
  ) => void;
  cancel: () => void;
  openModal: () => void;
  closeModal: () => void;
  showModal: boolean;
  getSessions: () => any[];
  clearSessions: () => void;
}

const DEFAULT: SleepTimerContextValue = {
  active: false,
  remainingMs: 0,
  mode: "pause",
  fadeDurationMs: 30000,
  open: () => {},
  cancel: () => {},
  openModal: () => {},
  closeModal: () => {},
  showModal: false,
  getSessions: () => [],
  clearSessions: () => {},
};

const SleepTimerContext = createContext<SleepTimerContextValue>(DEFAULT);

const STORAGE_KEY = "tvp_sleep_timer_v1";
const BC_NAME = "tvp_sleep_timer_v1";
const SESSIONS_KEY = "tvp_sleep_timer_sessions_v1";

export const SleepTimerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const dispatch = useAppDispatch();
  const reduxVolume = useAppSelector((s) => s.player.volume);

  const [active, setActive] = useState(false);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [mode, setMode] = useState<SleepMode>("pause");
  const [fadeDurationMs, setFadeDurationMs] = useState<number>(30000);
  const [remainingMs, setRemainingMs] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const origVolumeRef = useRef<number | null>(null);
  const fadeIntervalRef = useRef<number | null>(null);
  const timeoutIdRef = useRef<number | null>(null);
  const fadeTimeoutRef = useRef<number | null>(null);
  const programmaticVolumeRef = useRef<number | null>(null);
  const isFadingRef = useRef(false);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const currentTrackId = useAppSelector((s) => s.player.currentTrackId);
  const currentTrackIdRef = useRef<string | null>(currentTrackId);
  const startedTrackIdRef = useRef<string | null>(null);
  const audioEndedHandlerRef = useRef<((ev?: Event) => void) | null>(null);

  useEffect(() => {
    currentTrackIdRef.current = currentTrackId;
  }, [currentTrackId]);

  // If user skips track while waiting for "after-track", cancel timer
  useEffect(() => {
    if (!active) return;
    if (mode !== "after-track") return;
    const started = startedTrackIdRef.current;
    if (
      started &&
      currentTrackIdRef.current &&
      started !== currentTrackIdRef.current
    ) {
      // user changed track → cancel after-track session
      cancel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrackId]);

  useEffect(() => {
    if (typeof BroadcastChannel !== "undefined") {
      try {
        bcRef.current = new BroadcastChannel(BC_NAME);
        bcRef.current.onmessage = (ev) => {
          const data = ev.data as any;
          if (!data || !data.type) return;
          if (data.type === "start") startFromState(data.state, false);
          if (data.type === "cancel") cancel(false);
        };
      } catch (e) {
        bcRef.current = null;
      }
    }

    // hydrate
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.endTime && parsed?.active) startFromState(parsed, false);
      }
    } catch (e) {
      // ignore
    }

    return () => {
      if (bcRef.current) bcRef.current.close();
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!active || !endTime) {
      setRemainingMs(0);
      return;
    }
    const tick = () => {
      const now = Date.now();
      const rem = Math.max(0, endTime - now);
      setRemainingMs(rem);
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => clearInterval(id);
  }, [active, endTime]);

  const clearTimers = () => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    isFadingRef.current = false;
    programmaticVolumeRef.current = null;
    // remove audio ended listener if attached
    try {
      const audio = document.querySelector("audio");
      if (audio && audioEndedHandlerRef.current) {
        audio.removeEventListener("ended", audioEndedHandlerRef.current);
        audioEndedHandlerRef.current = null;
      }
    } catch (e) {
      // ignore
    }
  };

  const finalizeAction = useCallback(
    (actionMode: SleepMode) => {
      clearTimers();
      const orig = origVolumeRef.current;
      if (orig != null) {
        dispatch(setVolume(orig));
        origVolumeRef.current = null;
      }
      if (actionMode === "stop") {
        dispatch(stopPlaying());
      } else {
        dispatch(setIsPlaying(false));
      }
      // complete session log
      try {
        const sid = sessionIdRef.current;
        if (sid) {
          const raw = localStorage.getItem(SESSIONS_KEY) || "[]";
          const arr = JSON.parse(raw);
          const idx = arr.findIndex((s: any) => s.id === sid);
          if (idx !== -1) {
            arr[idx] = {
              ...arr[idx],
              endedAt: Date.now(),
              completed: true,
              actionMode,
            };
            localStorage.setItem(SESSIONS_KEY, JSON.stringify(arr));
          }
        }
      } catch (e) {
        // ignore
      }
      toast.success("Sleep timer finished");
      setActive(false);
      setEndTime(null);
      setMode("pause");
      setFadeDurationMs(30000);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
      if (bcRef.current) bcRef.current.postMessage({ type: "cancel" });
    },
    [dispatch],
  );

  const startFade = useCallback(
    (end: number, duration: number, actionMode: SleepMode) => {
      if (duration <= 0) {
        finalizeAction(actionMode);
        return;
      }

      const origVol =
        origVolumeRef.current ??
        (typeof reduxVolume === "number" ? reduxVolume : 1);
      origVolumeRef.current = origVol;
      isFadingRef.current = true;
      const total = Math.max(1, duration);
      const stepMs = 100;
      programmaticVolumeRef.current = origVol;
      fadeIntervalRef.current = window.setInterval(() => {
        const now = Date.now();
        const elapsed = Math.min(total, now - (end - total));
        const t = Math.max(0, Math.min(1, elapsed / total));
        const newVol = origVol * (1 - t);
        programmaticVolumeRef.current = newVol;
        dispatch(setVolume(newVol));
      }, stepMs);

      timeoutIdRef.current = window.setTimeout(
        () => {
          if (fadeIntervalRef.current) {
            clearInterval(fadeIntervalRef.current);
            fadeIntervalRef.current = null;
          }
          // restore volume for when user resumes
          dispatch(setVolume(origVol));
          finalizeAction(actionMode);
        },
        Math.max(0, end - Date.now()),
      );
    },
    [dispatch, finalizeAction, reduxVolume],
  );

  const startFromState = (state: any, broadcast = true) => {
    clearTimers();
    setActive(true);
    setEndTime(state.endTime);
    setMode(state.mode || "pause");
    setFadeDurationMs(state.fadeDurationMs ?? 30000);
    try {
      // ensure session id exists and log session
      let sid = state.sessionId;
      if (!sid) {
        sid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        state.sessionId = sid;
      }
      sessionIdRef.current = sid;

      // append session to sessions log
      const raw = localStorage.getItem(SESSIONS_KEY) || "[]";
      const arr = JSON.parse(raw);
      const exists = arr.find((s: any) => s.id === sid);
      if (!exists) {
        arr.push({
          id: sid,
          startedAt: Date.now(),
          plannedEnd: state.endTime,
          mode: state.mode,
          fadeDurationMs: state.fadeDurationMs ?? 30000,
        });
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(arr));
      }

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...state, active: true }),
      );
    } catch (e) {}
    if (broadcast && bcRef.current)
      bcRef.current.postMessage({ type: "start", state });

    // toast notify start
    try {
      const mins = Math.round((state.endTime - Date.now()) / 60000);
      toast.success(`Sleep timer started — ${mins}m (${state.mode})`);
    } catch (e) {}

    const now = Date.now();
    const end = state.endTime;
    const mode = state.mode;
    const fadeMs = state.fadeDurationMs ?? 30000;
    const finalDelay = Math.max(0, end - now);
    // record which track was active at start (for after-track semantics)
    try {
      startedTrackIdRef.current = currentTrackIdRef.current;
    } catch (e) {
      startedTrackIdRef.current = null;
    }
    // attach audio 'ended' handler for after-track so we can finalize earlier
    if (mode === "after-track") {
      try {
        const audio = document.querySelector(
          "audio",
        ) as HTMLMediaElement | null;
        if (audio) {
          const handler = () => {
            // ensure it's the same track we started with
            if (
              startedTrackIdRef.current &&
              currentTrackIdRef.current === startedTrackIdRef.current
            ) {
              finalizeAction("after-track");
            }
          };
          audioEndedHandlerRef.current = handler;
          audio.addEventListener("ended", handler);
        }
      } catch (e) {
        // ignore
      }
    }
    if (mode === "fade") {
      const fadeStartDelay = Math.max(0, finalDelay - fadeMs);
      fadeTimeoutRef.current = window.setTimeout(() => {
        startFade(end, fadeMs, mode);
      }, fadeStartDelay);
      timeoutIdRef.current = window.setTimeout(() => {
        if (!isFadingRef.current) finalizeAction(mode);
      }, finalDelay);
    } else {
      timeoutIdRef.current = window.setTimeout(
        () => finalizeAction(mode),
        finalDelay,
      );
    }
  };

  const start = useCallback(
    (minutes: number, opts?: { mode?: SleepMode; fadeDurationMs?: number }) => {
      const m = Math.max(0, Math.floor(minutes));
      const chosenMode = opts?.mode ?? "fade";
      const fadeMs = opts?.fadeDurationMs ?? 30000;
      let durationMs = m * 60000;
      if (chosenMode === "after-track") {
        const audio = document.querySelector("audio");
        if (
          audio &&
          (audio as HTMLMediaElement).duration &&
          isFinite((audio as HTMLMediaElement).duration)
        ) {
          const rem = Math.max(
            0,
            (((audio as HTMLMediaElement).duration || 0) -
              ((audio as HTMLMediaElement).currentTime || 0)) *
              1000,
          );
          durationMs = rem || durationMs;
        }
      }
      const end = Date.now() + durationMs;
      const state = {
        active: true,
        endTime: end,
        mode: chosenMode,
        fadeDurationMs: fadeMs,
      };
      startFromState(state, true);
    },
    [],
  );

  const cancel = useCallback(
    (broadcast = true) => {
      clearTimers();
      const orig = origVolumeRef.current;
      if (orig != null) {
        dispatch(setVolume(orig));
        origVolumeRef.current = null;
      }
      setActive(false);
      setEndTime(null);
      setMode("pause");
      setFadeDurationMs(30000);
      try {
        // mark session cancelled
        const sid = sessionIdRef.current;
        if (sid) {
          const raw = localStorage.getItem(SESSIONS_KEY) || "[]";
          const arr = JSON.parse(raw);
          const idx = arr.findIndex((s: any) => s.id === sid);
          if (idx !== -1) {
            arr[idx] = { ...arr[idx], endedAt: Date.now(), cancelled: true };
            localStorage.setItem(SESSIONS_KEY, JSON.stringify(arr));
          }
          sessionIdRef.current = null;
        }
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
      toast("Sleep timer cancelled");
      if (broadcast && bcRef.current)
        bcRef.current.postMessage({ type: "cancel" });
    },
    [dispatch],
  );

  // If user changes volume while we are fading, cancel fade to avoid fighting user
  const currentReduxVolume = useAppSelector((s) => s.player.volume);
  useEffect(() => {
    if (!isFadingRef.current) return;
    if (programmaticVolumeRef.current == null) return;
    if (
      Math.abs(
        (currentReduxVolume ?? 0) - (programmaticVolumeRef.current ?? 0),
      ) > 0.02
    ) {
      cancel();
    }
  }, [currentReduxVolume, cancel]);

  const value: SleepTimerContextValue = {
    active,
    remainingMs,
    mode,
    fadeDurationMs,
    open: start,
    cancel: () => cancel(true),
    openModal: () => setShowModal(true),
    closeModal: () => setShowModal(false),
    showModal,
    getSessions: () => {
      try {
        const raw = localStorage.getItem(SESSIONS_KEY) || "[]";
        return JSON.parse(raw);
      } catch (e) {
        return [];
      }
    },
    clearSessions: () => {
      try {
        localStorage.removeItem(SESSIONS_KEY);
      } catch (e) {}
    },
  };

  return (
    <SleepTimerContext.Provider value={value}>
      {children}
    </SleepTimerContext.Provider>
  );
};

export const useSleepTimer = () => useContext(SleepTimerContext);

export default SleepTimerProvider;
