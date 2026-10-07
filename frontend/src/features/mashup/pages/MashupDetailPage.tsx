import { useParams, useNavigate } from "react-router-dom";
import { QueryErrorResult } from "@/components/ui/QueryState";
import { useMashupDetail } from "../hooks/useMashups";
import {
  Play, Pause, Share2, Heart, ArrowLeft, Disc3,
  Layers, Clock, BarChart2, ChevronRight, SkipBack, SkipForward
} from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { useMashupPlayer } from "../hooks/useMashupPlayer";
import { PremiumMusicVisualizer } from "@/components/MusicVisualizer";
import { useState, useCallback, useEffect, useRef } from "react";
import { mashupApi } from "../api/mashupApi";
import { toast } from "sonner";
import { buildShareUrl, shareOrCopy } from "@/utils/share";
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
    className="relative rounded-full flex-shrink-0 overflow-hidden shadow-2xl transition-transform duration-500"
    style={{
      width: size,
      height: size,
      animation: isPlaying && isCurrent ? "spin 4s linear infinite" : "none",
      transform: isCurrent && isPlaying ? "scale(1.05)" : "scale(1)",
    }}
  >
    {/* Vinyl grooves */}
    <div
      className="absolute inset-0 rounded-full bg-neutral-900 border border-white/10 dark:border-black/20"
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
      className="absolute rounded-full bg-black/90 shadow-inner border border-white/5"
      style={{
        width: size * 0.08,
        height: size * 0.08,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }}
    />
    {/* Shine */}
    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
  </div>
);

