"use client";

/**
 * @file Hero.tsx — Featured Album Slider (Refactored v3.0)
 *
 * ARCHITECTURE:
 * - Atomic sub-components, each memoized with stable prop contracts
 * - All hooks called unconditionally (guard render deferred to return)
 * - Pointer drag uses raw MotionValue pipeline — zero re-renders during drag
 * - Background layers isolated in <HeroBackground> to prevent cascade repaint
 * - Full Soundwave design-token integration via index.css CSS variables
 *
 * DESIGN:
 * - Obsidian Luxury / Neural Audio — matches Soundwave design language
 * - Glassmorphism player controls with brand glow system
 * - Waveform visualizer via .eq-bars / .eq-bar CSS classes
 * - Mood-reactive background with smooth crossfade
 * - 8pt grid spacing throughout
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
// MOTION PRESETS — tuned for premium feel
// ─────────────────────────────────────────────────────────────────────────────
const SPRING_SNAPPY = { type: "spring", stiffness: 520, damping: 34 } as const;
const SPRING_MEDIUM = { type: "spring", stiffness: 300, damping: 30 } as const;
const SPRING_ARTWORK = {
  type: "spring",
  stiffness: 200,
  damping: 26,
  mass: 0.85,
} as const;
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

// ─────────────────────────────────────────────────────────────────────────────
// DIRECTION-AWARE VARIANTS
// ─────────────────────────────────────────────────────────────────────────────
const artworkVariants = {
  enter: (dir: Direction) => ({
    x: dir * 80,
    opacity: 0,
    scale: 0.93,
    rotateY: dir * 8,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    rotateY: 0,
    transition: SPRING_ARTWORK,
  },
  exit: (dir: Direction) => ({
    x: dir * -80,
    opacity: 0,
    scale: 0.93,
    rotateY: dir * -8,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] as const },
  }),
};

const contentStagger = {
  enter: (dir: Direction) => ({ opacity: 0, x: dir * 20, y: 4 }),
  center: (i: number) => ({
    opacity: 1,
    x: 0,
    y: 0,
    transition: { ...SPRING_MEDIUM, delay: i * 0.06 },
  }),
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.12, ease: "easeIn" as const },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EQ BARS — uses .eq-bars / .eq-bar from index.css
// GPU-isolated, zero JS animation loop
// ─────────────────────────────────────────────────────────────────────────────
const EqVisualizer = memo(({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
  const barCounts = { sm: 4, md: 5, lg: 7 };
  const heights = { sm: "h-4", md: "h-6", lg: "h-9" };
  return (
    <div
      className={cn("eq-bars", heights[size], size === "lg" && "eq-bars--lg")}
    >
      {Array.from({ length: barCounts[size] }, (_, i) => (
        <span key={i} className="eq-bar" />
      ))}
    </div>
  );
});
EqVisualizer.displayName = "EqVisualizer";

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE DOTS — animated pill indicators
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
    <div
      className="flex items-center gap-1.5"
      role="tablist"
      aria-label="Album slides"
    >
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          role="tab"
          aria-selected={i === current}
          aria-label={`Slide ${i + 1}`}
          onClick={() => onChange(i)}
          className="p-2 -m-2 group outline-none"
        >
          <motion.div
            className={cn(
              "h-[3px] rounded-full transition-colors",
              "dark:bg-white bg-foreground",
            )}
            animate={{
              width: i === current ? 28 : 8,
              opacity: i === current ? 1 : 0.2,
            }}
            transition={SPRING_SNAPPY}
            whileHover={{ opacity: i === current ? 1 : 0.45 }}
          />
        </button>
      ))}
    </div>
  ),
);
SlideDots.displayName = "SlideDots";

// ─────────────────────────────────────────────────────────────────────────────
// GENRE BADGE — uses Soundwave .badge token classes
// ─────────────────────────────────────────────────────────────────────────────
const MoodBadge = memo(
  ({ moodColor, label = "Album" }: { moodColor: string; label?: string }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={SPRING_SNAPPY}
      className="badge"
      style={{
        background: `hsl(${moodColor} / 0.12)`,
        borderColor: `hsl(${moodColor} / 0.28)`,
        color: `hsl(${moodColor})`,
        border: "1px solid",
      }}
    >
      <Music2 className="size-2.5 shrink-0" />
      <span className="text-label" style={{ fontSize: "9px" }}>
        {label}
      </span>
    </motion.div>
  ),
);
MoodBadge.displayName = "MoodBadge";

// ─────────────────────────────────────────────────────────────────────────────
// PLAY BUTTON ICON — stable icon swap with AnimatePresence
// ─────────────────────────────────────────────────────────────────────────────
const PlayButtonIcon = memo(
  ({ isLoading, isPlaying }: { isLoading: boolean; isPlaying: boolean }) => (
    <AnimatePresence mode="wait" initial={false}>
      {isLoading ? (
        <motion.span
          key="loading"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.12 }}
        >
          <Loader2 className="size-4 animate-spin" />
        </motion.span>
      ) : isPlaying ? (
        <motion.span
          key="pause"
          initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.5, opacity: 0, rotate: 10 }}
          transition={SPRING_SNAPPY}
        >
          <Pause className="size-4 fill-current" />
        </motion.span>
      ) : (
        <motion.span
          key="play"
          initial={{ scale: 0.5, opacity: 0, rotate: 10 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.5, opacity: 0, rotate: -10 }}
          transition={SPRING_SNAPPY}
        >
          <Play className="size-4 fill-current ml-0.5" />
        </motion.span>
      )}
    </AnimatePresence>
  ),
);
PlayButtonIcon.displayName = "PlayButtonIcon";

// ─────────────────────────────────────────────────────────────────────────────
// ARTWORK OVERLAY — hover/playing state layer (isolated to avoid cover repaint)
// ─────────────────────────────────────────────────────────────────────────────
const ArtworkOverlay = memo(
  ({
    isPlaying,
    isLoading,
    onPlay,
  }: {
    isPlaying: boolean;
    isLoading: boolean;
    onPlay: (e: React.MouseEvent) => void;
  }) => (
    <motion.div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-3",
        "bg-black/55 backdrop-blur-[4px] rounded-[inherit]",
      )}
      animate={{ opacity: isLoading || isPlaying ? 1 : 0 }}
      whileHover={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: "easeInOut" }}
      onClick={(e) => {
        e.stopPropagation();
        onPlay(e);
      }}
      aria-hidden={!isPlaying && !isLoading}
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
            transition={SPRING_SNAPPY}
            className="flex flex-col items-center gap-2"
          >
            {/* Uses CSS eq-bars from index.css — no JS animation cost */}
            <EqVisualizer size="lg" />
            <span
              className="text-overline text-white/60 mt-1"
              style={{ fontSize: "9px" }}
            >
              Đang phát
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="play"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={SPRING_SNAPPY}
            className="relative flex items-center justify-center"
          >
            {/* Pulse ring */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ background: "rgba(255,255,255,0.2)" }}
              animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: "easeOut" }}
            />
            <div
              className={cn(
                "relative size-16 rounded-full flex items-center justify-center",
                "bg-white/15 backdrop-blur-sm border border-white/25",
                "shadow-glow-md",
              )}
            >
              <Play className="size-7 text-white fill-white ml-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  ),
);
ArtworkOverlay.displayName = "ArtworkOverlay";

