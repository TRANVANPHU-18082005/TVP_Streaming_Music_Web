import { useParams, useNavigate } from "react-router-dom";
import { useMashupDetail } from "../hooks/useMashups";
import {
  Play, Pause, Music2, Share2, Heart, ArrowLeft, Disc3,
  Layers, Clock, BarChart2, ChevronRight, Zap, SkipBack, SkipForward
} from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { useMashupPlayer } from "../hooks/useMashupPlayer";
import { PremiumMusicVisualizer } from "@/components/MusicVisualizer";
import { useState, useCallback, useEffect, useRef } from "react";
import { mashupApi } from "../api/mashupApi";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import { setIsPlaying, selectPlayer } from "@/features/player/slice/playerSlice";
import { motion, AnimatePresence } from "framer-motion";
import { TRANSITION_META, formatMashupDuration, calcMashupDuration } from "../types";
import { MashupWaveformBar } from "../components/MashupWaveformBar";
import { MashupTransitionEffect } from "../components/MashupTransitionEffect";
import { useIsMobile } from "@/components/ui/use-mobile";

// ─── Vinyl Record ─────────────────────────────────────────────────────────────
const VinylRecord = ({
  coverUrl,
  isPlaying,
  isCurrent,
  size = 120,
}: {
  coverUrl?: string;
  isPlaying: boolean;
  isCurrent: boolean;
  size?: number;
}) => (
  <div
    className="relative rounded-full flex-shrink-0 overflow-hidden"
    style={{
      width: size,
      height: size,
      animation: isPlaying && isCurrent ? "spin 3s linear infinite" : "none",
    }}
  >
    {/* Vinyl grooves */}
    <div
      className="absolute inset-0 rounded-full bg-neutral-900 border border-black/20"
      style={{
        background: `
          radial-gradient(circle at 50% 50%,
            transparent 20%,
            rgba(255,255,255,0.03) 21%, rgba(255,255,255,0.03) 22%, transparent 23%,
            rgba(255,255,255,0.03) 28%, rgba(255,255,255,0.03) 29%, transparent 30%,
            rgba(255,255,255,0.03) 35%, rgba(255,255,255,0.03) 36%, transparent 37%,
            rgba(255,255,255,0.03) 43%, rgba(255,255,255,0.03) 44%, transparent 45%
          )
        `,
      }}
    />
    {/* Album art center */}
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        className="rounded-full overflow-hidden border-2 border-black/40 shadow-inner"
        style={{ width: size * 0.42, height: size * 0.42 }}
      >
        <ImageWithFallback
          src={coverUrl}
          className="w-full h-full object-cover"
        />
      </div>
    </div>
    {/* Center hole */}
    <div
      className="absolute rounded-full bg-black"
      style={{
        width: size * 0.08,
        height: size * 0.08,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }}
    />
    {/* Shine */}
    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
  </div>
);