const Crossfader = ({ position }: { position: number }) => (
  <div className="flex flex-col items-center gap-2">
    <span className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-semibold">Crossfader</span>
    <div className="relative w-48 md:w-56 h-2.5 bg-black/10 dark:bg-white/5 rounded-full overflow-visible border border-white/20 dark:border-white/5 shadow-inner">
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-white dark:bg-neutral-800 border border-border shadow-[0_4px_12px_rgba(0,0,0,0.1)] cursor-grab z-10 flex items-center justify-center"
        animate={{ left: `${position}%` }}
        style={{ marginLeft: "-16px" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="w-1 h-3 bg-muted rounded-full" />
      </motion.div>
      <div className="absolute left-0 top-0 bottom-0 bg-primary/80 rounded-full" style={{ width: `${position}%` }} />
    </div>
    <div className="flex justify-between w-full text-[10px] text-muted-foreground font-mono px-1">
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

  const { data, isLoading, isError, error, refetch } = useMashupDetail(id || "");
  const mashup = data?.data;
  const [shouldPlay, setShouldPlay] = useState(false);
  const [crossfaderPos, setCrossfaderPos] = useState(50);
  const activeItemRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();
  const onTransitionStart = useCallback((fromIdx: number, toIdx: number) => {
    setCrossfaderPos(toIdx % 2 === 0 ? 30 : 70);
    setTimeout(() => setCrossfaderPos(50), 2000);
  }, []);

  const {
    isPlaying, progress, currentIndex,
    transitionState, activeTransitionType, analyserNode,
    togglePlay, skipTo,
  } = useMashupPlayer(mashup || null, shouldPlay, onTransitionStart);

  const [shareCount, setShareCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  useEffect(() => {
    if (mashup) {
      setShareCount(mashup.shareCount || 0);
      setLikeCount(mashup.likeCount || 0);
    }
  }, [mashup]);

  useEffect(() => { setShouldPlay(isPlaying); }, [isPlaying]);

  // Auto-scroll active timeline item into view
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
  }, [currentIndex]);

  const handleTogglePlay = useCallback(() => setShouldPlay(prev => !prev), []);

  const handleLike = useCallback(async () => {
    if (!mashup) return;
    try {
      const result = await mashupApi.likeMashup(mashup._id);
      setLiked(Boolean(result.data?.liked));
      setLikeCount(result.data?.likeCount ?? likeCount);
    } catch {
      toast.error("Đăng nhập để thả tim");
    }
  }, [likeCount, mashup]);

  const handleShare = useCallback(async () => {
    if (!mashup) return;
    setShareCount(prev => prev + 1);
    try {
      await mashupApi.shareMashup(mashup._id);
      await shareOrCopy({
        title: mashup.title,
        url: buildShareUrl(`/mashups/${mashup._id}`),
      });
    } catch { }
  }, [mashup]);

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-background flex flex-col items-center justify-center gap-4">
        <PremiumMusicVisualizer active={true} />
        <p className="text-muted-foreground mt-4 font-display text-lg tracking-wide animate-pulse">Đang tải Mashup...</p>
      </div>
    );
  }

  if (isError || !mashup) {
    return (
      <div className="w-full h-screen bg-background flex flex-col items-center justify-center gap-4 px-6">
        <QueryErrorResult
          error={error}
          missing={!mashup}
          onRetry={() => void refetch()}
          onBack={() => navigate("/mashups/feed")}
          notFound={{
            title: "Không tìm thấy Mashup.",
            description: "Mashup này không tồn tại hoặc đã bị xóa.",
          }}
        />
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
      <div className="fixed inset-0 opacity-[0.15] dark:opacity-20 pointer-events-none overflow-hidden z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="w-full h-full"
          >
            <ImageWithFallback
              src={currentShort?.track?.coverImage || coverUrl}
              className="w-full h-full object-cover blur-[100px] saturate-200"
            />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/80 to-background" />
      </div>

      <div className="relative z-10 section-container pt-6 md:pt-10 pb-32">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-all text-sm font-medium w-fit hover:bg-muted/50 py-2 px-4 -ml-4 rounded-full backdrop-blur-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại
        </button>

        {/* ── Hero Section ─────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row gap-8 lg:gap-14 items-center md:items-end mb-16">
          {/* Cover art */}
          <div className="relative group shrink-0">
            <motion.div 
              className="w-56 h-56 md:w-64 md:h-64 lg:w-80 lg:h-80 rounded-full overflow-hidden shadow-2xl shadow-primary/20 group-hover:shadow-primary/40 transition-shadow relative border-[6px] border-white/10 dark:border-white/5 backdrop-blur-xl"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none z-10" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/20" />
                <motion.circle
                  cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className="text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.8)]"
                  strokeDasharray="301.59"
                  strokeDashoffset={301.59 - (301.59 * progress) / 100}
                  transition={{ ease: "linear", duration: 0.1 }}
                />
              </svg>
              <div className="absolute inset-2 rounded-full overflow-hidden">
                <ImageWithFallback
                  src={coverUrl}
                  className={`w-full h-full object-cover transition-transform duration-1000 ${isPlaying ? "scale-110" : "group-hover:scale-110"}`}
                />
              </div>
              <div className="absolute inset-2 rounded-full bg-black/10 group-hover:bg-black/30 transition-colors pointer-events-none" />
              <button
                onClick={handleTogglePlay}
                className="absolute inset-0 flex items-center justify-center"
              >
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className={`w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary/95 flex items-center justify-center backdrop-blur-xl shadow-2xl transition-all duration-300 ${isPlaying ? "scale-100 opacity-100" : "scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100"
                    }`}
                >
                  {isPlaying
                    ? <Pause className="w-8 h-8 text-primary-foreground" />
                    : <Play className="w-8 h-8 text-primary-foreground ml-1" fill="currentColor" />
                  }
                </motion.div>
              </button>
            </motion.div>
          </div>

          {/* Info */}
          <div className="flex-1 space-y-5 text-center md:text-left flex flex-col items-center md:items-start w-full">
            {/* Badges */}
            <div className="flex items-center justify-center md:justify-start gap-2.5 flex-wrap">
              <span className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                <Layers className="w-3.5 h-3.5" /> Mashup
              </span>
              <span className="text-sm text-muted-foreground font-medium px-3 py-1.5 bg-muted/50 rounded-full border border-border/50 backdrop-blur-sm">
                {mashup.shorts.length} tracks • {totalDurationStr}
              </span>
              {!mashup.isPublished && (
                <span className="px-3 py-1.5 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-full text-xs font-bold uppercase backdrop-blur-sm">
                  Bản nháp
                </span>
              )}
              {mashup.compatibilityScore > 0 && (
                <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-xs font-bold backdrop-blur-sm">
                  {mashup.compatibilityScore}% Match
                </span>
              )}
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black font-display tracking-tighter leading-tight text-foreground drop-shadow-sm">
              {mashup.title}
            </h1>

            {mashup.description && (
              <div
                className="cursor-pointer group"
                onClick={() => {
                  if (mashup.description && mashup.description.length > 100) setIsDescExpanded(!isDescExpanded);
                }}
              >
                <p className={`text-muted-foreground/80 text-sm md:text-base leading-relaxed max-w-2xl whitespace-pre-wrap transition-all duration-300 ${isDescExpanded ? 'max-h-[30vh] overflow-y-auto pr-2' : 'line-clamp-2'}`}>
                  {mashup.description}
                </p>
                {mashup.description.length > 100 && (
                  <span className="text-foreground/70 font-bold text-xs mt-1.5 group-hover:text-primary transition-colors inline-block">
                    {isDescExpanded ? 'Thu gọn' : 'Xem thêm'}
                  </span>
                )}
              </div>
            )}

            {/* Mood tags */}
            {mashup.dominantMoods?.length > 0 && (
              <div className="flex justify-center md:justify-start flex-wrap gap-2">
                {mashup.dominantMoods.map(mood => (
                  <span key={mood} className="px-3.5 py-1.5 bg-background/50 backdrop-blur-md border border-white/10 dark:border-white/5 rounded-full text-sm font-medium hover:bg-muted transition-colors cursor-pointer text-foreground shadow-sm">
                    #{mood}
                  </span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-center md:justify-start gap-4 pt-4 w-full sm:w-auto">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleTogglePlay}
                className="flex-1 sm:flex-none bg-primary text-primary-foreground px-8 py-3.5 rounded-full font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-1 transition-all relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                {isPlaying ? "Tạm Dừng" : "Phát Toàn Bộ"}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => void handleLike()}
                className="shrink-0 w-12 h-12 rounded-full border border-white/10 dark:border-white/5 bg-background/50 backdrop-blur-md hover:bg-muted flex items-center justify-center shadow-sm transition-all hover:-translate-y-1"
                title={`${likeCount} tim`}
              >
                <Heart className={`w-5 h-5 transition-colors ${liked ? "fill-rose-500 text-rose-500" : "text-foreground"}`} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleShare}
                className="shrink-0 w-12 h-12 rounded-full border border-white/10 dark:border-white/5 bg-background/50 backdrop-blur-md hover:bg-muted text-foreground flex items-center justify-center shadow-sm transition-all hover:-translate-y-1"
                title={`${shareCount} Shares`}
              >
                <Share2 className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* ── DJ DECK Section ─────────────────────────────────────────── */}
        <div className="mb-16 p-8 md:p-12 rounded-[2.5rem] border border-white/20 dark:border-white/5 bg-white/40 dark:bg-card/20 shadow-2xl backdrop-blur-3xl relative overflow-hidden group">
          {/* Subtle glow inside DJ deck */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-primary/10 blur-[120px] pointer-events-none rounded-full transition-opacity duration-1000 opacity-50 group-hover:opacity-100" />

          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/80 mb-8 flex items-center justify-center md:justify-start gap-2.5 relative z-10">
            <Disc3 className="w-5 h-5 text-primary animate-[spin_4s_linear_infinite]" /> Live DJ Deck
          </h2>
          <div className="flex flex-col md:flex-row items-center justify-center gap-10 md:gap-16 relative z-10">
            {/* Deck A (previous/current) */}
            <div className="flex flex-col items-center gap-4">
              <span className="text-[11px] text-muted-foreground font-mono uppercase font-bold tracking-widest bg-background/50 px-3 py-1 rounded-full backdrop-blur-sm border border-border/50">Deck A</span>
              <VinylRecord
                coverUrl={mashup.shorts[Math.max(0, currentIndex - 1)]?.short?.track?.coverImage || coverUrl}
                isPlaying={isPlaying}
                isCurrent={false}
                size={isMobile ? 80 : 130}
              />
            </div>

            {/* Center controls */}
            <div className="flex flex-col items-center gap-8 w-full md:w-auto">
              <Crossfader position={crossfaderPos} />
              
              <div className="flex items-center gap-6">
                {/* Main play button */}
                <motion.button
                  whileTap={{ scale: 0.93 }}
                  onClick={handleTogglePlay}
                  className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary flex items-center justify-center shadow-2xl shadow-primary/30 hover:scale-105 hover:brightness-110 transition-all border-[4px] border-background/20"
                >
                  {isPlaying
                    ? <Pause className="w-7 h-7 md:w-8 md:h-8 text-primary-foreground" />
                    : <Play className="w-7 h-7 md:w-8 md:h-8 text-primary-foreground ml-1" fill="currentColor" />
                  }
                </motion.button>
              </div>

              {/* Transition badge */}
              <div className="h-8">
                <AnimatePresence mode="wait">
                  {transitionMeta && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold border backdrop-blur-md shadow-lg"
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
            </div>

            {/* Deck B (current/next) */}
            <div className="flex flex-col items-center gap-4">
              <span className="text-[11px] text-muted-foreground font-mono uppercase font-bold tracking-widest bg-background/50 px-3 py-1 rounded-full backdrop-blur-sm border border-border/50">Deck B</span>
              <VinylRecord
                coverUrl={currentShort?.track?.coverImage}
                isPlaying={isPlaying}
                isCurrent={true}
                size={isMobile ? 80 : 130}
              />
            </div>
          </div>

          {/* Waveform below decks */}
          <div className="mt-12 w-full max-w-3xl mx-auto px-4 relative z-10">
            <MashupWaveformBar
              analyserNode={analyserNode}
              isPlaying={isPlaying}
              bars={100}
              color="#6366f1"
              accentColor="#a855f7"
              mirrorMode={true}
              height={80}
            />
          </div>
        </div>

        {/* ── Timeline Track List ──────────────────────────────────────── */}
        <div className="mb-12 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold font-display mb-8 flex items-center justify-center md:justify-start gap-3 text-foreground">
            <BarChart2 className="w-6 h-6 text-primary" /> Timeline Bản Phối
          </h2>

          <div className="relative space-y-4">
            {/* Vertical timeline line */}
            <div className="absolute left-[1.35rem] md:left-[1.85rem] top-8 bottom-8 w-1 bg-gradient-to-b from-primary/60 via-border to-transparent rounded-full" />

            {mashup.shorts.map((item, index) => {
              const isItemActive = index === currentIndex;
              const isPast = index < currentIndex;
              const transInfo = index < mashup.shorts.length - 1 ? TRANSITION_META[item.transitionType] : null;
              return (
                <div
                  key={index}
                  ref={isItemActive ? (activeItemRef as any) : null}
                  className="relative flex items-start gap-5 group cursor-pointer"
                  onClick={() => { skipTo(index); setShouldPlay(true); }}
                >
                  {/* Timeline node */}
                  <motion.div
                    className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center relative z-10 transition-all duration-500 shrink-0 border-[4px] ${isItemActive
                      ? "bg-primary border-background text-primary-foreground shadow-[0_0_30px_rgba(var(--primary),0.6)] scale-110"
                      : isPast
                        ? "bg-muted border-background text-muted-foreground"
                        : "bg-background border-border text-muted-foreground group-hover:bg-muted group-hover:border-primary/50"
                      }`}
                  >
                    {isItemActive && isPlaying
                      ? <Disc3 className="w-6 h-6 animate-spin" style={{ animationDuration: "3s" }} />
                      : isPast
                        ? <span className="text-sm font-bold">✓</span>
                        : <span className="font-bold text-lg">{index + 1}</span>
                    }
                  </motion.div>

                  {/* Content card */}
                  <motion.div
                    className={`flex-1 flex flex-col sm:flex-row sm:items-center gap-4 p-4 md:p-5 rounded-[1.5rem] backdrop-blur-xl border transition-all duration-500 mb-2 ${isItemActive
                      ? "bg-white/80 dark:bg-white/10 border-primary/40 shadow-xl shadow-primary/10"
                      : isPast
                        ? "bg-white/30 dark:bg-card/20 border-border/40 opacity-75"
                        : "bg-white/50 dark:bg-card/40 border-white/20 dark:border-white/5 group-hover:border-primary/30 group-hover:shadow-lg"
                      }`}
                  >
                    <div className="flex items-center gap-5 flex-1">
                      <div className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] overflow-hidden shrink-0 shadow-md ${isItemActive && isPlaying ? "ring-4 ring-primary ring-offset-2 ring-offset-background" : ""}`}>
                        <ImageWithFallback src={item.short.track?.coverImage} className="w-full h-full object-cover" />
                        {isItemActive && isPlaying && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center backdrop-blur-[2px]">
                            <PremiumMusicVisualizer active />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-bold text-lg line-clamp-1 transition-colors ${isItemActive ? "text-primary drop-shadow-sm" : "text-foreground"}`}>
                          {item.short.track?.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{item.short.track?.artist?.name}</p>
                        <p className="text-xs font-mono font-medium text-foreground/50 mt-2 flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5" />
                          {item.short.startTime !== undefined ? `${item.short.startTime}s → ${item.short.endTime}s` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Transition info badge */}
                    {transInfo && (
                      <div
                        className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border shrink-0 bg-background/50 shadow-sm"
                        style={{
                          borderColor: `${transInfo.color}30`,
                          color: transInfo.color,
                        }}
                      >
                        <span>{transInfo.icon}</span>
                        <span>{transInfo.label}</span>
                        <ChevronRight className="w-4 h-4 opacity-50 ml-1" />
                      </div>
                    )}
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── Floating Bottom Player ─────────────────────────────────── */}
      <motion.div
        className="fixed bottom-4 md:bottom-6 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[calc(100%-2rem)] md:max-w-4xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-3xl border border-white/20 dark:border-white/10 rounded-[2rem] h-[5.5rem] flex items-center justify-between z-50 shadow-2xl px-4 md:px-6 overflow-hidden"
        initial={{ y: 150, opacity: 0 }}
        animate={{ y: isPlaying || progress > 0 ? 0 : 150, opacity: isPlaying || progress > 0 ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        {/* Progress bar background indicator */}
        <div 
          className="absolute bottom-0 left-0 h-1.5 bg-primary/20 w-full"
        />
        <motion.div
          className="absolute bottom-0 left-0 h-1.5 bg-primary rounded-r-full shadow-[0_0_10px_rgba(var(--primary),0.8)]"
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.1, ease: "linear" }}
        />

        {/* Current track info */}
        <div className="flex items-center gap-4 w-[40%] md:w-1/3 min-w-0 z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-3 md:gap-4 min-w-0 w-full"
            >
              <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl overflow-hidden shrink-0 shadow-lg border border-white/10 ${isPlaying ? "animate-[spin_4s_linear_infinite]" : ""}`}>
                <ImageWithFallback src={currentShort?.track?.coverImage} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 flex-1 hidden sm:block">
                <h4 className="text-sm md:text-base font-bold text-foreground truncate">{currentShort?.track?.title}</h4>
                <p className="text-xs text-muted-foreground truncate">{currentShort?.track?.artist?.name}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-end md:justify-center gap-4 md:gap-8 shrink-0 w-auto md:w-1/3 z-10">
          {/* Prev track */}
          <button
            onClick={() => skipTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-20 active:scale-95 hidden sm:block p-2"
          >
            <SkipBack className="w-5 h-5 md:w-6 md:h-6 fill-current" />
          </button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleTogglePlay}
            className="w-12 h-12 md:w-[3.5rem] md:h-[3.5rem] rounded-full bg-foreground flex items-center justify-center shadow-xl hover:scale-105 transition-all text-background border-[3px] border-background/20"
          >
            {isPlaying
              ? <Pause className="w-5 h-5 md:w-6 md:h-6 fill-current" />
              : <Play className="w-5 h-5 md:w-6 md:h-6 fill-current ml-1" />
            }
          </motion.button>

          {/* Next track */}
          <button
            onClick={() => skipTo(currentIndex + 1)}
            disabled={currentIndex >= mashup.shorts.length - 1}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-20 active:scale-95 hidden sm:block p-2"
          >
            <SkipForward className="w-5 h-5 md:w-6 md:h-6 fill-current" />
          </button>
        </div>

        {/* Right: transition badge + stats */}
        <div className="hidden md:flex w-1/3 justify-end items-center gap-5 z-10">
          {/* Mini Waveform */}
          <div className="w-24 h-8 opacity-60 flex items-center mix-blend-luminosity">
            <MashupWaveformBar analyserNode={analyserNode} isPlaying={isPlaying} bars={30} height={32} color="#6366f1" />
          </div>

          <AnimatePresence mode="wait">
            {transitionMeta && (
              <motion.span
                key={activeTransitionType}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border shadow-sm bg-background/50 backdrop-blur-md"
                style={{
                  borderColor: `${transitionMeta.color}30`,
                  color: transitionMeta.color,
                }}
              >
                {transitionMeta.icon}
              </motion.span>
            )}
          </AnimatePresence>
          <span className="text-foreground/80 text-sm font-mono font-bold px-3 py-1.5 bg-background/50 rounded-full border border-border/50 backdrop-blur-sm shadow-inner">
            {currentIndex + 1} <span className="text-muted-foreground font-normal mx-0.5">/</span> {mashup.shorts.length}
          </span>
        </div>
      </motion.div>
    </div>
  );
};
