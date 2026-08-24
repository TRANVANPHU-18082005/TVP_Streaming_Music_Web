import { ITrackShort } from "../types";
import { useShortAudio } from "../hooks/useShortAudio";
import { VideoMoodEngine } from "@/features/player/components/VideoMoodEngine";
import { Play, Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { MarqueeText } from "@/features/player/components/MarqueeText";
import { useNavigate } from "react-router-dom";

interface ShortFeedItemProps {
  short: ITrackShort;
  isActive: boolean;
}

export const ShortFeedItem = ({ short, isActive }: ShortFeedItemProps) => {
  const { track, moodVideo } = short;
  const navigate = useNavigate();

  // ── Audio hook (đã fix race condition + reset + seek) ────────────────────
  const { isPlaying, progress, isLoading, togglePlay, seek } = useShortAudio(
    track.hlsUrl || track.trackUrl,
    short.startTime,
    short.endTime,
    isActive,
  );

  // ── Seekbar drag state ────────────────────────────────────────────────────
  const [isSeeking, setIsSeeking]       = useState(false);
  const [seekPreview, setSeekPreview]   = useState(0);
  const [showSeekbar, setShowSeekbar]   = useState(false);
  const seekbarRef = useRef<HTMLDivElement>(null);

  const getSeekPercent = useCallback((e: React.PointerEvent | React.MouseEvent | React.TouchEvent): number => {
    const bar = seekbarRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    let clientX: number;
    if ("touches" in e) {
      clientX = e.touches[0]?.clientX ?? rect.left;
    } else {
      clientX = (e as React.MouseEvent).clientX;
    }
    const raw = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(100, raw * 100));
  }, []);

  const handleSeekbarPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsSeeking(true);
      const pct = getSeekPercent(e);
      setSeekPreview(pct);
      seek(pct);
    },
    [getSeekPercent, seek],
  );

  const handleSeekbarPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isSeeking) return;
      e.stopPropagation();
      const pct = getSeekPercent(e);
      setSeekPreview(pct);
      seek(pct);
    },
    [isSeeking, getSeekPercent, seek],
  );

  const handleSeekbarPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isSeeking) return;
      e.stopPropagation();
      setIsSeeking(false);
    },
    [isSeeking],
  );

  const handleNavigateTrack = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigate(`/tracks/${track._id}`);
    },
    [navigate, track._id],
  );

  // Hiển thị progress dùng cho UI (khi đang kéo thì dùng seekPreview)
  const displayProgress = isSeeking ? seekPreview : progress;

  // Tính thời gian hiển thị
  const totalDuration = short.endTime - short.startTime;
  const currentSec = Math.floor((displayProgress / 100) * totalDuration);
  const totalSec = Math.floor(totalDuration);
  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div
      className="relative w-full bg-black snap-start snap-always overflow-hidden select-none"
      style={{ height: "100%" }}
      onClick={isSeeking ? undefined : togglePlay}
      onMouseEnter={() => setShowSeekbar(true)}
      onMouseLeave={() => !isSeeking && setShowSeekbar(false)}
    >
      {/* ── Background Mood Video ────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <VideoMoodEngine
          src={moodVideo?.videoUrl || null}
          isPlaying={isPlaying}
          blur={0}
        />
      </div>

      {/* ── Gradient scrims ──────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/40 via-transparent to-black/80 pointer-events-none" />

      {/* ── Main Content Area ────────────────────────────────────────────── */}
      <div className="relative z-20 w-full h-full flex flex-col justify-end pointer-events-none">

        {/* ── Center: Play / Pause / Loading indicator ─────────────────── */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <AnimatePresence mode="wait">
            {isLoading && isActive ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center"
              >
                <Loader2 className="w-7 h-7 text-white/80 animate-spin" />
              </motion.div>
            ) : !isPlaying && isActive && !isLoading ? (
              <motion.div
                key="paused"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                className="w-20 h-20 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center"
              >
                <Play className="w-10 h-10 text-white opacity-80 ml-1" fill="white" />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* ── Bottom Info Section ───────────────────────────────────────── */}
        <div className="px-4 pb-2 md:px-6 pointer-events-auto">
          <div className="flex items-end gap-3 w-full">

            {/* Track cover + info */}
            <div className="flex-1 flex flex-col gap-1 mb-1">
              <div
                onClick={handleNavigateTrack}
                className="flex items-center gap-2 w-fit bg-white/10 hover:bg-white/20 backdrop-blur-md px-3 py-1.5 cursor-pointer rounded-full transition-colors"
              >
                <ImageWithFallback
                  src={track.coverImage}
                  className="w-5 h-5 rounded-full object-cover"
                />
                <span className="text-white/80 text-xs font-medium truncate max-w-[140px]">
                  {track.title}
                </span>
              </div>

              {short.title && (
                <MarqueeText
                  text={short.title}
                  className="text-base md:text-lg font-bold text-white/90 drop-shadow-md"
                  speed={30}
                />
              )}
              {short.caption && (
                <p className="text-xs text-white/70 max-w-xs drop-shadow-md line-clamp-2 leading-snug">
                  {short.caption}
                </p>
              )}
            </div>
          </div>

          {/* ── Seekbar + Time display ─────────────────────────────────── */}
          <div className="mt-3 mb-1 pointer-events-auto" onClick={(e) => e.stopPropagation()}>

            {/* Time labels — hiển thị khi hover hoặc đang seek */}
            <AnimatePresence>
              {(showSeekbar || isSeeking) && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15 }}
                  className="flex justify-between text-[10px] text-white/50 font-mono mb-1.5 px-0.5"
                >
                  <span>{fmtTime(currentSec)}</span>
                  <span>{fmtTime(totalSec)}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Seekbar track */}
            <div
              ref={seekbarRef}
              className={`relative w-full cursor-pointer group transition-all duration-200 ${
                showSeekbar || isSeeking ? "h-5" : "h-3"
              } flex items-center`}
              onPointerDown={handleSeekbarPointerDown}
              onPointerMove={handleSeekbarPointerMove}
              onPointerUp={handleSeekbarPointerUp}
              onPointerCancel={handleSeekbarPointerUp}
            >
              {/* Track background */}
              <div className={`w-full rounded-full bg-white/20 overflow-hidden transition-all duration-200 ${
                showSeekbar || isSeeking ? "h-1.5" : "h-[3px]"
              }`}>
                {/* Filled portion */}
                <div
                  className="h-full bg-white rounded-full transition-none"
                  style={{ width: `${displayProgress}%` }}
                />
              </div>

              {/* Thumb — chỉ visible khi hover hoặc đang seek */}
              <AnimatePresence>
                {(showSeekbar || isSeeking) && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg shadow-black/40 pointer-events-none transition-none ${
                      isSeeking ? "scale-125" : ""
                    }`}
                    style={{ left: `calc(${displayProgress}% - 8px)` }}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
