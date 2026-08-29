import { ITrackShort } from "../types";
import { useShortAudio } from "../hooks/useShortAudio";
import { VideoMoodEngine } from "@/features/player/components/VideoMoodEngine";
import { Play, Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { MarqueeText } from "@/features/player/components/MarqueeText";
import { Link, useNavigate } from "react-router-dom";
import { useLongPress } from "@/hooks/useLongPress";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Share2, FileText, Zap, Wand2 } from "lucide-react";
import { CLIENT_PATHS } from "@/config/paths";

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
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPreview, setSeekPreview] = useState(0);
  const [showSeekbar, setShowSeekbar] = useState(false);
  const seekbarRef = useRef<HTMLDivElement>(null);

  // ── Drawer state ──────────────────────────────────────────────────────────
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const longPressTriggeredRef = useRef(false);
  const longPress = useLongPress(() => {
    longPressTriggeredRef.current = true;
    setIsDrawerOpen(true);
  }, 500);

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
      {...longPress}
      onClick={(e) => {
        if (longPressTriggeredRef.current) {
          longPressTriggeredRef.current = false;
          return;
        }
        if (isSeeking) return;
        togglePlay();
      }}
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
          <div className="flex items-end justify-between gap-2 w-full">

            {/* Track cover + info */}
            <div className="flex-1 flex flex-col gap-1 mb-1 min-w-0">
              <div className="flex items-center gap-2 max-w-full w-fit bg-white/10 hover:bg-white/20 backdrop-blur-md px-3 py-1.5 cursor-pointer rounded-full transition-colors border border-white/5 hover:border-white/15 shadow-sm overflow-hidden">
                <div className={`relative w-6 h-6 rounded-full overflow-hidden shrink-0 ${isPlaying ? 'animate-spin' : ''}`}
                  style={{ animationDuration: '3s' }}>
                  <ImageWithFallback
                    src={track.coverImage}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
                  <Link to={`/tracks/${track._id}`} className="text-white/90 text-[13px] font-bold truncate hover:underline leading-tight block">
                    {track.title}
                  </Link>
                  {track.artist && (
                    <>
                      <span className="text-white/40 text-[10px] shrink-0 font-black">•</span>
                      <Link to={`/artists/${track.artist?.slug}`} className="text-white/60 text-[11px] font-medium truncate hover:underline leading-tight block">
                        {track.artist?.name || "Unknown Artist"}
                      </Link>
                    </>
                  )}
                </div>
              </div>

              {short.title && (
                <div className="mt-1">
                  <MarqueeText
                    text={short.title}
                    className="text-lg md:text-xl font-black text-white drop-shadow-lg group-hover:text-primary transition-colors"
                    speed={30}
                  />
                </div>
              )}
              {short.caption && (
                <div
                  className="mt-1 relative z-30 cursor-pointer pointer-events-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (short.caption && short.caption.length > 60) {
                      setIsCaptionExpanded(!isCaptionExpanded);
                    }
                  }}
                >
                  <p
                    className={`text-[13px] text-white/90 drop-shadow-md leading-relaxed whitespace-pre-wrap transition-all duration-300 ${isCaptionExpanded ? 'max-h-[35vh] overflow-y-auto pr-2' : 'line-clamp-2'
                      }`}
                    style={isCaptionExpanded ? { overscrollBehavior: 'contain' } : {}}
                  >
                    {short.caption}
                  </p>
                  {short.caption.length > 60 && (
                    <span className="text-white font-bold text-[12px] mt-0.5 drop-shadow-md hover:underline inline-block">
                      {isCaptionExpanded ? 'Thu gọn' : 'Xem thêm'}
                    </span>
                  )}
                </div>
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
              className={`relative w-full cursor-pointer group transition-all duration-200 ${showSeekbar || isSeeking ? "h-5" : "h-3"
                } flex items-center`}
              onPointerDown={handleSeekbarPointerDown}
              onPointerMove={handleSeekbarPointerMove}
              onPointerUp={handleSeekbarPointerUp}
              onPointerCancel={handleSeekbarPointerUp}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {/* Track background */}
              <div className={`w-full rounded-full bg-white/20 overflow-hidden transition-all duration-200 ${showSeekbar || isSeeking ? "h-1.5" : "h-[3px]"
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
                    className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg shadow-black/40 pointer-events-none transition-none ${isSeeking ? "scale-125" : ""
                      }`}
                    style={{ left: `calc(${displayProgress}% - 8px)` }}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* ── Action Menu (Long press) ────────────────────────────────────────── */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="bg-background text-foreground border-border z-[100]">
          <DrawerHeader className="text-left border-b border-border/50 pb-4">
            <DrawerTitle className="text-lg">Tùy chọn Short</DrawerTitle>
            <DrawerDescription className="flex items-center gap-3 mt-3">
              <ImageWithFallback src={track.coverImage} className="w-10 h-10 rounded-md shadow-sm border border-border/50" />
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-foreground line-clamp-1 text-sm">{short.title || track.title}</span>
                <span className="text-xs text-muted-foreground truncate">{track.artist?.name || "Unknown"}</span>
              </div>
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 flex flex-col gap-2">
            <button
              onClick={() => {
                navigate(`/tracks/${track._id}`);
                setIsDrawerOpen(false);
              }}
              className="flex items-center gap-4 w-full p-3 rounded-2xl hover:bg-muted/50 active:bg-muted transition-colors text-left"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold">Chi tiết Track</span>
                <span className="text-xs text-muted-foreground">Xem bài hát gốc</span>
              </div>
            </button>
            <button
              onClick={() => {
                navigate(`/${CLIENT_PATHS.MASHUPS_CREATE}`);
                setIsDrawerOpen(false);
              }}
              className="flex items-center gap-4 w-full p-3 rounded-2xl hover:bg-muted/50 active:bg-muted transition-colors text-left"
            >
              <div className="w-12 h-12 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                <Wand2 className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold">Tạo Mashup</span>
                <span className="text-xs text-muted-foreground">Mix track này với các bài khác</span>
              </div>
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: short.title || track.title, url: window.location.href });
                }
                setIsDrawerOpen(false);
              }}
              className="flex items-center gap-4 w-full p-3 rounded-2xl hover:bg-muted/50 active:bg-muted transition-colors text-left"
            >
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0 text-foreground">
                <Share2 className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold">Chia sẻ</span>
                <span className="text-xs text-muted-foreground">Chia sẻ Short này</span>
              </div>
            </button>
          </div>
          <DrawerFooter className="pt-2 pb-6">
            <DrawerClose asChild>
              <button className="w-full py-3.5 rounded-2xl bg-muted hover:bg-muted/80 text-foreground font-bold transition-colors">
                Đóng
              </button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
