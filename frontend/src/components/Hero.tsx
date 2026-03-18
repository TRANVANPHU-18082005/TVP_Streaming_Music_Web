"use client";

/**
 * @file Hero.tsx — Featured Album Slider
 *
 * FIX: Moved early return (HeroSkeleton) AFTER all hooks to prevent
 *      "Rendered more hooks than during previous render" error.
 *
 * UPGRADES:
 * - Waveform visualizer on active track
 * - Glassmorphism track info strip
 * - Keyboard navigation (←/→ arrows)
 * - Smooth progress indicator bar
 * - Improved responsive layout
 * - Better light/dark mode consistency
 */

import {
  useState,
  useMemo,
  useCallback,
  memo,
  useRef,
  useEffect,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Play,
  Pause,
  Heart,
  Share2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Disc3,
  Radio,
  Music2,
} from "lucide-react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { useHeroSlider } from "@/hooks/useHeroSlider";
import { Album } from "@/features/album/types";
import albumApi from "@/features/album/api/albumApi";
import { albumKeys } from "@/features/album/utils/albumKeys";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setIsPlaying, setQueue } from "@/features/player/slice/playerSlice";
import { useFeatureAlbums } from "@/features/album/hooks/useAlbumsQuery";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface HeroAlbum {
  _id: string;
  slug: string;
  title: string;
  artistName: string;
  artistSlug?: string;
  description: string;
  coverImage: string;
  moodColor: string;
}

type Direction = -1 | 1;

// ─────────────────────────────────────────────────────────────────────────────
// SPRING / EASING PRESETS
// ─────────────────────────────────────────────────────────────────────────────
const SPRING_FAST = { type: "spring", stiffness: 520, damping: 34 } as const;
const SPRING_MEDIUM = { type: "spring", stiffness: 300, damping: 30 } as const;
const SPRING_ARTWORK = {
  type: "spring",
  stiffness: 200,
  damping: 26,
  mass: 0.85,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// DIRECTION-AWARE VARIANTS
// ─────────────────────────────────────────────────────────────────────────────
const artworkVariants = {
  enter: (dir: Direction) => ({ x: dir * 90, opacity: 0, scale: 0.94 }),
  center: { x: 0, opacity: 1, scale: 1, transition: SPRING_ARTWORK },
  exit: (dir: Direction) => ({
    x: dir * -90,
    opacity: 0,
    scale: 0.94,
    transition: { duration: 0.22, ease: [0.4, 0, 1, 1] as const },
  }),
};

const textLineVariants = {
  enter: (dir: Direction) => ({ opacity: 0, x: dir * 24, y: 6 }),
  center: (i: number) => ({
    opacity: 1,
    x: 0,
    y: 0,
    transition: { ...SPRING_MEDIUM, delay: i * 0.055 },
  }),
  exit: {
    opacity: 0,
    y: -5,
    transition: { duration: 0.13, ease: "easeIn" as const },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MUSIC BARS — GPU-only scaleY
// ─────────────────────────────────────────────────────────────────────────────
const MusicBars = memo(({ size = "lg" }: { size?: "sm" | "lg" }) => {
  const h = size === "lg" ? 28 : 18;
  const barCount = size === "lg" ? 5 : 4;
  return (
    <div
      className={cn(
        "flex items-end justify-center gap-[3px]",
        size === "lg" ? "h-9" : "h-5",
      )}
    >
      {Array.from({ length: barCount }, (_, i) => (
        <motion.span
          key={i}
          className={cn(
            "rounded-full bg-white origin-bottom",
            size === "lg" ? "w-[3.5px]" : "w-[2.5px]",
          )}
          animate={{ scaleY: [0.2, 1, 0.35, 0.9, 0.25, 1] }}
          transition={{
            duration: 1.05 + i * 0.13,
            repeat: Infinity,
            repeatType: "mirror",
            ease: "easeInOut",
            delay: i * 0.11,
          }}
          style={{ height: h }}
        />
      ))}
    </div>
  );
});
MusicBars.displayName = "MusicBars";

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE DOTS
// ─────────────────────────────────────────────────────────────────────────────
const SlideDots = memo(
  ({
    count,
    current,
    onChange,
  }: {
    count: number;
    current: number;
    onChange: (i: number) => void;
  }) => (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          aria-label={`Slide ${i + 1}`}
          className="p-2 -m-2 group"
        >
          <motion.div
            className="h-[3px] rounded-full dark:bg-white bg-gray-800"
            animate={{
              width: i === current ? 28 : 8,
              opacity: i === current ? 1 : 0.22,
            }}
            transition={SPRING_FAST}
            whileHover={{ opacity: i === current ? 1 : 0.5 }}
          />
        </button>
      ))}
    </div>
  ),
);
SlideDots.displayName = "SlideDots";

