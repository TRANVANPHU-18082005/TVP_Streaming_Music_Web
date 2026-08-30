import { IMashup } from "../types";
import { TRANSITION_META } from "../types";
import { useMashupPlayer } from "../hooks/useMashupPlayer";
import { VideoMoodEngine } from "@/features/player/components/VideoMoodEngine";
import { Play, Layers, ChevronRight, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { MarqueeText } from "@/features/player/components/MarqueeText";
import { useNavigate } from "react-router-dom";
import { useCallback, useState, useRef, useEffect } from "react";
import { useLongPress } from "@/hooks/useLongPress";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Share2, FileText, Wand2, Repeat, ChevronDown } from "lucide-react";
import { MashupTransitionEffect } from "./MashupTransitionEffect";
import { MashupWaveformBar } from "./MashupWaveformBar";
import { CLIENT_PATHS } from "@/config/paths";

interface MashupFeedItemProps {
  mashup: IMashup;
  isActive: boolean;
  onEnd?: () => void;
  isAutoNext?: boolean;
  onToggleAutoNext?: () => void;
}

/** Countdown "3 2 1" shown in the last 3s before a transition */
const CountdownDot = ({ seconds }: { seconds: number }) => (
  <AnimatePresence>
    {seconds > 0 && (
      <motion.div
        key={seconds}
        initial={{ opacity: 0, scale: 1.6 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.6 }}
        transition={{ duration: 0.25 }}
        className="text-white/80 font-mono font-black text-5xl drop-shadow-2xl select-none"
      >
        {seconds}
      </motion.div>
    )}
  </AnimatePresence>
);