// ─────────────────────────────────────────────────────────────────────────────
// ARTWORK CARD — perspective wrapper + mood glow halo
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
        className="relative select-none"
        style={{ perspective: 1200 }}
      >
        {/* Mood glow halo — GPU composited */}
        <motion.div
          className="absolute inset-[6%] rounded-full pointer-events-none -z-10 will-change-t"
          style={{
            background: `hsl(${album.moodColor} / 0.6)`,
            filter: "blur(52px)",
          }}
          animate={{ opacity: [0.4, 0.72, 0.4], scale: [1, 1.06, 1] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Outer ring — glow ring pulse from index.css tokens */}
        <motion.div
          className="absolute -inset-3 rounded-[2.2rem] pointer-events-none -z-10"
          style={{
            background: `hsl(${album.moodColor} / 0.08)`,
            border: `1px solid hsl(${album.moodColor} / 0.15)`,
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Cover shell */}
        <motion.div
          className={cn(
            "relative overflow-hidden cursor-pointer",
            "rounded-[1.75rem]",
            "border border-white/8 dark:border-white/10",
            "shadow-floating dark:shadow-[0_32px_80px_rgba(0,0,0,0.88),0_8px_24px_rgba(0,0,0,0.55)]",
            "w-[200px] sm:w-[270px] md:w-[320px] lg:w-[360px] xl:w-[400px] aspect-square",
          )}
          whileHover={{ scale: 1.02, rotateY: 1.5 }}
          transition={SPRING_MEDIUM}
          onClick={onNavigate}
          style={{ transformStyle: "preserve-3d" }}
        >
          <ImageWithFallback
            src={album.coverImage}
            alt={album.title}
            className="w-full h-full object-cover"
          />

          {/* Inset depth vignettes */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent pointer-events-none" />

          <ArtworkOverlay
            isPlaying={isPlaying}
            isLoading={isLoading}
            onPlay={onPlay}
          />

          {/* Now playing strip — glassomorphism badge */}
          <AnimatePresence>
            {isPlaying && (
              <motion.div
                initial={{ opacity: 0, y: 14, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={SPRING_SNAPPY}
                className={cn(
                  "absolute bottom-4 left-1/2 -translate-x-1/2 z-20",
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-full whitespace-nowrap",
                  "glass-dark border-white/10",
                  "shadow-floating",
                )}
              >
                <Radio className="size-3 text-primary shrink-0 animate-pulse" />
                <span
                  className="text-overline text-white/70"
                  style={{ fontSize: "9px" }}
                >
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
// CONTENT TEXT — title / artist / description w/ staggered reveal
// ─────────────────────────────────────────────────────────────────────────────
const ContentText = memo(
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
        {/* Label row */}
        <motion.div
          custom={direction}
          variants={contentStagger}
          initial="enter"
          animate={() => contentStagger.center(0) as any}
          className="flex items-center gap-2.5 flex-wrap justify-center lg:justify-start"
        >
          <div className="flex items-center gap-1.5">
            <Disc3 className="size-3 text-primary shrink-0" />
            <span
              className="text-overline text-primary"
              style={{ fontSize: "9px" }}
            >
              Tuyển tập nổi bật
            </span>
          </div>
          <MoodBadge moodColor={album.moodColor} label="Album" />
        </motion.div>

        {/* Title */}
        <motion.h1
          custom={direction}
          variants={contentStagger}
          animate={contentStagger.center(1) as any}
          onClick={onNavigate}
          className={cn(
            "text-display-2xl",
            "dark:text-foreground text-foreground",
            "cursor-pointer hover:text-primary transition-colors duration-300",
            "line-clamp-2 text-center lg:text-left w-full",
          )}
          style={{ fontSize: "clamp(1.75rem, 4.5vw, 3.5rem)" }}
        >
          {album.title}
        </motion.h1>

        {/* Artist */}
        <motion.p
          custom={direction}
          variants={contentStagger}
          animate={contentStagger.center(2) as any}
          className="text-track-meta text-base text-center lg:text-left"
          style={{ fontSize: "0.9rem" }}
        >
          Trình bày bởi{" "}
          <button
            onClick={onNavigateArtist}
            className="font-semibold text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors duration-200"
          >
            {album.artistName}
          </button>
        </motion.p>

        {/* Description */}
        <motion.p
          custom={direction}
          variants={contentStagger}
          animate={contentStagger.center(3) as any}
          className={cn(
            "text-muted-foreground leading-relaxed",
            "line-clamp-2 sm:line-clamp-3 text-center lg:text-left",
            "max-w-[38ch] sm:max-w-[46ch]",
            "text-[13px] sm:text-sm",
          )}
        >
          {album.description}
        </motion.p>
      </motion.div>
    </AnimatePresence>
  ),
);
ContentText.displayName = "ContentText";

// ─────────────────────────────────────────────────────────────────────────────
// ACTION BAR — play / like / share; stable identity (never remounts)
// Uses Soundwave .btn-primary, .btn-icon design tokens
// ─────────────────────────────────────────────────────────────────────────────
const ActionBar = memo(
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
      {/* Primary play button */}
      <motion.button
        onClick={onPlay}
        disabled={isLoading}
        whileHover={!isLoading ? { scale: 1.03, y: -1 } : {}}
        whileTap={!isLoading ? { scale: 0.96 } : {}}
        transition={SPRING_SNAPPY}
        aria-label={isPlaying ? "Tạm dừng" : "Phát album"}
        className={cn(
          "btn-primary btn-lg relative overflow-hidden",
          "min-w-[140px] h-12",
          "disabled:opacity-50 disabled:pointer-events-none",
        )}
      >
        {/* Shimmer sweep on hover */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full"
          whileHover={{ translateX: "200%" }}
          transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
        />

        <PlayButtonIcon isLoading={isLoading} isPlaying={isPlaying} />

        <motion.span
          key={isLoading ? "l" : isPlaying ? "p" : "pl"}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.12 }}
          className="relative z-10"
        >
          {isLoading ? "Đang tải..." : isPlaying ? "Tạm dừng" : "Phát ngay"}
        </motion.span>
      </motion.button>

      {/* Like button — glass-frosted variant */}
      <motion.button
        onClick={onLike}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.85 }}
        transition={SPRING_SNAPPY}
        aria-label={isLiked ? "Bỏ thích" : "Thêm vào yêu thích"}
        aria-pressed={isLiked}
        className={cn(
          "btn-icon relative flex items-center justify-center size-12 rounded-full",
          "border transition-all duration-200",
          isLiked
            ? [
                "bg-[hsl(3_88%_62%/0.12)] border-[hsl(3_88%_62%/0.3)]",
                "text-[hsl(3_88%_62%)] shadow-[0_0_16px_hsl(3_88%_62%/0.2)]",
              ]
            : [
                "glass border-border text-muted-foreground",
                "hover:border-border-strong hover:text-foreground",
              ],
        )}
      >
        <motion.div
          animate={isLiked ? { scale: [1, 1.5, 1] } : { scale: 1 }}
          transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] as any }}
        >
          <Heart className={cn("size-5", isLiked && "fill-current")} />
        </motion.div>
      </motion.button>

      {/* Share button */}
      <motion.button
        onClick={onShare}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.85 }}
        transition={SPRING_SNAPPY}
        aria-label="Chia sẻ"
        className="btn-icon flex items-center justify-center size-12 rounded-full glass border border-border text-muted-foreground hover:border-border-strong hover:text-foreground transition-all duration-200"
      >
        <Share2 className="size-5" />
      </motion.button>
    </div>
  ),
);
ActionBar.displayName = "ActionBar";

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND LAYERS — isolated component prevents Hero re-paint on slide change
// ─────────────────────────────────────────────────────────────────────────────
const HeroBackground = memo(({ album }: { album: HeroAlbum }) => (
  <>
    {/* Dark mode: blurred cover fill */}
    <AnimatePresence mode="popLayout">
      <motion.div
        key={`bg-cover-${album._id}`}
        className="absolute inset-0 z-0 hidden dark:block"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
      >
        <ImageWithFallback
          src={album.coverImage}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover scale-[1.14]"
          style={{ filter: "blur(72px) saturate(1.7) brightness(0.16)" }}
        />
        {/* Extra obsidian damper */}
        <div className="absolute inset-0 bg-background/55" />
      </motion.div>
    </AnimatePresence>

    {/* Light mode: radial mood tint from top */}
    <AnimatePresence>
      <motion.div
        key={`bg-tint-light-${album._id}`}
        className="absolute inset-0 z-0 dark:hidden pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.9 }}
        style={{
          background: `radial-gradient(ellipse 140% 80% at 50% 0%, hsl(${album.moodColor} / 0.07) 0%, transparent 55%)`,
        }}
      />
    </AnimatePresence>

    {/* Both modes: ambient mood radial at artwork position */}
    <AnimatePresence>
      <motion.div
        key={`ambient-${album._id}`}
        className="absolute inset-0 z-[1] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.4 }}
        style={{
          background: `radial-gradient(ellipse 65% 55% at 32% 42%, hsl(${album.moodColor} / 0.1) 0%, transparent 60%)`,
        }}
      />
    </AnimatePresence>

    {/* Vignette system — edges + top/bottom fades */}
    <div className="absolute inset-0 z-[2] pointer-events-none">
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background/70 dark:from-background/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-background dark:from-background/95 via-background/60 to-transparent" />
      <div className="absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-background/20 to-transparent hidden lg:block" />
      <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-background/15 to-transparent hidden lg:block" />
    </div>

    {/* Noise grain overlay — depth and premium texture */}
    <div
      className="absolute inset-0 z-[2] pointer-events-none opacity-[0.025]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: "200px 200px",
      }}
    />
  </>
));
HeroBackground.displayName = "HeroBackground";

