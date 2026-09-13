import {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Film,
  Search,
  Check,
  Video,
  Loader2,
  X,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/store/store";
import {
  setIsPlaying,
  nextTrack,
  prevTrack,
} from "@/features/player/slice/playerSlice";
import { VideoMoodEngine } from "./VideoMoodEngine";
import type { ITrack } from "@/features/track";
import { useMoodVideosQuery } from "@/features/mood-video/hooks/useMoodVideoQuery";
import { DEAFULT_APP } from "@/config/constants";
import { cn } from "@/lib/utils";
import { TrackLikeButton } from "@/features/interaction/components/LikeButton";

// ─────────────────────────────────────────────────────────────────────────────
// CSS — inject synchronously, no FOUC
// ─────────────────────────────────────────────────────────────────────────────

const CMO_STYLE_ID = "__cmo-styles__";
const CMO_CSS = `
.cmo-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  overflow: hidden;
  background: #000;
  contain: layout style paint;
}

.cmo-scrim-top {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 240px;
  background: linear-gradient(to bottom, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.42) 50%, transparent 100%);
  z-index: 10;
  pointer-events: none;
}
.cmo-scrim-bottom {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 340px;
  background: linear-gradient(to top, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.62) 45%, transparent 100%);
  z-index: 10;
  pointer-events: none;
}

.cmo-controls {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: opacity 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}
.cmo-controls--hidden { opacity: 0; pointer-events: none; }
.cmo-controls--visible { opacity: 1; pointer-events: auto; }

.cmo-lyric-center {
  position: absolute;
  inset: 0;
  z-index: 15;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8%;
  pointer-events: none;
}
.cmo-lyric-text {
  text-align: center;
  font-size: clamp(1.5rem, 3.8vw, 3rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: #fff;
  text-shadow: 0 2px 32px rgba(0,0,0,0.65), 0 0 80px rgba(0,0,0,0.4);
}

.cmo-seek {
  width: 100%;
  height: 3px;
  background: rgba(255,255,255,0.22);
  border-radius: 99px;
  cursor: pointer;
  position: relative;
  transition: height 0.18s ease;
}
.cmo-seek:hover { height: 5px; }
.cmo-seek-fill {
  height: 100%;
  border-radius: 99px;
  background: #fff;
  position: relative;
}
.cmo-seek-fill::after {
  content: '';
  position: absolute;
  right: -7px; top: 50%;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: #fff;
  transform: translateY(-50%) scale(0);
  transition: transform 0.18s ease;
  box-shadow: 0 2px 10px rgba(0,0,0,0.5);
}
.cmo-seek:hover .cmo-seek-fill::after { transform: translateY(-50%) scale(1); }

.cmo-picker-sheet {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  z-index: 50;
  background: rgba(8,8,16,0.97);
  backdrop-filter: blur(24px);
  border-radius: 24px 24px 0 0;
  border-top: 1px solid rgba(255,255,255,0.07);
  max-height: 72vh;
  display: flex;
  flex-direction: column;
}
.cmo-picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  gap: 10px;
  padding: 0 16px 24px;
  overflow-y: auto;
  scrollbar-width: none;
}
.cmo-picker-grid::-webkit-scrollbar { display: none; }

.cmo-vcard {
  aspect-ratio: 9/16;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  border: 2px solid transparent;
  transition: border-color 0.2s, transform 0.2s;
  background: rgba(255,255,255,0.04);
}
.cmo-vcard:hover { transform: scale(0.96); border-color: rgba(255,255,255,0.28); }
.cmo-vcard--selected { border-color: hsl(var(--primary)); transform: scale(0.95); }
.cmo-vcard img { width: 100%; height: 100%; object-fit: cover; opacity: 0.6; transition: opacity 0.2s; }
.cmo-vcard:hover img, .cmo-vcard--selected img { opacity: 0.88; }
.cmo-vcard-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 55%);
}
.cmo-vcard-label {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 6px 5px;
  font-size: 9px; font-weight: 700; color: #fff;
  line-height: 1.25;
}
.cmo-vcard-check {
  position: absolute; top: 5px; right: 5px;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: hsl(var(--primary));
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
}

.cmo-btn {
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.10);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.18s, transform 0.12s;
  color: #fff;
}
.cmo-btn:hover { background: rgba(255,255,255,0.2); }
.cmo-btn:active { transform: scale(0.86); }
.cmo-btn:disabled { opacity: 0.3; pointer-events: none; }
.cmo-btn--play {
  width: 68px; height: 68px;
  background: rgba(255,255,255,0.16);
  border: 1.5px solid rgba(255,255,255,0.22);
}
.cmo-btn--play:hover { background: rgba(255,255,255,0.26); }
.cmo-btn--md { width: 44px; height: 44px; }
.cmo-btn--sm { width: 38px; height: 38px; }
.cmo-btn--xs { width: 32px; height: 32px; background: rgba(255,255,255,0.07); border: none; }
`;

if (typeof document !== "undefined" && !document.getElementById(CMO_STYLE_ID)) {
  const s = document.createElement("style");
  s.id = CMO_STYLE_ID;
  s.textContent = CMO_CSS;
  document.head.appendChild(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// useIdleTimer — controls vanish after N ms of inactivity
// ─────────────────────────────────────────────────────────────────────────────

function useIdleTimer(delayMs = 3000) {
  const [idle, setIdle] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    setIdle(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIdle(true), delayMs);
  }, [delayMs]);

  useEffect(() => {
    reset();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reset]);

  return { idle, reset };
}

// ─────────────────────────────────────────────────────────────────────────────
// SEEK BAR
// ─────────────────────────────────────────────────────────────────────────────

const CmoSeekBar = memo(({
  getCurrentTime,
  duration,
  onSeek,
  isPlaying,
}: {
  getCurrentTime: () => number;
  duration: number;
  onSeek: (t: number) => void;
  isPlaying: boolean;
}) => {
  const [pct, setPct] = useState(0);
  const [displayTime, setDisplayTime] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    if (!isPlaying) {
      const t = getCurrentTime();
      setPct(duration > 0 ? (t / duration) * 100 : 0);
      setDisplayTime(t);
      return;
    }
    const id = setInterval(() => {
      if (dragging.current) return;
      const t = getCurrentTime();
      setPct(duration > 0 ? (t / duration) * 100 : 0);
      setDisplayTime(t);
    }, 250);
    return () => clearInterval(id);
  }, [isPlaying, duration, getCurrentTime]);

  const seekAt = useCallback((clientX: number) => {
    const bar = barRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
    setPct(ratio * 100);
    setDisplayTime(ratio * duration);
  }, [duration, onSeek]);

  return (
    <div className="w-full space-y-2">
      <div
        ref={barRef}
        className="cmo-seek"
        onClick={(e) => { e.stopPropagation(); seekAt(e.clientX); }}
        onMouseDown={(e) => {
          dragging.current = true;
          seekAt(e.clientX);
          const onMove = (me: MouseEvent) => seekAt(me.clientX);
          const onUp = () => {
            dragging.current = false;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={displayTime}
      >
        <div className="cmo-seek-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-white/45 font-mono select-none">
        <span>{formatTime(displayTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
});
CmoSeekBar.displayName = "CmoSeekBar";

// ─────────────────────────────────────────────────────────────────────────────
// COMPACT VOLUME CONTROL
// ─────────────────────────────────────────────────────────────────────────────

const CmoVolume = memo(() => {
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(1);
  const [showSlider, setShowSlider] = useState(false);

  const audio = () =>
    document.getElementById("global-audio-player") as HTMLAudioElement | null;

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const a = audio();
    if (!a) return;
    a.muted = !a.muted;
    setMuted(a.muted);
  }, []);

  const handleVol = useCallback((v: number) => {
    const a = audio();
    if (!a) return;
    a.volume = v;
    setVol(v);
    if (v === 0) { a.muted = true; setMuted(true); }
    else if (muted) { a.muted = false; setMuted(false); }
  }, [muted]);

  return (
    <div
      className="relative flex items-center gap-2"
      onMouseEnter={() => setShowSlider(true)}
      onMouseLeave={() => setShowSlider(false)}
    >
      <button
        className="cmo-btn cmo-btn--xs"
        onClick={toggleMute}
        aria-label={muted ? "Bỏ tắt tiếng" : "Tắt tiếng"}
      >
        {muted || vol === 0 ? (
          <VolumeX className="size-3.5" />
        ) : (
          <Volume2 className="size-3.5" />
        )}
      </button>
      <AnimatePresence>
        {showSlider && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 72 }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={muted ? 0 : vol}
              onChange={(e) => handleVol(Number(e.target.value))}
              style={{ width: 72 }}
              className="h-1 accent-white cursor-pointer"
              aria-label="Âm lượng"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
CmoVolume.displayName = "CmoVolume";

// ─────────────────────────────────────────────────────────────────────────────
// MOOD VIDEO PICKER SHEET
// ─────────────────────────────────────────────────────────────────────────────

const MoodPickerSheet = memo(({
  open,
  onClose,
  currentVideoUrl,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  currentVideoUrl?: string;
  onSelect: (url: string) => void;
}) => {
  const [keyword, setKeyword] = useState("");

  const { data, isLoading } = useMoodVideosQuery({
    page: 1,
    limit: 40,
    keyword: keyword || undefined,
    isActive: true,
    sort: "popular",
  });

  const videos = data?.videos ?? [];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="picker-bd"
            className="absolute inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          {/* Sheet */}
          <motion.div
            key="picker-sheet"
            className="cmo-picker-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="px-4 pt-1 pb-3 flex items-center gap-2.5 shrink-0">
              <div
                className="size-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(168,85,247,0.18)", border: "1px solid rgba(168,85,247,0.25)" }}
              >
                <Film className="size-4 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Chọn Mood Video</p>
                <p className="text-[10px] text-white/40">Video sẽ loop trong khi phát nhạc</p>
              </div>
              <button
                onClick={onClose}
                className="size-7 rounded-full bg-white/8 flex items-center justify-center hover:bg-white/15 transition-colors"
              >
                <X className="size-3.5 text-white/60" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 pb-3 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-white/35" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Tìm kiếm tâm trạng..."
                  className="w-full rounded-xl pl-9 pr-4 py-2 text-sm text-white outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.09)",
                  }}
                  onFocus={(e) => {
                    e.target.style.background = "rgba(255,255,255,0.10)";
                    e.target.style.borderColor = "rgba(255,255,255,0.18)";
                  }}
                  onBlur={(e) => {
                    e.target.style.background = "rgba(255,255,255,0.07)";
                    e.target.style.borderColor = "rgba(255,255,255,0.09)";
                  }}
                />
              </div>
            </div>

            {/* Grid */}
            <div className="cmo-picker-grid flex-1">
              {isLoading
                ? Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-[9/16] rounded-xl animate-pulse"
                      style={{ background: "rgba(255,255,255,0.05)" }}
                    />
                  ))
                : videos.map((video) => {
                    const isSelected = video.videoUrl === currentVideoUrl;
                    return (
                      <button
                        key={video._id}
                        type="button"
                        onClick={() => { onSelect(video.videoUrl); onClose(); }}
                        className={cn("cmo-vcard", isSelected && "cmo-vcard--selected")}
                        aria-label={`${isSelected ? "Đang dùng" : "Chọn"}: ${video.title}`}
                      >
                        {video.thumbnailUrl ? (
                          <img src={video.thumbnailUrl} alt={video.title} loading="lazy" />
                        ) : (
                          <div
                            className="absolute inset-0 flex items-center justify-center"
                            style={{ background: "rgba(255,255,255,0.04)" }}
                          >
                            <Video className="size-5 text-white/20" />
                          </div>
                        )}
                        <div className="cmo-vcard-overlay" />
                        <div className="cmo-vcard-label">
                          <p className="line-clamp-2">{video.title}</p>
                          {video.tags?.length > 0 && (
                            <p className="text-white/38 text-[8px] mt-0.5">
                              #{video.tags[0]}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="cmo-vcard-check">
                            <Check className="size-2.5 text-white stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
              {!isLoading && videos.length === 0 && (
                <div className="col-span-full py-10 text-center text-white/30 text-sm">
                  Không tìm thấy video
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});
MoodPickerSheet.displayName = "MoodPickerSheet";

// ─────────────────────────────────────────────────────────────────────────────
// CINEMATIC LYRIC OVERLAY
// ─────────────────────────────────────────────────────────────────────────────

type AnyLyricLine = {
  startTime?: number;
  endTime?: number;
  start?: number;
  end?: number;
  text: string;
};

const CinematicLyricOverlay = memo(({
  lyrics,
  getCurrentTime,
}: {
  lyrics: AnyLyricLine[] | null;
  getCurrentTime: () => number;
}) => {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!lyrics?.length) return;
    const id = setInterval(() => {
      const ms = getCurrentTime() * 1000;
      const active = lyrics.find((l) => {
        const start = l.startTime ?? l.start ?? 0;
        const end = l.endTime ?? l.end ?? 0;
        return ms >= start && ms <= end;
      });
      setText(active?.text ?? null);
    }, 200);
    return () => clearInterval(id);
  }, [lyrics, getCurrentTime]);

  return (
    <div className="cmo-lyric-center" aria-live="polite" aria-atomic="true">
      <AnimatePresence mode="wait">
        {text && (
          <motion.p
            key={text}
            className="cmo-lyric-text"
            initial={{ opacity: 0, y: 22, scale: 0.94, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -14, scale: 0.97, filter: "blur(6px)" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
});
CinematicLyricOverlay.displayName = "CinematicLyricOverlay";

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface CinematicMoodOverlayProps {
  track: ITrack;
  isPlaying: boolean;
  duration: number;
  getCurrentTime: () => number;
  onSeek: (t: number) => void;
  onClose: () => void;
  lyrics: AnyLyricLine[] | null;
  accentColor?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const CinematicMoodOverlay = memo(({
  track,
  isPlaying,
  duration,
  getCurrentTime,
  onSeek,
  onClose,
  lyrics,
  accentColor = "#a855f7",
}: CinematicMoodOverlayProps) => {
  const dispatch = useDispatch();

  // Resolved mood video — user can override with picker
  const [customVideoUrl, setCustomVideoUrl] = useState<string | undefined>(
    track.moodVideo?.videoUrl
  );

  useEffect(() => {
    setCustomVideoUrl(track.moodVideo?.videoUrl);
  }, [track._id, track.moodVideo?.videoUrl]);

  const videoSrc = customVideoUrl ?? DEAFULT_APP.MOOD_VIDEO_DEFAULT_VALUES;

  // Idle timer: controls fade out after 3s
  const { idle, reset: resetIdle } = useIdleTimer(3000);

  // Picker
  const [pickerOpen, setPickerOpen] = useState(false);

  // Redux state
  const isLoading = useSelector((s: RootState) => {
    const ls = s.player.loadingState;
    return ls === "loading" || ls === "buffering";
  });
  const canPrev = useSelector((s: RootState) =>
    s.player.currentIndex > 0 ||
    s.player.repeatMode !== "off" ||
    s.player.isShuffling,
  );
  const canNext = useSelector((s: RootState) => {
    const { currentIndex, activeQueueIds, repeatMode, isShuffling } = s.player;
    return (
      currentIndex < activeQueueIds.length - 1 ||
      repeatMode !== "off" ||
      isShuffling
    );
  });

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(setIsPlaying(!isPlaying));
  }, [dispatch, isPlaying]);

  const handlePrev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (canPrev) dispatch(prevTrack(getCurrentTime()));
  }, [canPrev, getCurrentTime, dispatch]);

  const handleNext = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (canNext) dispatch(nextTrack());
  }, [canNext, dispatch]);

  // Option A: auto-close when music pauses
  useEffect(() => {
    if (!isPlaying) {
      const t = setTimeout(onClose, 500);
      return () => clearTimeout(t);
    }
  }, [isPlaying, onClose]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (pickerOpen) { setPickerOpen(false); return; }
      onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, pickerOpen]);

  // Prevent body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const controlsVisible = !idle && !pickerOpen;

  return (
    <motion.div
      className="cmo-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.38, ease: "easeOut" }}
      onMouseMove={resetIdle}
      onTouchStart={resetIdle}
      role="dialog"
      aria-modal="true"
      aria-label={`Cinematic: ${track.title}`}
    >
      {/* ── VIDEO ── */}
      <div style={{ position: "absolute", inset: 0 }}>
        <VideoMoodEngine
          src={videoSrc}
          isPlaying={isPlaying}
          accentColor={accentColor}
          blur={0}
        />
      </div>

      {/* ── GRADIENT SCRIMS ── */}
      <div className="cmo-scrim-top" />
      <div className="cmo-scrim-bottom" />

      {/* ── LYRICS ── */}
      <CinematicLyricOverlay lyrics={lyrics} getCurrentTime={getCurrentTime} />

      {/* ── CONTROLS ── */}
      <div
        className={cn(
          "cmo-controls",
          controlsVisible ? "cmo-controls--visible" : "cmo-controls--hidden",
        )}
        onClick={resetIdle}
      >
        {/* TOP BAR */}
        <div className="flex items-start justify-between px-5 pt-6 lg:px-10 lg:pt-8">
          {/* Close */}
          <button
            className="cmo-btn cmo-btn--sm"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            aria-label="Thoát Cinematic"
          >
            <ChevronDown className="size-5" />
          </button>

          {/* Track info */}
          <div className="flex flex-col items-center min-w-0 max-w-[58%] text-center px-2">
            <span
              className="text-[9px] font-bold uppercase tracking-[0.24em] mb-1"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              🎬 Cinematic
            </span>
            <p
              className="text-base font-bold text-white truncate w-full leading-tight"
              title={track.title}
            >
              {track.title}
            </p>
            <p className="text-xs truncate w-full" style={{ color: "rgba(255,255,255,0.55)" }}>
              {track.artist?.name ?? ""}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <TrackLikeButton id={track._id} />
            <button
              className={cn(
                "cmo-btn cmo-btn--sm",
                pickerOpen && "bg-[rgba(168,85,247,0.28)] border-[rgba(168,85,247,0.4)]",
              )}
              onClick={(e) => { e.stopPropagation(); setPickerOpen((v) => !v); resetIdle(); }}
              aria-label="Đổi mood video"
              title="Đổi mood video"
            >
              <Film className="size-4" />
            </button>
          </div>
        </div>

        {/* BOTTOM BAR */}
        <div className="px-5 pb-8 lg:px-10 lg:pb-12 space-y-4">
          {/* Seek */}
          <CmoSeekBar
            getCurrentTime={getCurrentTime}
            duration={duration}
            onSeek={onSeek}
            isPlaying={isPlaying}
          />

          {/* Controls row */}
          <div className="flex items-center justify-between">
            {/* Volume */}
            <div className="w-[80px] flex items-center">
              <CmoVolume />
            </div>

            {/* Playback */}
            <div className="flex items-center gap-5">
              <button
                className="cmo-btn cmo-btn--sm"
                onClick={handlePrev}
                disabled={!canPrev}
                aria-label="Bài trước"
              >
                <SkipBack className="size-5 fill-current" />
              </button>

              <button
                className="cmo-btn cmo-btn--play"
                onClick={handleToggle}
                disabled={isLoading}
                aria-label={isPlaying ? "Tạm dừng" : "Phát"}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={isLoading ? "load" : isPlaying ? "pause" : "play"}
                    initial={{ scale: 0.5, opacity: 0, rotate: isPlaying ? 10 : -10 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.14 }}
                    className="flex items-center justify-center"
                  >
                    {isLoading ? (
                      <Loader2 className="size-7 animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="size-7 fill-current" />
                    ) : (
                      <Play className="size-7 fill-current ml-1" />
                    )}
                  </motion.span>
                </AnimatePresence>
              </button>

              <button
                className="cmo-btn cmo-btn--sm"
                onClick={handleNext}
                disabled={!canNext}
                aria-label="Bài tiếp"
              >
                <SkipForward className="size-5 fill-current" />
              </button>
            </div>

            {/* Right spacer */}
            <div className="w-[80px] flex justify-end">
              <span
                className="text-[9px] font-bold uppercase tracking-widest"
                style={{ color: "rgba(255,255,255,0.30)" }}
              >
                MOOD
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── MOOD PICKER SHEET ── */}
      <MoodPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentVideoUrl={customVideoUrl}
        onSelect={(url) => setCustomVideoUrl(url)}
      />
    </motion.div>
  );
});

CinematicMoodOverlay.displayName = "CinematicMoodOverlay";
export default CinematicMoodOverlay;