const Crossfader = ({ position }: { position: number }) => (
  <div className="flex flex-col items-center gap-1.5">
    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Crossfader</span>
    <div className="relative w-40 md:w-48 h-2 bg-muted rounded-full overflow-visible border border-border/50">
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-background dark:bg-muted border border-border shadow-[0_2px_10px_rgba(0,0,0,0.15)] cursor-grab z-10"
        animate={{ left: `${position}%` }}
        style={{ marginLeft: "-10px" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
      <div className="absolute left-0 top-0 bottom-0 bg-primary rounded-full" style={{ width: `${position}%` }} />
    </div>
    <div className="flex justify-between w-full text-[9px] text-muted-foreground font-mono px-1">
      <span className="font-bold">A</span><span className="font-bold">B</span>
    </div>
  </div>
);

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export const MashupDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const player = useSelector(selectPlayer);

  useEffect(() => {
    if (player.isPlaying) dispatch(setIsPlaying(false));
  }, [dispatch, player.isPlaying]);

  const { data, isLoading, isError } = useMashupDetail(id || "");
  const mashup = data?.data;
  console.log(mashup);
  const [shouldPlay, setShouldPlay] = useState(false);
  const [crossfaderPos, setCrossfaderPos] = useState(50);
  const activeItemRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();
  const onTransitionStart = useCallback((fromIdx: number, toIdx: number) => {
    // animate crossfader position
    setCrossfaderPos(toIdx % 2 === 0 ? 30 : 70);
    setTimeout(() => setCrossfaderPos(50), 2000);
  }, []);

  const {
    isPlaying, progress, currentIndex,
    transitionState, activeTransitionType, analyserNode,
    togglePlay, skipTo,
  } = useMashupPlayer(mashup || null, shouldPlay, onTransitionStart);

  const [shareCount, setShareCount] = useState(0);
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  useEffect(() => {
    if (mashup) {
      setShareCount(mashup.shareCount || 0);
    }
  }, [mashup]);

  useEffect(() => { setShouldPlay(isPlaying); }, [isPlaying]);

  // Auto-scroll active timeline item into view
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [currentIndex]);

  const handleTogglePlay = useCallback(() => setShouldPlay(prev => !prev), []);



  const handleShare = useCallback(async () => {
    if (!mashup) return;
    setShareCount(prev => prev + 1);
    try {
      await mashupApi.shareMashup(mashup._id);
      if (navigator.share) {
        navigator.share({ title: mashup.title, url: window.location.href });
      } else {
        navigator.clipboard.writeText(window.location.href);
        toast.success("Đã copy link!");
      }
    } catch { }
  }, [mashup]);

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-background flex flex-col items-center justify-center gap-4">
        <PremiumMusicVisualizer active={true} />
        <p className="text-muted-foreground mt-4 font-display">Đang tải Mashup...</p>
      </div>
    );
  }

  if (isError || !mashup) {
    return (
      <div className="w-full h-screen bg-background flex flex-col items-center justify-center gap-4">

        <Music2 className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground font-display text-lg">Không tìm thấy Mashup.</p>
        <button
          onClick={() => navigate("/mashups/feed")}
          className="mt-4 px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-full hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
        >
          Quay lại Feed
        </button>
      </div>
    );
  }

  const currentShort = mashup.shorts[currentIndex]?.short;
  const nextShort = mashup.shorts[currentIndex + 1]?.short;
  const coverUrl = mashup.coverImage || mashup.shorts[0]?.short?.track?.coverImage;
  const totalDurationStr = formatMashupDuration(calcMashupDuration(mashup.shorts));
  const transitionMeta = activeTransitionType ? TRANSITION_META[activeTransitionType] : null;

  return (
    <div className="w-full min-h-screen bg-background text-foreground overflow-x-hidden relative">
      {/* Visual transition overlay */}
      <MashupTransitionEffect
        transitionState={transitionState}
        transitionType={activeTransitionType}
        nextTrackTitle={nextShort?.track?.title}
        nextTrackArtist={nextShort?.track?.artist?.name}
      />

      {/* Ambient background */}
      <div className="fixed inset-0 opacity-20 pointer-events-none overflow-hidden z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="w-full h-full"
          >
            <ImageWithFallback
              src={currentShort?.track?.coverImage || coverUrl}
              className="w-full h-full object-cover blur-[80px] saturate-200 scale-150"
            />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto pt-2 px-4 md:px-6 pb-4">

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors text-sm font-medium w-fit hover:bg-muted/50 py-1.5 px-3 -ml-3 rounded-full"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại
        </button>

        {/* ── Hero Section ─────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row gap-8 lg:gap-12 items-center md:items-end mb-12">
          {/* Cover art */}
          <div className="relative group shrink-0">
            <div className="w-60 h-60 md:w-64 md:h-64 lg:w-72 lg:h-72 rounded-full overflow-hidden shadow-2xl shadow-primary/20 group-hover:shadow-primary/40 transition-shadow relative border-4 border-background dark:border-card">
              <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none z-10" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/30" />
                <motion.circle
                  cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="2"
                  className="text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]"
                  strokeDasharray="301.59"
                  strokeDashoffset={301.59 - (301.59 * progress) / 100}
                  transition={{ ease: "linear", duration: 0.1 }}
                />
              </svg>
              <div className="absolute inset-2 rounded-full overflow-hidden border border-border/50">
                <ImageWithFallback
                  src={coverUrl}
                  className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? "scale-105" : "group-hover:scale-105"}`}
                />
              </div>
              <div className="absolute inset-2 rounded-full bg-black/20 group-hover:bg-black/40 transition-colors pointer-events-none" />
              <button
                onClick={handleTogglePlay}
                className="absolute inset-0 flex items-center justify-center"
              >
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className={`w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center backdrop-blur-md shadow-xl transition-all duration-300 ${isPlaying ? "scale-100 opacity-100" : "scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100"
                    }`}
                >
                  {isPlaying
                    ? <Pause className="w-7 h-7 text-primary-foreground" />
                    : <Play className="w-7 h-7 text-primary-foreground ml-1" fill="currentColor" />
                  }
                </motion.div>
              </button>

            </div>
          </div>

          {/* Info */}
          <div className="flex-1 space-y-4 text-center md:text-left flex flex-col items-center md:items-start w-full">
            {/* Badges */}
            <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
              <span className="px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-md text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                <Layers className="w-3 h-3" /> Mashup
              </span>
              <span className="text-sm text-muted-foreground font-medium">
                {mashup.shorts.length} tracks • {totalDurationStr}
              </span>
              {mashup.status === "draft" && (
                <span className="px-2.5 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-md text-xs font-bold uppercase">
                  Bản nháp
                </span>
              )}
              {mashup.compatibilityScore > 0 && (
                <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md text-xs font-bold">
                  {mashup.compatibilityScore}% Match
                </span>
              )}
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black font-display tracking-tight leading-tight drop-shadow-sm text-foreground">
              {mashup.title}
            </h1>

            {mashup.description && (
              <div
                className="cursor-pointer"
                onClick={() => {
                  if (mashup.description && mashup.description.length > 100) setIsDescExpanded(!isDescExpanded);
                }}
              >
                <p className={`text-muted-foreground text-sm md:text-base leading-relaxed max-w-2xl whitespace-pre-wrap transition-all duration-300 ${isDescExpanded ? 'max-h-[30vh] overflow-y-auto pr-2' : 'line-clamp-2'}`}>
                  {mashup.description}
                </p>
                {mashup.description.length > 100 && (
                  <span className="text-foreground font-bold text-xs mt-1 hover:underline inline-block">
                    {isDescExpanded ? 'Thu gọn' : 'Xem thêm'}
                  </span>
                )}
              </div>
            )}

            {/* Mood tags */}
            {mashup.dominantMoods?.length > 0 && (
              <div className="flex justify-center md:justify-start flex-wrap gap-2">
                {mashup.dominantMoods.map(mood => (
                  <span key={mood} className="px-3 py-1 bg-muted/60 dark:bg-muted/40 border border-border/80 rounded-full text-sm hover:bg-muted transition-colors cursor-pointer text-foreground shadow-sm">
                    #{mood}
                  </span>
                ))}
              </div>
            )}



            {/* Actions */}
            <div className="flex items-center justify-center md:justify-start gap-3 pt-4 w-full sm:w-auto">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleTogglePlay}
                className="flex-1 sm:flex-none bg-primary text-primary-foreground px-8 py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                {isPlaying ? "Tạm Dừng" : "Phát Toàn Bộ"}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleShare}
                className="shrink-0 w-11 h-11 rounded-full border border-border bg-background dark:bg-card hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center shadow-sm transition-all hover:-translate-y-0.5"
                title={`${shareCount} Shares`}
              >
                <Share2 className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* ── DJ DECK Section ─────────────────────────────────────────── */}
        <div className="mb-12 p-6 md:p-8 rounded-[2rem] border border-border/50 bg-background/40 dark:bg-card/20 shadow-xl backdrop-blur-xl relative overflow-hidden">
          {/* Subtle glow inside DJ deck */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary/5 blur-[100px] pointer-events-none rounded-[2rem]" />

          <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground/70 mb-6 flex items-center justify-center md:justify-start gap-2 relative z-10">
            <Disc3 className="w-4 h-4 text-primary animate-[spin_4s_linear_infinite]" /> DJ Deck
          </h2>
          <div className="flex items-center justify-center gap-6 md:gap-12">
            {/* Deck A (previous/current) */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-mono uppercase font-bold tracking-widest">Deck A</span>
              <VinylRecord
                coverUrl={mashup.shorts[Math.max(0, currentIndex - 1)]?.short?.track?.coverImage || coverUrl}
                isPlaying={isPlaying}
                isCurrent={false}
                size={isMobile ? 50 : 100}
              />
            </div>

            {/* Center controls */}
            <div className="flex flex-col items-center gap-6">
              <Crossfader position={crossfaderPos} />
              {/* Main play button */}
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={handleTogglePlay}
                className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-primary flex items-center justify-center shadow-xl shadow-primary/30 hover:brightness-110 transition-all"
              >
                {isPlaying
                  ? <Pause className="w-6 h-6 md:w-7 md:h-7 text-primary-foreground" />
                  : <Play className="w-6 h-6 md:w-7 md:h-7 text-primary-foreground ml-1" fill="currentColor" />
                }
              </motion.button>

              {/* Transition badge */}
              <AnimatePresence>
                {transitionMeta && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur"
                    style={{
                      backgroundColor: `${transitionMeta.color}15`,
                      borderColor: `${transitionMeta.color}40`,
                      color: transitionMeta.color,
                    }}
                  >
                    <span>{transitionMeta.icon}</span> {transitionMeta.label}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Deck B (current/next) */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-mono uppercase font-bold tracking-widest">Deck B</span>
              <VinylRecord
                coverUrl={currentShort?.track?.coverImage}
                isPlaying={isPlaying}
                isCurrent={true}
                size={isMobile ? 50 : 100}
              />
            </div>
          </div>

          {/* Waveform below decks */}
          <div className="mt-8 w-full max-w-2xl mx-auto px-4">
            <MashupWaveformBar
              analyserNode={analyserNode}
              isPlaying={isPlaying}
              bars={80}
              color="#6366f1"
              accentColor="#a855f7"
              mirrorMode={true}
              height={72}
            />
          </div>
        </div>

        {/* ── Timeline Track List ──────────────────────────────────────── */}
        <div className="mb-12">
          <h2 className="text-xl font-bold font-display mb-6 flex items-center gap-2 text-foreground">
            <BarChart2 className="w-5 h-5 text-primary" /> Mashup Timeline
          </h2>

          <div className="relative space-y-3">
            {/* Vertical timeline line */}
            <div className="absolute left-6 top-6 bottom-6 w-px bg-gradient-to-b from-primary/50 via-border to-transparent" />

            {mashup.shorts.map((item, index) => {
              const isItemActive = index === currentIndex;
              const isPast = index < currentIndex;
              const transInfo = index < mashup.shorts.length - 1 ? TRANSITION_META[item.transitionType] : null;
              return (
                <div
                  key={index}
                  ref={isItemActive ? (activeItemRef as any) : null}
                  className="relative flex items-start gap-4 group cursor-pointer"
                  onClick={() => { skipTo(index); setShouldPlay(true); }}
                >
                  {/* Timeline node */}
                  <motion.div
                    className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center relative z-10 transition-all duration-300 shrink-0 ${isItemActive
                      ? "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.5)] ring-4 ring-background"
                      : isPast
                        ? "bg-muted text-muted-foreground ring-4 ring-background"
                        : "bg-background border border-border text-muted-foreground group-hover:bg-muted/50 ring-4 ring-background"
                      }`}
                  >
                    {isItemActive && isPlaying
                      ? <Disc3 className="w-5 h-5 animate-spin" style={{ animationDuration: "2s" }} />
                      : isPast
                        ? <span className="text-xs">✓</span>
                        : <span className="font-bold text-sm">{index + 1}</span>
                    }
                  </motion.div>

                  {/* Content card */}
                  <motion.div
                    className={`flex-1 flex flex-col sm:flex-row sm:items-center gap-3 p-3 md:p-4 rounded-2xl border transition-all duration-300 mb-2 ${isItemActive
                      ? "bg-primary/5 border-primary/30 shadow-md shadow-primary/5 ring-1 ring-primary/20"
                      : isPast
                        ? "bg-muted/30 dark:bg-card/40 border-border/40 opacity-70"
                        : "bg-background dark:bg-card border-border group-hover:border-primary/30 group-hover:shadow-sm"
                      }`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 ${isItemActive && isPlaying ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}>
                        <ImageWithFallback src={item.short.track?.coverImage} className="w-full h-full object-cover" />
                        {isItemActive && isPlaying && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <PremiumMusicVisualizer active />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-bold text-base line-clamp-1 transition-colors ${isItemActive ? "text-primary" : "text-foreground"}`}>
                          {item.short.track?.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">{item.short.track?.artist?.name}</p>
                        <p className="text-xs font-mono text-muted-foreground/70 mt-1 flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {item.short.startTime !== undefined ? `${item.short.startTime}s → ${item.short.endTime}s` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Transition info badge */}
                    {transInfo && (
                      <div
                        className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border shrink-0"
                        style={{
                          backgroundColor: `${transInfo.color}10`,
                          borderColor: `${transInfo.color}30`,
                          color: transInfo.color,
                        }}
                      >
                        <span>{transInfo.icon}</span>
                        <span>{transInfo.label}</span>
                        <ChevronRight className="w-3 h-3 opacity-50" />
                      </div>
                    )}
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── Sticky Bottom Player Bar ─────────────────────────────────── */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border px-4 md:px-8 h-20 flex items-center justify-between z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.3)]"
        initial={{ y: 150 }}
        animate={{ y: isPlaying || progress > 0 ? 0 : 150 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-border cursor-pointer hover:h-2 group transition-all">
          <motion.div
            className="h-full bg-primary relative"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.1, ease: "linear" }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.div>
        </div>

        {/* Current track info */}
        <div className="flex items-center gap-3 w-1/2 md:w-1/3 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-3 min-w-0 w-full"
            >
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg overflow-hidden shrink-0 shadow-sm border border-border ${isPlaying ? "animate-[spin_4s_linear_infinite]" : ""}`}>
                <ImageWithFallback src={currentShort?.track?.coverImage} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 flex-1 hidden sm:block">
                <h4 className="text-sm font-bold text-foreground truncate">{currentShort?.track?.title}</h4>
                <p className="text-xs text-muted-foreground truncate">{currentShort?.track?.artist?.name}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-end md:justify-center gap-4 md:gap-6 shrink-0 w-auto md:w-1/3">
          {/* Prev track */}
          <button
            onClick={() => skipTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-20 active:scale-95 hidden sm:block"
          >
            <SkipBack className="w-5 h-5 md:w-6 md:h-6 fill-current" />
          </button>

          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={handleTogglePlay}
            className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-foreground flex items-center justify-center shadow-lg hover:scale-105 transition-all text-background"
          >
            {isPlaying
              ? <Pause className="w-4 h-4 md:w-6 md:h-6 fill-current" />
              : <Play className="w-4 h-4 md:w-6 md:h-6 fill-current ml-0.5 md:ml-1" />
            }
          </motion.button>

          {/* Next track */}
          <button
            onClick={() => skipTo(currentIndex + 1)}
            disabled={currentIndex >= mashup.shorts.length - 1}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-20 active:scale-95 hidden sm:block"
          >
            <SkipForward className="w-5 h-5 md:w-6 md:h-6 fill-current" />
          </button>
        </div>

        {/* Right: transition badge + stats */}
        <div className="hidden md:flex w-1/3 justify-end items-center gap-4">
          {/* Mini Waveform */}
          <div className="w-24 h-6 opacity-50 flex items-center">
            <MashupWaveformBar analyserNode={analyserNode} isPlaying={isPlaying} bars={30} height={24} color="#6366f1" />
          </div>

          <AnimatePresence>
            {transitionMeta && (
              <motion.span
                key={activeTransitionType}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md border shadow-sm"
                style={{
                  backgroundColor: `${transitionMeta.color}15`,
                  borderColor: `${transitionMeta.color}40`,
                  color: transitionMeta.color,
                }}
              >
                {transitionMeta.icon} {transitionMeta.label}
              </motion.span>
            )}
          </AnimatePresence>
          <span className="text-muted-foreground text-xs font-mono font-medium px-2 py-1 bg-muted rounded-md border border-border/50">
            {currentIndex + 1} / {mashup.shorts.length}
          </span>
        </div>
      </motion.div>
    </div>
  );
};