// ─────────────────────────────────────────────────────────────────────────────
// NAV ARROW — shared for prev/next buttons
// ─────────────────────────────────────────────────────────────────────────────
const NavArrow = memo(
  ({
    onClick,
    label,
    icon: Icon,
  }: {
    onClick: (e: React.MouseEvent) => void;
    label: string;
    icon: typeof ChevronLeft;
  }) => (
    <motion.button
      onClick={onClick}
      aria-label={label}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      transition={SPRING_SNAPPY}
      className={cn(
        "pointer-events-auto flex items-center justify-center",
        "size-11 xl:size-12 rounded-full",
        "glass-frosted border border-border",
        "text-muted-foreground hover:text-foreground",
        "hover:border-border-strong",
        "shadow-elevated",
        "transition-colors duration-200",
        "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-3",
      )}
    >
      <Icon className="size-5" />
    </motion.button>
  ),
);
NavArrow.displayName = "NavArrow";

// ─────────────────────────────────────────────────────────────────────────────
// HERO SKELETON — mirrors exact Hero grid layout
// ─────────────────────────────────────────────────────────────────────────────
function HeroSkeleton() {
  return (
    <section
      className="relative min-h-[88dvh] flex items-center overflow-hidden bg-background"
      aria-label="Loading featured albums"
      aria-busy="true"
    >
      {/* Subtle shimmer background */}
      <div className="absolute inset-0 bg-mesh-deep opacity-40" />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-10 py-14 lg:py-20 w-full">
        <div className="max-w-7xl mx-auto flex flex-col lg:grid lg:grid-cols-12 lg:gap-20 items-center">
          {/* Artwork skeleton */}
          <div className="lg:col-span-5 flex justify-center mb-14 lg:mb-0">
            <div
              className="skeleton skeleton-cover w-[200px] sm:w-[270px] lg:w-[360px] xl:w-[400px]"
              style={{ borderRadius: "1.75rem" }}
            />
          </div>

          {/* Text skeleton */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start gap-4 w-full">
            <div className="flex gap-2 items-center">
              <div className="skeleton skeleton-text w-28" />
              <div className="skeleton skeleton-pill w-16 h-5" />
            </div>
            <div
              className="skeleton w-full max-w-[480px] h-20 sm:h-28"
              style={{ borderRadius: "1rem" }}
            />
            <div className="skeleton skeleton-text w-44" />
            <div className="skeleton skeleton-text w-full max-w-[360px]" />
            <div className="skeleton skeleton-text w-3/4 max-w-[260px]" />
            <div className="flex items-center gap-3 pt-2">
              <div className="skeleton skeleton-btn w-36" />
              <div className="skeleton skeleton-avatar size-12" />
              <div className="skeleton skeleton-avatar size-12" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO — main orchestrator
// All hooks run unconditionally; guard is deferred to JSX return
// ─────────────────────────────────────────────────────────────────────────────
export function Hero() {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const { isPlaying: isGlobalPlaying, currentTrack } = useAppSelector(
    (s) => s.player,
  );

  const { data, isLoading } = useFeatureAlbums(6);

  // Normalize API data to HeroAlbum shape
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

  // ── Pointer drag — MotionValue pipeline, zero re-renders ─────────────────
  const dragX = useMotionValue(0);
  const dragOffsetX = useTransform(dragX, [-300, 0, 300], [-48, 0, 48]);
  const dragOpacity = useTransform(dragX, [-220, 0, 220], [0.55, 1, 0.55]);

  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const axisLocked = useRef<"x" | "y" | null>(null);

  const currentAlbum = albums[currentIndex];

  const isThisAlbumPlaying = useMemo(
    () =>
      isGlobalPlaying &&
      !!currentAlbum &&
      currentTrack?.album?._id === currentAlbum._id,
    [isGlobalPlaying, currentTrack, currentAlbum],
  );

  // ── Navigation callbacks (stable refs) ───────────────────────────────────
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

  // ── Keyboard navigation ───────────────────────────────────────────────────
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

  // ── Pointer drag handlers ─────────────────────────────────────────────────
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
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          axisLocked.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        }
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

  // ── Play handler ─────────────────────────────────────────────────────────
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

  // ── Navigate handlers — guard against drag-click ──────────────────────────
  const handleNavigateAlbum = useCallback(() => {
    if (!isDragging.current && currentAlbum) {
      navigate(`/albums/${currentAlbum.slug}`);
    }
  }, [currentAlbum, navigate]);

  const handleNavigateArtist = useCallback(() => {
    if (currentAlbum?.artistSlug) {
      navigate(`/artist/${currentAlbum.artistSlug}`);
    }
  }, [currentAlbum, navigate]);

  // ── GUARD: skeleton rendered AFTER all hooks (React rules of hooks) ───────
  if (isLoading || !currentAlbum) return <HeroSkeleton />;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <section
      className={cn(
        "relative min-h-[88dvh] lg:min-h-[92vh] flex flex-col overflow-hidden",
        "bg-background",
      )}
      style={{ "--hero-mood": currentAlbum.moodColor } as React.CSSProperties}
      aria-label="Featured albums"
    >
      {/* ── BACKGROUND (isolated, no Hero re-render cascade) ── */}
      <HeroBackground album={currentAlbum} />

      {/* ── MAIN CONTENT z-[3] ── */}
      <div className="relative z-[3] flex flex-col flex-1">
        <div className="flex-1 flex items-center">
          <div className="container mx-auto px-4 sm:px-6 lg:px-10 py-14 lg:py-20 w-full">
            <div className="max-w-7xl mx-auto flex flex-col lg:grid lg:grid-cols-12 lg:gap-12 xl:gap-20 items-center">
              {/* ── ARTWORK COLUMN ── */}
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
                <motion.div
                  style={{ x: dragOffsetX, opacity: dragOpacity }}
                  className="will-change-t"
                >
                  <ArtworkCard
                    album={currentAlbum}
                    direction={direction}
                    isPlaying={isThisAlbumPlaying}
                    isLoading={isLoadingPlay}
                    onNavigate={handleNavigateAlbum}
                    onPlay={handlePlayAlbum}
                  />
                </motion.div>
              </div>

              {/* ── TEXT + ACTIONS COLUMN ── */}
              <div className="lg:col-span-7 flex flex-col items-center lg:items-start w-full gap-4 sm:gap-5">
                <ContentText
                  album={currentAlbum}
                  direction={direction}
                  onNavigate={handleNavigateAlbum}
                  onNavigateArtist={handleNavigateArtist}
                />

                <ActionBar
                  isPlaying={isThisAlbumPlaying}
                  isLoading={isLoadingPlay}
                  isLiked={!!likedMap[currentAlbum._id]}
                  onPlay={handlePlayAlbum}
                  onLike={handleLike}
                  onShare={handleShare}
                />

                {/* Slide nav — desktop inline */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.38, ...SPRING_MEDIUM }}
                  className="hidden lg:flex items-center gap-4 pt-3"
                >
                  <SlideDots
                    count={albums.length}
                    current={currentIndex}
                    onChange={goTo}
                  />
                  <span className="text-duration text-muted-foreground select-none">
                    {String(currentIndex + 1).padStart(2, "0")} /{" "}
                    {String(albums.length).padStart(2, "0")}
                  </span>
                  <span className="text-[10px] text-muted-foreground/40 select-none hidden xl:block">
                    · Dùng ← → để điều hướng
                  </span>
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        {/* Slide nav — mobile only */}
        <div className="flex lg:hidden flex-col items-center gap-2 pb-8 sm:pb-10">
          <SlideDots
            count={albums.length}
            current={currentIndex}
            onChange={goTo}
          />
          <span className="text-duration text-muted-foreground select-none">
            {String(currentIndex + 1).padStart(2, "0")} /{" "}
            {String(albums.length).padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* ── NAV ARROWS z-[4] — desktop only ── */}
      <div className="hidden lg:flex absolute inset-y-0 inset-x-0 items-center justify-between z-[4] pointer-events-none px-4 xl:px-6">
        <NavArrow
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          label="Trước"
          icon={ChevronLeft}
        />
        <NavArrow
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          label="Sau"
          icon={ChevronRight}
        />
      </div>
    </section>
  );
}

export default Hero;