// ─────────────────────────────────────────────────────────────────────────────
// GENRE BADGE — decorative tag
// ─────────────────────────────────────────────────────────────────────────────
const GenreBadge = memo(
  ({ moodColor, label = "Album" }: { moodColor: string; label?: string }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border"
      style={{
        background: `hsl(${moodColor} / 0.12)`,
        borderColor: `hsl(${moodColor} / 0.3)`,
        color: `hsl(${moodColor})`,
      }}
    >
      <Music2 className="size-2.5" />
      <span className="text-[10px] font-bold uppercase tracking-widest">
        {label}
      </span>
    </motion.div>
  ),
);
GenreBadge.displayName = "GenreBadge";

// ─────────────────────────────────────────────────────────────────────────────
// ARTWORK CARD
// ─────────────────────────────────────────────────────────────────────────────
const ArtworkCard = memo(
  ({
    album,
    direction,
    isPlaying,
    isLoading,
    onNavigate,
    onPlay,
  }: {
    album: HeroAlbum;
    direction: Direction;
    isPlaying: boolean;
    isLoading: boolean;
    onNavigate: () => void;
    onPlay: (e: React.MouseEvent) => void;
  }) => (
    <AnimatePresence mode="popLayout" custom={direction} initial={false}>
      <motion.div
        key={album._id}
        custom={direction}
        variants={artworkVariants}
        initial="enter"
        animate="center"
        exit="exit"
        className="relative group select-none"
      >
        {/* Mood glow */}
        <motion.div
          className="absolute inset-[4%] rounded-full blur-[60px] pointer-events-none -z-10"
          style={{ background: `hsl(${album.moodColor} / 0.55)` }}
          animate={{ opacity: [0.45, 0.75, 0.45], scale: [1, 1.05, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Cover shell */}
        <motion.div
          className={cn(
            "relative overflow-hidden cursor-pointer",
            "rounded-[1.75rem]",
            "border border-white/10 dark:border-white/10 border-black/8",
            "shadow-[0_8px_32px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.08)]",
            "dark:shadow-[0_32px_80px_rgba(0,0,0,0.9),0_6px_20px_rgba(0,0,0,0.55)]",
            "w-[220px] sm:w-[280px] md:w-[330px] lg:w-[370px] xl:w-[410px] aspect-square",
          )}
          whileHover={{ scale: 1.02 }}
          transition={SPRING_MEDIUM}
          onClick={onNavigate}
        >
          <ImageWithFallback
            src={album.coverImage}
            alt={album.title}
            className="w-full h-full object-cover"
          />

          {/* Vignettes */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent pointer-events-none" />

          {/* Hover / playing overlay */}
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/52 backdrop-blur-[3px]"
            animate={{ opacity: isLoading || isPlaying ? 1 : 0 }}
            whileHover={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => {
              e.stopPropagation();
              onPlay(e);
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ duration: 0.14 }}
                >
                  <Loader2 className="size-14 text-white animate-spin drop-shadow-lg" />
                </motion.div>
              ) : isPlaying ? (
                <motion.div
                  key="playing"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={SPRING_FAST}
                  className="flex flex-col items-center gap-2"
                >
                  <MusicBars size="lg" />
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/65 mt-1">
                    Đang phát
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  key="play"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={SPRING_FAST}
                >
                  {/* Pulse ring */}
                  <div className="relative flex items-center justify-center">
                    <motion.div
                      className="absolute inset-0 rounded-full bg-white/20"
                      animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                    />
                    <div className="size-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                      <Play className="size-7 text-white fill-white ml-1" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Now playing badge */}
          <AnimatePresence>
            {isPlaying && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={SPRING_FAST}
                className={cn(
                  "absolute bottom-4 left-1/2 -translate-x-1/2 z-20",
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-full whitespace-nowrap",
                  "bg-black/70 backdrop-blur-xl border border-white/15",
                  "shadow-[0_4px_14px_rgba(0,0,0,0.55)]",
                )}
              >
                <Radio className="size-3 text-primary shrink-0 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/75">
                  Đang phát
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  ),
);
ArtworkCard.displayName = "ArtworkCard";

// ─────────────────────────────────────────────────────────────────────────────
// TEXT STATIC
// ─────────────────────────────────────────────────────────────────────────────
const TextStatic = memo(
  ({
    album,
    direction,
    onNavigate,
    onNavigateArtist,
  }: {
    album: HeroAlbum;
    direction: Direction;
    onNavigate: () => void;
    onNavigateArtist: () => void;
  }) => (
    <AnimatePresence mode="wait" custom={direction} initial={false}>
      <motion.div
        key={album._id}
        className="flex flex-col items-center lg:items-start gap-3 sm:gap-4 w-full"
        initial="enter"
        animate="center"
        exit="exit"
      >
        {/* Labels row */}
        <motion.div
          custom={direction}
          variants={textLineVariants}
          initial="enter"
          animate={() => textLineVariants.center(0) as any}
          className="flex items-center gap-2.5 flex-wrap justify-center lg:justify-start"
        >
          <div className="flex items-center gap-1.5">
            <Disc3 className="size-3 text-primary shrink-0" />
            <span className="uppercase tracking-[0.28em] text-[9px] sm:text-[10px] font-black text-primary">
              Tuyển tập nổi bật
            </span>
          </div>
          <GenreBadge moodColor={album.moodColor} label="Album" />
        </motion.div>

        {/* Title */}
        <motion.h1
          custom={direction}
          variants={textLineVariants}
          animate={textLineVariants.center(1) as any}
          onClick={onNavigate}
          className={cn(
            "font-black leading-[1.02] tracking-[-0.03em]",
            "dark:text-white text-gray-900",
            "cursor-pointer hover:text-primary transition-colors duration-300",
            "line-clamp-2 text-center lg:text-left w-full",
            "text-[2rem] sm:text-[2.5rem] md:text-[2.8rem] lg:text-[3.2rem] xl:text-[3.6rem]",
          )}
        >
          {album.title}
        </motion.h1>

        {/* Artist */}
        <motion.p
          custom={direction}
          variants={textLineVariants}
          animate={textLineVariants.center(2) as any}
          className="text-sm sm:text-base dark:text-white/55 text-gray-600 font-medium text-center lg:text-left"
        >
          Trình bày bởi{" "}
          <button
            onClick={onNavigateArtist}
            className="dark:text-white text-gray-900 font-bold hover:text-primary hover:underline underline-offset-2 transition-colors"
          >
            {album.artistName}
          </button>
        </motion.p>

        {/* Description */}
        <motion.p
          custom={direction}
          variants={textLineVariants}
          animate={textLineVariants.center(3) as any}
          className="text-[13px] sm:text-[14px] dark:text-white/40 text-gray-500 leading-relaxed line-clamp-2 sm:line-clamp-3 text-center lg:text-left max-w-[38ch] sm:max-w-[46ch]"
        >
          {album.description}
        </motion.p>
      </motion.div>
    </AnimatePresence>
  ),
);
TextStatic.displayName = "TextStatic";

// ─────────────────────────────────────────────────────────────────────────────
// TEXT ACTIONS — stable, never re-mounts
// ─────────────────────────────────────────────────────────────────────────────
const TextActions = memo(
  ({
    isPlaying,
    isLoading,
    isLiked,
    onPlay,
    onLike,
    onShare,
  }: {
    isPlaying: boolean;
    isLoading: boolean;
    isLiked: boolean;
    onPlay: (e: React.MouseEvent) => void;
    onLike: (e: React.MouseEvent) => void;
    onShare: (e: React.MouseEvent) => void;
  }) => (
    <div className="flex items-center flex-wrap gap-2.5 pt-1 justify-center lg:justify-start">
      {/* Play button */}
      <motion.button
        onClick={onPlay}
        disabled={isLoading}
        whileHover={!isLoading ? { scale: 1.04 } : {}}
        whileTap={!isLoading ? { scale: 0.95 } : {}}
        transition={SPRING_FAST}
        className={cn(
          "relative flex items-center gap-2.5 px-6 h-12 rounded-full overflow-hidden",
          "font-bold text-[11px] uppercase tracking-[0.14em]",
          "bg-gray-900 text-white dark:bg-white dark:text-black",
          "shadow-[0_4px_20px_rgba(0,0,0,0.18)] dark:shadow-[0_6px_24px_rgba(255,255,255,0.12)]",
          "hover:shadow-[0_8px_28px_rgba(0,0,0,0.28)] dark:hover:shadow-[0_10px_32px_rgba(255,255,255,0.2)]",
          "disabled:opacity-55 disabled:pointer-events-none transition-shadow",
        )}
      >
        {/* Shimmer on hover */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full"
          whileHover={{ translateX: "200%" }}
          transition={{ duration: 0.55, ease: "easeInOut" }}
        />

        <AnimatePresence mode="wait" initial={false}>
          {isLoading ? (
            <motion.span
              key="l"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Loader2 className="size-4 animate-spin" />
            </motion.span>
          ) : isPlaying ? (
            <motion.span
              key="pa"
              initial={{ scale: 0.5, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0, rotate: 8 }}
              transition={SPRING_FAST}
            >
              <Pause className="size-4 fill-current" />
            </motion.span>
          ) : (
            <motion.span
              key="pl"
              initial={{ scale: 0.5, opacity: 0, rotate: 8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0, rotate: -8 }}
              transition={SPRING_FAST}
            >
              <Play className="size-4 fill-current ml-0.5" />
            </motion.span>
          )}
        </AnimatePresence>
        <motion.span
          key={isLoading ? "loading" : isPlaying ? "pause" : "play"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.12 }}
        >
          {isLoading ? "Đang tải..." : isPlaying ? "Tạm dừng" : "Phát ngay"}
        </motion.span>
      </motion.button>

      {/* Like */}
      <motion.button
        onClick={onLike}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.82 }}
        transition={SPRING_FAST}
        aria-label={isLiked ? "Bỏ thích" : "Thêm vào yêu thích"}
        className={cn(
          "flex items-center justify-center size-12 rounded-full border transition-all duration-200",
          isLiked
            ? "bg-rose-500/15 border-rose-400/35 text-rose-400 dark:bg-rose-500/18 dark:border-rose-500/35"
            : "bg-black/6 border-black/12 text-gray-600 hover:bg-black/10 hover:text-gray-900 dark:bg-white/7 dark:border-white/12 dark:text-white/55 dark:hover:bg-white/12 dark:hover:text-white",
        )}
      >
        <motion.div
          animate={isLiked ? { scale: [1, 1.45, 1] } : { scale: 1 }}
          transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] as any }}
        >
          <Heart
            className={cn("size-5", isLiked && "fill-current text-rose-400")}
          />
        </motion.div>
      </motion.button>

      {/* Share */}
      <motion.button
        onClick={onShare}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.82 }}
        transition={SPRING_FAST}
        aria-label="Chia sẻ"
        className="flex items-center justify-center size-12 rounded-full border transition-all duration-200 bg-black/6 border-black/12 text-gray-600 hover:bg-black/10 hover:text-gray-900 dark:bg-white/7 dark:border-white/12 dark:text-white/55 dark:hover:bg-white/12 dark:hover:text-white"
      >
        <Share2 className="size-5" />
      </motion.button>
    </div>
  ),
);
TextActions.displayName = "TextActions";