export const MashupFeedItem = ({ mashup, isActive, onEnd, isAutoNext, onToggleAutoNext }: MashupFeedItemProps) => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onTransitionStart = useCallback((fromIdx: number, toIdx: number) => {
    // 3-second countdown before transition
    setCountdown(3);
    let c = 3;
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(countdownRef.current!);
        countdownRef.current = null;
      }
    }, 1000);
  }, []);

  const {
    isPlaying,
    progress,
    currentIndex,
    transitionState,
    activeTransitionType,
    analyserNode,
    togglePlay,
    skipTo,
  } = useMashupPlayer(mashup, isActive, onTransitionStart, onEnd);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const currentShort = mashup.shorts[currentIndex]?.short;
  const nextShort = mashup.shorts[currentIndex + 1]?.short;
  const transitionMeta = activeTransitionType ? TRANSITION_META[activeTransitionType] : null;

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const longPressTriggeredRef = useRef(false);
  const longPress = useLongPress(() => {
    longPressTriggeredRef.current = true;
    setIsDrawerOpen(true);
  }, 500);

  const handleNavigateDetail = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/mashups/${mashup._id}`);
  }, [navigate, mashup._id]);

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
        togglePlay();
      }}
    >
      {/* ── Background Mood Video ─────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <VideoMoodEngine
          src={currentShort?.moodVideo?.videoUrl || null}
          isPlaying={isPlaying}
          blur={0}
        />
      </div>

      {/* Cinematic gradient layers */}
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/60 via-transparent to-black/90 pointer-events-none" />
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-black/30 via-transparent to-transparent pointer-events-none" />

      {/* ── Visual Transition Effects ─────────────────────────────────── */}
      <MashupTransitionEffect
        transitionState={transitionState}
        transitionType={activeTransitionType}
        nextTrackTitle={nextShort?.track?.title}
        nextTrackArtist={nextShort?.track?.artist?.name}
      />

      {/* ── Pause indicator ─────────────────────────────────────────────── */}
      <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
        <AnimatePresence>
          {!isPlaying && isActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="w-24 h-24 rounded-full bg-black/50 backdrop-blur-xl flex items-center justify-center border border-white/10 shadow-2xl"
            >
              <Play className="w-12 h-12 text-white opacity-90" fill="white" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Transition Countdown ─────────────────────────────────────────── */}
      <div className="absolute inset-0 flex items-center justify-center z-25 pointer-events-none">
        <CountdownDot seconds={countdown} />
      </div>

      {/* ── DJ HUD (top-right) ────────────────────────────────────────── */}
      <div className="absolute top-16 right-4 z-30 flex flex-col items-end gap-2 pointer-events-none">
        {/* Live badge */}
        {isPlaying && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1.5 bg-red-500/90 backdrop-blur px-2 py-1 rounded-md"
          >
            <motion.div
              className="w-1.5 h-1.5 bg-white rounded-full"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
            />
            <span className="text-white text-[10px] font-black uppercase tracking-widest">Live</span>
          </motion.div>
        )}

        {/* Active transition effect badge */}
        <AnimatePresence>
          {transitionMeta && (
            <motion.div
              key={activeTransitionType}
              initial={{ opacity: 0, y: -8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border backdrop-blur-md"
              style={{
                backgroundColor: `${transitionMeta.color}20`,
                borderColor: `${transitionMeta.color}50`,
                color: transitionMeta.color,
              }}
            >
              <span>{transitionMeta.icon}</span>
              <span>{transitionMeta.label}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Energy bar */}
        {isPlaying && (
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-white/40 text-[9px] font-medium uppercase tracking-wide">Energy</span>
            <div className="flex items-end gap-0.5 h-5">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1 rounded-t-sm bg-primary"
                  animate={{ height: [`${30 + i * 10}%`, `${60 + i * 8}%`, `${30 + i * 10}%`] }}
                  transition={{ repeat: Infinity, duration: 0.6 + i * 0.1, ease: "easeInOut" }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div className="relative z-20 w-full h-full flex flex-col justify-end pb-4 pointer-events-none">

        {/* Waveform visualizer strip */}
        <div className="px-4 mb-3 pointer-events-none">
          <MashupWaveformBar
            analyserNode={analyserNode}
            isPlaying={isPlaying}
            bars={40}
            color="rgba(255,255,255,0.6)"
            height={32}
          />
        </div>

        <div className="flex items-end justify-between gap-4 px-4 md:px-6 w-full max-w-7xl mx-auto pointer-events-auto">

          {/* Left: Info */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">

            {/* Mashup tag + track dots */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1 px-2 py-0.5 bg-primary/50 backdrop-blur rounded-md text-[10px] font-black text-white uppercase tracking-wider shadow-sm">
                <Layers className="w-2.5 h-2.5" /> Mashup
              </span>
              {/* Track dots */}
              <div
                className="flex gap-1.5 items-center"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                {mashup.shorts.map((_, i) => (
                  <button
                    key={i}
                    onClick={e => { e.stopPropagation(); skipTo(i); }}
                    className={`rounded-full transition-all duration-300 ${i === currentIndex
                      ? 'w-5 h-2 bg-primary shadow-[0_0_6px_rgba(99,102,241,0.8)]'
                      : 'w-2 h-2 bg-white/30 hover:bg-white/60'
                      }`}
                  />
                ))}
              </div>
              <span className="text-white/40 text-[10px] font-mono">{currentIndex + 1}/{mashup.shorts.length}</span>
            </div>

            {/* Mashup title */}
            <div
              className="cursor-pointer group relative z-30"
              onClick={(e) => {
                e.stopPropagation();
                handleNavigateDetail(e);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <MarqueeText
                text={mashup.title}
                className="text-lg md:text-xl font-black text-white drop-shadow-lg group-hover:text-primary transition-colors"
                speed={30}
              />
              <div
                className="mt-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  const desc = mashup.description || "";
                  if (desc.length > 60) setIsDescExpanded(!isDescExpanded);
                }}
              >
                <p
                  className={`text-[13px] text-white/80 drop-shadow-md leading-relaxed whitespace-pre-wrap transition-all duration-300 ${isDescExpanded ? 'max-h-[35vh] overflow-y-auto pr-2' : 'line-clamp-2'
                    }`}
                  style={isDescExpanded ? { overscrollBehavior: 'contain' } : {}}
                >
                  {mashup.description || `${mashup.shorts.length} tracks • DJ Mashup`}
                </p>
                {(mashup.description?.length || 0) > 60 && (
                  <span className="text-white font-bold text-[12px] mt-0.5 drop-shadow-md hover:underline inline-block">
                    {isDescExpanded ? 'Thu gọn' : 'Xem thêm'}
                  </span>
                )}
              </div>
            </div>

            {/* Current track card */}
            <AnimatePresence mode="wait">
              <motion.button
                key={currentIndex}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                onClick={e => { e.stopPropagation(); navigate(`/tracks/${currentShort?.track?._id}`); }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className="flex items-center gap-2 max-w-full w-fit bg-white/10 hover:bg-white/20 backdrop-blur-md px-3 py-1.5 cursor-pointer rounded-full transition-colors border border-white/5 hover:border-white/15 shadow-sm overflow-hidden"
              >
                {/* Spinning cover */}
                <div className={`relative w-6 h-6 rounded-full overflow-hidden shrink-0 ${isPlaying ? 'animate-spin' : ''}`}
                  style={{ animationDuration: '3s' }}>
                  <ImageWithFallback src={currentShort?.track?.coverImage} className="w-full h-full object-cover" />
                </div>

                <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
                  <span className="text-white/90 text-[13px] font-bold truncate hover:underline leading-tight block">
                    {currentShort?.track?.title || "—"}
                  </span>
                  {currentShort?.track?.artist && (
                    <>
                      <span className="text-white/40 text-[10px] shrink-0 font-black">•</span>
                      <span className="text-white/60 text-[11px] font-medium truncate hover:underline leading-tight block">
                        {currentShort?.track?.artist?.name}
                      </span>
                    </>
                  )}
                </div>
                <ChevronRight className="w-3 h-3 text-white/40 shrink-0 ml-1" />
              </motion.button>
            </AnimatePresence>
          </div>

          {/* Right: Social buttons */}
          <div className="flex flex-col items-center gap-5 pb-2 shrink-0">


            {/* View Detail */}
            <button
              className="flex flex-col items-center gap-1.5 group"
              onClick={handleNavigateDetail}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <motion.div
                whileTap={{ scale: 0.8 }}
                className="w-12 h-12 rounded-full overflow-hidden border border-white/20 hover:border-primary/50 relative transition-all shadow-lg"
              >
                <ImageWithFallback
                  src={mashup.coverImage || mashup.shorts[0]?.short?.track?.coverImage}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 hover:bg-black/20 transition-colors flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white drop-shadow-lg" />
                </div>
              </motion.div>
              <span className="text-[11px] text-white/90 font-bold drop-shadow-md">Full</span>
            </button>
          </div>
        </div>

        {/* ── Segmented progress bar (per track) ───────────────────────── */}
        <div className="flex gap-0.5 px-4 mt-4 pointer-events-none">
          {mashup.shorts.map((_, i) => {
            const isCurrentTrack = i === currentIndex;
            const isPastTrack = i < currentIndex;
            return (
              <div key={i} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden relative">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-white rounded-full"
                  initial={false}
                  animate={{
                    width: isPastTrack ? "100%" : isCurrentTrack ? `${progress}%` : "0%",
                  }}
                  transition={{ duration: 0.1, ease: "linear" }}
                />
              </div>
            );
          })}
        </div>

      </div>

      {/* ── Action Menu (Long press) ────────────────────────────────────────── */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="bg-background text-foreground border-border z-[100]">
          <DrawerHeader className="text-left border-b border-border/50 pb-4">
            <DrawerTitle className="text-lg">Tùy chọn Mashup</DrawerTitle>
            <DrawerDescription className="flex items-center gap-3 mt-3">
              <ImageWithFallback src={mashup.coverImage || mashup.shorts[0]?.short?.track?.coverImage} className="w-10 h-10 rounded-md shadow-sm border border-border/50" />
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-foreground line-clamp-1 text-sm">{mashup.title}</span>
              </div>
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 flex flex-col gap-2">
            <button
              onClick={() => {
                navigate(`/mashups/${mashup._id}`);
                setIsDrawerOpen(false);
              }}
              className="flex items-center gap-4 w-full p-3 rounded-2xl hover:bg-muted/50 active:bg-muted transition-colors text-left"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold">Chi tiết Mashup</span>
                <span className="text-xs text-muted-foreground">Xem tất cả các track được mix</span>
              </div>
            </button>
            
            {/* Nút Toggle Tự động lướt */}
            {onToggleAutoNext && (
              <button
                onClick={() => {
                  onToggleAutoNext();
                  setIsDrawerOpen(false);
                }}
                className="flex items-center gap-4 w-full p-3 rounded-2xl hover:bg-muted/50 active:bg-muted transition-colors text-left"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isAutoNext ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {isAutoNext ? <ChevronDown className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                </div>
                <div className="flex flex-col flex-1">
                  <span className="text-sm font-bold">
                    {isAutoNext ? 'Tự động lướt: Đang BẬT' : 'Tự động lướt: Đang TẮT'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {isAutoNext ? 'Tự động sang Mashup tiếp theo' : 'Lặp lại Mashup hiện tại'}
                  </span>
                </div>
              </button>
            )}

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
                <span className="text-xs text-muted-foreground">Tạo bản Mashup mới của riêng bạn</span>
              </div>
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: mashup.title, url: window.location.href });
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
                <span className="text-xs text-muted-foreground">Chia sẻ Mashup này</span>
              </div>
            </button>
          </div>
          <DrawerFooter className="pt-2 pb-6">
            <DrawerClose asChild>
              <button className="w-full py-3.5 rounded-2xl bg-muted hover:bg-muted/80 text-foreground font-bold transition-colors">
                Hủy
              </button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
