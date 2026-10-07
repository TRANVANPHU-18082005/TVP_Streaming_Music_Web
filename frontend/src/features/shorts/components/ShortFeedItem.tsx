import { ITrackShort } from "../types";
import { useShortAudio } from "../hooks/useShortAudio";
import { VideoMoodEngine } from "@/features/player/components/VideoMoodEngine";
import { Play, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { MarqueeText } from "@/features/player/components/MarqueeText";
import { Link, useNavigate } from "react-router-dom";
import { useLongPress } from "@/hooks/useLongPress";
import {
  ActionButton,
  type ActionItem,
  CancelFooter,
  HandleBar,
  SheetBackdrop,
  SheetWrapper,
} from "@/app/context/sheetPrimitives";
import { Share2, FileText, Wand2, Repeat, ChevronDown, Heart } from "lucide-react";
import { CLIENT_PATHS } from "@/config/paths";
import { shortsApi } from "../api/shortsApi";
import { useAppSelector } from "@/store/hooks";
import { toast } from "sonner";
import { buildShareUrl, shareOrCopy } from "@/utils/share";

interface ShortFeedItemProps {
  short: ITrackShort;
  isActive: boolean;
  prefetch?: boolean;
  onEnd?: () => void;
  isAutoNext?: boolean;
  onToggleAutoNext?: () => void;
}

export const ShortFeedItem = ({ short, isActive, prefetch = false, onEnd, isAutoNext, onToggleAutoNext }: ShortFeedItemProps) => {
  const { track, moodVideo } = short;
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(short.likeCount || 0);

  // ── Audio hook (đã fix race condition + reset + seek) ────────────────────
  const src = track?.hlsUrl || track?.trackUrl || "";
  const { isPlaying, progress, isLoading, autoplayBlocked, togglePlay, seek } = useShortAudio(
    src,
    short.startTime,
    short.endTime,
    isActive && Boolean(track),
    onEnd,
    prefetch && Boolean(track),
  );

  // ── Seekbar drag state ────────────────────────────────────────────────────
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPreview, setSeekPreview] = useState(0);
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

  useEffect(() => {
    if (!isActive) return;
    void shortsApi.recordView(short._id).catch(() => undefined);
  }, [isActive, short._id]);

  const shareShort = useCallback(async () => {
    const result = await shareOrCopy({
      title: short.title || track?.title || "TVP Music",
      url: buildShareUrl(`/${CLIENT_PATHS.SHORTS}/${short._id}`),
    });
    if (result === "dismissed" || !user) return;
    try {
      await shortsApi.shareShort(short._id);
    } catch {
      /* user dismissed the share sheet */
    }
  }, [short._id, short.title, track?.title, user]);

  const likeShort = useCallback(async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!user) {
      navigate("/login");
      return;
    }
    try {
      const result = await shortsApi.likeShort(short._id);
      setLiked(result.data.liked);
      setLikeCount(result.data.likeCount);
    } catch {
      toast.error("Không thả tim được");
    }
  }, [navigate, short._id, user]);

  const displayProgress = isSeeking ? seekPreview : progress;

  // Tính thời gian hiển thị
  const totalDuration = short.endTime - short.startTime;
  const currentSec = Math.floor((displayProgress / 100) * totalDuration);
  const totalSec = Math.floor(totalDuration);
  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const actions = useMemo<ActionItem[]>(() => {
    const list: ActionItem[] = [
      {
        icon: FileText,
        label: "Nghe cả bài",
        onClick: () => {
          navigate(`/tracks/${track._id}`);
          setIsDrawerOpen(false);
        },
      },
    ];

    if (onToggleAutoNext) {
      list.push({
        icon: isAutoNext ? ChevronDown : Repeat,
        label: isAutoNext ? 'Tự động lướt: Đang BẬT' : 'Tự động lướt: Đang TẮT',
        onClick: () => {
          onToggleAutoNext();
          setIsDrawerOpen(false);
        },
      });
    }

    list.push(
      {
        icon: Wand2,
        label: "Thêm vào mashup",
        onClick: () => {
          navigate(`/${CLIENT_PATHS.MASHUPS_CREATE}`, { state: { seedShort: short } });
          setIsDrawerOpen(false);
        },
      },
      {
        icon: Share2,
        label: "Chia sẻ",
        onClick: () => {
          void shareShort();
          setIsDrawerOpen(false);
        },
      }
    );
    return list;
  }, [track?._id, isAutoNext, onToggleAutoNext, short, shareShort, navigate]);

  if (!track) {
    return <div className="relative w-full h-full bg-black snap-start snap-always" />;
  }

  return (
    <div
      className="relative w-full bg-black snap-start snap-always overflow-hidden select-none"
      style={{ height: "100%" }}
      {...longPress}
      onClick={() => {
        if (longPressTriggeredRef.current) {
          longPressTriggeredRef.current = false;
          return;
        }
        if (isSeeking) return;
        togglePlay();
      }}
    >
      {isActive && autoplayBlocked && (
        <button
          type="button"
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/35"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
        >
          <span className="px-5 py-2.5 rounded-full bg-white text-black text-sm font-semibold">
            Chạm để bật tiếng
          </span>
        </button>
      )}

      {/* ── Background Mood Video ────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        {(isActive || prefetch) && moodVideo?.videoUrl ? (
          <VideoMoodEngine
            src={moodVideo.videoUrl}
            isPlaying={isActive && isPlaying}
            preload={isActive && isPlaying ? "auto" : "none"}
            blur={0}
          />
        ) : (
          <ImageWithFallback
            src={track.coverImage}
            className="w-full h-full object-cover scale-110 blur-md"
          />
        )}
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
        <div className="px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 pointer-events-auto">
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
                  {track.isExplicit && (
                    <span className="text-[10px] font-bold text-white/80 border border-white/30 rounded px-1">E</span>
                  )}
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

            <div className="flex justify-between text-[10px] text-white/50 font-mono mb-1.5 px-0.5">
              <span>{fmtTime(currentSec)}</span>
              <span>{fmtTime(totalSec)}</span>
            </div>

            <div
              ref={seekbarRef}
              className="relative w-full h-5 cursor-pointer group flex items-center"
              onPointerDown={handleSeekbarPointerDown}
              onPointerMove={handleSeekbarPointerMove}
              onPointerUp={handleSeekbarPointerUp}
              onPointerCancel={handleSeekbarPointerUp}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <div className="w-full h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-none"
                  style={{ width: `${displayProgress}%` }}
                />
              </div>
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg shadow-black/40 pointer-events-none"
                style={{ left: `calc(${displayProgress}% - 8px)` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute right-3 bottom-[35vh] z-30 flex flex-col items-center gap-3">
        <button type="button" onClick={likeShort} className="flex flex-col items-center text-white">
          <Heart className={`w-7 h-7 ${liked ? "fill-rose-500 text-rose-500" : ""}`} />
          <span className="text-[11px]">{likeCount}</span>
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void shareShort();
          }}
          className="text-white"
        >
          <Share2 className="w-6 h-6" />
        </button>
      </div>

      {/* ── Action Menu (Long press) ────────────────────────────────────────── */}
      {createPortal(
        <>
          <AnimatePresence>
            {isDrawerOpen && (
              <SheetBackdrop key="backdrop" onClick={() => setIsDrawerOpen(false)} zIndex={100} />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isDrawerOpen && (
              <SheetWrapper
                key="wrapper"
                ariaLabel={`Tùy chọn cho short ${short.title || track.title}`}
                zIndex={101}
                onClose={() => setIsDrawerOpen(false)}
              >
                <HandleBar />
                <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
                  <ImageWithFallback src={track.coverImage} className="w-14 h-14 rounded-xl object-cover ring-1 ring-border shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{short.title || track.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{track.artist?.name || "Unknown"}</p>
                  </div>
                </div>
                <div className="py-2">
                  {actions.map((action) => (
                    <ActionButton key={action.label} {...action} />
                  ))}
                </div>
                <CancelFooter onClose={() => setIsDrawerOpen(false)} />
              </SheetWrapper>
            )}
          </AnimatePresence>
        </>,
        document.body
      )}
    </div>
  );
};