// ─────────────────────────────────────────────────────────────────────────────
// HERO SKELETON
// ─────────────────────────────────────────────────────────────────────────────
function HeroSkeleton() {
  return (
    <div
      className={cn(
        "min-h-[88dvh] flex items-center justify-center relative overflow-hidden",
        "dark:bg-[#080808] bg-white",
      )}
    >
      <div className="container mx-auto px-6 w-full">
        <div className="max-w-7xl mx-auto flex flex-col lg:grid lg:grid-cols-12 lg:gap-16 items-center">
          <div className="lg:col-span-5 flex justify-center mb-12 lg:mb-0">
            <Skeleton className="w-[220px] sm:w-[280px] lg:w-[370px] xl:w-[410px] aspect-square rounded-[1.75rem] dark:bg-white/[0.07] bg-black/[0.06]" />
          </div>
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start gap-4 w-full">
            <div className="flex gap-2">
              <Skeleton className="h-3 w-28 rounded-full dark:bg-white/[0.07] bg-black/[0.06]" />
              <Skeleton className="h-5 w-16 rounded-full dark:bg-white/[0.07] bg-black/[0.06]" />
            </div>
            <Skeleton className="h-20 sm:h-28 w-full max-w-[480px] rounded-2xl dark:bg-white/[0.07] bg-black/[0.06]" />
            <Skeleton className="h-5 w-44 rounded-full dark:bg-white/[0.07] bg-black/[0.06]" />
            <Skeleton className="h-3.5 w-full max-w-[360px] rounded-xl dark:bg-white/[0.07] bg-black/[0.06]" />
            <Skeleton className="h-3.5 w-3/4 max-w-[260px] rounded-xl dark:bg-white/[0.07] bg-black/[0.06]" />
            <div className="flex items-center gap-3 pt-2">
              <Skeleton className="h-12 w-36 rounded-full dark:bg-white/[0.07] bg-black/[0.06]" />
              <Skeleton className="size-12 rounded-full dark:bg-white/[0.07] bg-black/[0.06]" />
              <Skeleton className="size-12 rounded-full dark:bg-white/[0.07] bg-black/[0.06]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO MAIN
// ─────────────────────────────────────────────────────────────────────────────
export function Hero() {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const { isPlaying: isGlobalPlaying, currentTrack } = useAppSelector(
    (s) => s.player,
  );

  const { data, isLoading } = useFeatureAlbums(6);

  const albums: HeroAlbum[] = useMemo(
    () =>
      (data ?? []).map((album: Album) => ({
        _id: album._id,
        slug: album.slug || album._id,
        title: album.title,
        artistName: album.artist?.name || "Various Artists",
        artistSlug: album.artist?.slug,
        description:
          album.description ||
          `Thưởng thức trọn vẹn từng âm sắc trong "${album.title}".`,
        coverImage: album.coverImage || "/images/default-cover.jpg",
        moodColor: album.themeColor || "262 83% 58%",
      })),
    [data],
  );

  const { currentIndex, nextSlide, prevSlide, goToSlide } = useHeroSlider(
    albums.length,
  );

  const [direction, setDirection] = useState<Direction>(1);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [isLoadingPlay, setIsLoadingPlay] = useState(false);

  // ── Drag via MotionValue ───────────────────────────────────────────────────
  const dragX = useMotionValue(0);
  const artworkTx = useTransform(dragX, [-300, 0, 300], [-55, 0, 55]);
  const artworkOpacity = useTransform(dragX, [-220, 0, 220], [0.55, 1, 0.55]);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const axisLocked = useRef<"x" | "y" | null>(null);

  // ── Derived state ──────────────────────────────────────────────────────────
  // NOTE: currentAlbum may be undefined when albums is empty — handle gracefully below
  const currentAlbum = albums[currentIndex];

  const isThisAlbumPlaying = useMemo(
    () =>
      isGlobalPlaying &&
      !!currentAlbum &&
      currentTrack?.album?._id === currentAlbum._id,
    [isGlobalPlaying, currentTrack, currentAlbum],
  );

  // ── Keyboard nav ──────────────────────────────────────────────────────────
  // All hooks MUST be called before any conditional return.
  const goNext = useCallback(() => {
    setDirection(1);
    nextSlide();
  }, [nextSlide]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    prevSlide();
  }, [prevSlide]);

  const goTo = useCallback(
    (i: number) => {
      setDirection(i > currentIndex ? 1 : -1);
      goToSlide(i);
    },
    [currentIndex, goToSlide],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  // ── Pointer drag ───────────────────────────────────────────────────────────
  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      isDragging.current = false;
      axisLocked.current = null;
      dragStartX.current = e.clientX;
      dragStartY.current = e.clientY;
      dragX.set(0);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [dragX],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const dx = e.clientX - dragStartX.current;
      const dy = e.clientY - dragStartY.current;
      if (!axisLocked.current) {
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6)
          axisLocked.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        return;
      }
      if (axisLocked.current !== "x") return;
      isDragging.current = true;
      dragX.set(dx);
    },
    [dragX],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const finalDx = e.clientX - dragStartX.current;
      dragX.set(0);
      if (!isDragging.current || axisLocked.current !== "x") return;
      if (finalDx < -60) goNext();
      else if (finalDx > 60) goPrev();
      isDragging.current = false;
      axisLocked.current = null;
    },
    [dragX, goNext, goPrev],
  );

  // ── Play ──────────────────────────────────────────────────────────────────
  const handlePlayAlbum = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!currentAlbum) return;
      if (isThisAlbumPlaying) {
        dispatch(setIsPlaying(false));
        return;
      }
      setIsLoadingPlay(true);
      try {
        const res = await queryClient.fetchQuery({
          queryKey: albumKeys.detail(currentAlbum._id),
          queryFn: () => albumApi.getById(currentAlbum._id),
          staleTime: 5 * 60 * 1000,
        });
        const tracks = res.data?.tracks;
        if (!tracks?.length) {
          toast.error("Đĩa nhạc này chưa có bài hát nào!");
          return;
        }
        dispatch(setQueue({ tracks, startIndex: 0 }));
        dispatch(setIsPlaying(true));
        toast.success(`Đang phát: ${currentAlbum.title}`);
      } catch {
        toast.error("Không thể tải dữ liệu. Vui lòng thử lại.");
      } finally {
        setIsLoadingPlay(false);
      }
    },
    [isThisAlbumPlaying, currentAlbum, queryClient, dispatch],
  );

  const handleLike = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!currentAlbum) return;
      const id = currentAlbum._id;
      setLikedMap((prev) => {
        const next = !prev[id];
        toast.success(next ? "Đã lưu vào Thư viện" : "Đã bỏ thích");
        return { ...prev, [id]: next };
      });
    },
    [currentAlbum],
  );

  const handleShare = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => toast.success("Đã sao chép link!"))
      .catch(() => toast.error("Không thể sao chép."));
  }, []);

  // ── GUARD: render skeleton AFTER all hooks ─────────────────────────────────
  if (isLoading || !currentAlbum) return <HeroSkeleton />;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <section
      className={cn(
        "relative min-h-[88dvh] lg:min-h-[92vh] flex flex-col overflow-hidden",
        "dark:bg-[#080808] bg-white",
      )}
      style={{ "--hero-mood": currentAlbum.moodColor } as React.CSSProperties}
      aria-label="Featured albums"
    >
      {/* ══ BACKGROUND SYSTEM ══════════════════════════════════════════════ */}

      {/* Layer 0: dark — blurred cover */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={`bg-dark-${currentAlbum._id}`}
          className="absolute inset-0 z-0 dark:block hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
        >
          <ImageWithFallback
            src={currentAlbum.coverImage}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-[1.12]"
            style={{ filter: "blur(72px) saturate(1.6) brightness(0.18)" }}
          />
          {/* Extra darkening overlay for dark mode */}
          <div className="absolute inset-0 bg-[#080808]/50" />
        </motion.div>
      </AnimatePresence>

      {/* Layer 0b: light — subtle mood tint */}
      <AnimatePresence>
        <motion.div
          key={`bg-light-${currentAlbum._id}`}
          className="absolute inset-0 z-0 dark:hidden block pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9 }}
          style={{
            background: `radial-gradient(ellipse 130% 90% at 50% 0%, hsl(${currentAlbum.moodColor} / 0.08) 0%, transparent 60%)`,
          }}
        />
      </AnimatePresence>

      {/* Layer 1: mood radial — both modes */}
      <AnimatePresence>
        <motion.div
          key={`tint-${currentAlbum._id}`}
          className="absolute inset-0 z-[1] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4 }}
          style={{
            background: `radial-gradient(ellipse 70% 55% at 62% 38%, hsl(${currentAlbum.moodColor} / 0.09) 0%, transparent 62%)`,
          }}
        />
      </AnimatePresence>

      {/* Layer 2: UI vignettes */}
      <div className="absolute inset-0 z-[2] pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-36 dark:bg-gradient-to-b dark:from-black/55 bg-gradient-to-b from-white/90 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-52 dark:bg-gradient-to-t dark:from-[#080808] dark:via-[#080808]/65 bg-gradient-to-t from-white via-white/85 to-transparent" />
        <div className="absolute inset-y-0 left-0 w-24 dark:bg-gradient-to-r dark:from-black/20 to-transparent hidden lg:block" />
        <div className="absolute inset-y-0 right-0 w-20 dark:bg-gradient-to-l dark:from-black/14 to-transparent hidden lg:block" />
      </div>

      {/* ══ CONTENT z-[3] ═══════════════════════════════════════════════════ */}
      <div className="relative z-[3] flex flex-col flex-1">
        <div className="flex-1 flex items-center">
          <div className="container mx-auto px-4 sm:px-6 lg:px-10 py-14 lg:py-20 w-full">
            <div className="max-w-7xl mx-auto flex flex-col lg:grid lg:grid-cols-12 lg:gap-12 xl:gap-20 items-center">
              {/* ── ARTWORK COL ───────────────────────────────────────── */}
              <div
                className="lg:col-span-5 flex justify-center mb-14 lg:mb-0 touch-pan-y"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                style={{ cursor: "grab", userSelect: "none" }}
                role="group"
                aria-label="Album artwork. Drag or use arrow keys to navigate"
              >
                <motion.div style={{ x: artworkTx, opacity: artworkOpacity }}>
                  <ArtworkCard
                    album={currentAlbum}
                    direction={direction}
                    isPlaying={isThisAlbumPlaying}
                    isLoading={isLoadingPlay}
                    onNavigate={() => {
                      if (!isDragging.current)
                        navigate(`/albums/${currentAlbum.slug}`);
                    }}
                    onPlay={handlePlayAlbum}
                  />
                </motion.div>
              </div>

              {/* ── TEXT COL ──────────────────────────────────────────── */}
              <div className="lg:col-span-7 flex flex-col items-center lg:items-start w-full gap-4 sm:gap-5">
                <TextStatic
                  album={currentAlbum}
                  direction={direction}
                  onNavigate={() => navigate(`/albums/${currentAlbum.slug}`)}
                  onNavigateArtist={() => {
                    if (currentAlbum.artistSlug)
                      navigate(`/artist/${currentAlbum.artistSlug}`);
                  }}
                />
                <TextActions
                  isPlaying={isThisAlbumPlaying}
                  isLoading={isLoadingPlay}
                  isLiked={!!likedMap[currentAlbum._id]}
                  onPlay={handlePlayAlbum}
                  onLike={handleLike}
                  onShare={handleShare}
                />

                {/* ── SLIDE PROGRESS — desktop inline under actions ── */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, ...SPRING_MEDIUM }}
                  className="hidden lg:flex items-center gap-4 pt-3"
                >
                  <SlideDots
                    count={albums.length}
                    current={currentIndex}
                    onChange={goTo}
                  />
                  <span className="text-[10px] font-mono dark:text-white/22 text-gray-400/70 tracking-[0.1em] select-none tabular-nums">
                    {String(currentIndex + 1).padStart(2, "0")} /{" "}
                    {String(albums.length).padStart(2, "0")}
                  </span>
                  <span className="text-[10px] dark:text-white/18 text-gray-300 select-none hidden xl:block">
                    · Dùng ← → để điều hướng
                  </span>
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        {/* ── DOTS + COUNTER — mobile only ─────────────────────────────── */}
        <div className="flex lg:hidden flex-col items-center gap-2 pb-7 sm:pb-9">
          <SlideDots
            count={albums.length}
            current={currentIndex}
            onChange={goTo}
          />
          <span className="text-[10px] font-mono dark:text-white/22 text-gray-400/70 tracking-[0.1em] select-none tabular-nums">
            {String(currentIndex + 1).padStart(2, "0")} /{" "}
            {String(albums.length).padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* ══ ARROW BUTTONS z-[4] — desktop only ══════════════════════════════ */}
      <div className="hidden lg:flex absolute inset-y-0 inset-x-0 items-center justify-between z-[4] pointer-events-none px-4 xl:px-6">
        {(
          [
            { fn: goPrev, Icon: ChevronLeft, label: "Trước" },
            { fn: goNext, Icon: ChevronRight, label: "Sau" },
          ] as const
        ).map(({ fn, Icon, label }) => (
          <motion.button
            key={label}
            onClick={(e) => {
              e.stopPropagation();
              fn();
            }}
            aria-label={label}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={SPRING_FAST}
            className={cn(
              "pointer-events-auto flex items-center justify-center",
              "size-11 xl:size-12 rounded-full backdrop-blur-md border transition-all duration-200",
              // Light
              "bg-black/6 border-black/10 text-gray-700 hover:text-gray-900 hover:bg-black/12 hover:border-black/18",
              // Dark
              "dark:bg-black/30 dark:border-white/10 dark:text-white/55 dark:hover:text-white dark:hover:bg-black/55 dark:hover:border-white/18",
              "shadow-sm dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)]",
            )}
          >
            <Icon className="size-5 xl:size-5.5" />
          </motion.button>
        ))}
      </div>
    </section>
  );
}

export default Hero;
