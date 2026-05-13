/**
 * HeroCore.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Generic hero engine shared by Album / Artist / Playlist / Genre / Track.
 * All 5 entity connectors render this one component — zero duplication.
 *
 * Architecture
 * ┌─ HeroSelector (tab switcher)
 * │   ├─ AlbumConnector   ──┐
 * │   ├─ PlaylistConnector ─┤
 * │   ├─ ArtistConnector  ─┤──► HeroCore (this file)
 * │   ├─ GenreConnector   ─┤
 * │   └─ TrackConnector   ─┘
 * └──────────────────────────
 */

import {
  memo,
  useCallback,
  useRef,
  useEffect,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Disc3,
  Music2,
} from "lucide-react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
} from "framer-motion";

import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { cn } from "@/lib/utils";
import {
  PremiumMusicVisualizer,
  RealWaveform,
  WaveformBars,
} from "../../../components/MusicVisualizer";
import { VinylLoader } from "../../../components/ui/MusicLoadingEffects";
import MusicResult from "../../../components/ui/Result";
import { HeroSkeleton } from "./HeroSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED TYPES — exported so connectors can build items
// ─────────────────────────────────────────────────────────────────────────────

/** Normalised shape every entity adapter produces. */
export interface HeroItem {
  id: string;
  slug: string;
  title: string;
  /** e.g. artist name shown under the title */
  subtitle?: string;
  /** e.g. "Trình bày bởi" — omit if no subtitle row needed */
  subtitlePrefix?: string;
  description?: string;
  coverImage: string;
  /** HSL channel string, e.g. "258 90% 66%" — consumed as hsl(${themeColor} / α) */
  themeColor: string;
}

/** Playback state provided by the entity-specific hook. */
export interface HeroPlayback {
  isActive: boolean;
  isPlaying: boolean;
  isFetching: boolean;
  onTogglePlay: (e?: React.MouseEvent) => void;
}

export interface HeroCoreProps {
  items: HeroItem[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;

  /** Slider index — owned by the connector so the playback hook sees it */
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onGoTo: (i: number) => void;
  direction: -1 | 1;

  playback: HeroPlayback;

  onNavigateItem: () => void;
  onNavigateSubtitle?: () => void;

  /** e.g. "BỘ SƯU TẬP NỔI BẬT" */
  headerLabel: string;
  /** e.g. "Album" */
  badgeLabel: string;

  /** Like button / Follow button — entity-specific, rendered after play */
  actionExtra?: ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL TYPE
// ─────────────────────────────────────────────────────────────────────────────
type Direction = -1 | 1;

// ─────────────────────────────────────────────────────────────────────────────
// MOTION PRESETS
// ─────────────────────────────────────────────────────────────────────────────
const SPRING_SNAPPY = { type: "spring", stiffness: 520, damping: 34 } as const;
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

const stagger = {
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
// EQ BARS
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
    <div
      className="flex items-center gap-1.5"
      role="tablist"
      aria-label="Slides"
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
              "h-[3px] rounded-full",
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
// MOOD BADGE
// ─────────────────────────────────────────────────────────────────────────────
const MoodBadge = memo(
  ({ themeColor, label }: { themeColor: string; label: string }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={SPRING_SNAPPY}
      className="badge"
      style={{
        background: `hsl(${themeColor} / 0.12)`,
        borderColor: `hsl(${themeColor} / 0.28)`,
        color: `hsl(${themeColor})`,
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
// PLAY BUTTON ICON
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
// ARTWORK OVERLAY
// ─────────────────────────────────────────────────────────────────────────────
const ArtworkOverlay = memo(
  ({
    isPlaying,
    isLoading,
    onPlay,
  }: {
    isPlaying: boolean;
    isLoading: boolean;
    onPlay: (e?: React.MouseEvent) => void;
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
// MIRRORED WAVEFORM — 50 % fewer animation nodes via CSS scaleX(-1)
// ─────────────────────────────────────────────────────────────────────────────
const MirroredWaveform = memo(({ active }: { active: boolean }) => (
  <div className="flex items-end gap-[1px]">
    <RealWaveform active={active} lines={6} />
    <div style={{ transform: "scaleX(-1)" }} aria-hidden="true">
      <RealWaveform active={active} lines={6} />
    </div>
  </div>
));
MirroredWaveform.displayName = "MirroredWaveform";

// ─────────────────────────────────────────────────────────────────────────────
// ARTWORK CARD — 3-D tilt isolated to cover layer only
// ─────────────────────────────────────────────────────────────────────────────
const ArtworkCard = memo(
  ({
    item,
    direction,
    isPlaying,
    isLoading,
    onNavigate,
    onPlay,
  }: {
    item: HeroItem;
    direction: Direction;
    isPlaying: boolean;
    isLoading: boolean;
    onNavigate: () => void;
    onPlay: (e?: React.MouseEvent) => void;
  }) => {
    const mx = useMotionValue(0);
    const my = useMotionValue(0);

    const coverRotateX = useTransform(my, [-100, 100], [6, -6]);
    const coverRotateY = useTransform(mx, [-100, 100], [-6, 6]);
    const shadowX = useTransform(mx, [-100, 100], ["-8px", "8px"]);
    const shadowY = useTransform(my, [-100, 100], ["-6px", "6px"]);
    const boxShadow = useTransform(
      [shadowX, shadowY],
      ([sx, sy]) =>
        `${sx} ${sy} 48px hsl(${item.themeColor} / 0.35), 0 24px 64px rgba(0,0,0,0.45)`,
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(e.clientX - (r.left + r.width / 2));
        my.set(e.clientY - (r.top + r.height / 2));
      },
      [mx, my],
    );
    const handleMouseLeave = useCallback(() => {
      mx.set(0);
      my.set(0);
    }, [mx, my]);

    return (
      <AnimatePresence mode="popLayout" custom={direction} initial={false}>
        <motion.div
          key={item.id}
          custom={direction}
          variants={artworkVariants}
          initial="enter"
          animate="center"
          exit="exit"
          className="relative select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Glow halo */}
          <motion.div
            className="absolute inset-[-5%] rounded-full pointer-events-none -z-10"
            style={{
              background: `radial-gradient(circle, hsl(${item.themeColor} / 0.7) 0%, transparent 70%)`,
              filter: "blur(55px)",
              willChange: "opacity",
            }}
            animate={{ opacity: isPlaying ? [0.35, 0.72, 0.35] : 0.28 }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Outer shell — no 3-D transform, only clipping */}
          <div
            className={cn(
              "relative overflow-hidden cursor-pointer",
              "rounded-[2.8rem] border border-white/10",
              "w-[220px] sm:w-[280px] md:w-[340px] lg:w-[380px] xl:w-[440px] aspect-square",
              "transition-shadow duration-700 ease-out",
              isPlaying && "ring-[6px] ring-primary/30",
            )}
            style={{
              boxShadow: isPlaying
                ? "0 0 0 6px hsl(var(--primary) / 0.3), 0 32px 80px rgba(0,0,0,0.55)"
                : undefined,
            }}
            onClick={onNavigate}
          >
            {/* Cover — the ONLY layer that tilts */}
            <motion.div
              className="absolute inset-0 w-full h-full"
              style={{
                rotateX: coverRotateX,
                rotateY: coverRotateY,
                scale: 1.08,
                transformStyle: "preserve-3d",
                willChange: "transform",
              }}
            >
              <ImageWithFallback
                src={item.coverImage}
                alt={item.title}
                className={cn(
                  "w-full h-full object-cover transition-all duration-1000",
                  isPlaying &&
                    "blur-[6px] saturate-[1.5] brightness-50 scale-110",
                )}
              />
            </motion.div>

            {/* Visualizer bars — mirrored for DOM efficiency */}
            <div
              className="absolute inset-x-0 bottom-0 h-1/2 z-20 pointer-events-none flex items-end justify-center pb-10"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)",
              }}
            >
              <div className="flex items-end gap-[2px]">
                <PremiumMusicVisualizer
                  active={isPlaying}
                  size="md"
                  barCount={10}
                  className="drop-shadow-brand-glow"
                />
              </div>
              <div
                className="flex items-end gap-[2px]"
                style={{ transform: "scaleX(-1)" }}
                aria-hidden="true"
              >
                <PremiumMusicVisualizer
                  active={isPlaying}
                  size="md"
                  barCount={10}
                  className="drop-shadow-brand-glow"
                />
              </div>
            </div>

            <ArtworkOverlay
              isPlaying={isPlaying}
              isLoading={isLoading}
              onPlay={onPlay}
            />
          </div>

          {/* Shadow parallax — outside card */}
          <motion.div
            className="absolute inset-x-[5%] -bottom-6 h-12 rounded-full pointer-events-none -z-10 blur-2xl"
            style={{ background: `hsl(${item.themeColor} / 0.45)`, boxShadow }}
          />
        </motion.div>
      </AnimatePresence>
    );
  },
);
ArtworkCard.displayName = "ArtworkCard";

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT TEXT
// ─────────────────────────────────────────────────────────────────────────────
const ContentText = memo(
  ({
    item,
    direction,
    headerLabel,
    badgeLabel,
    onNavigate,
    onNavigateSubtitle,
    isActive,
    isPlaying,
  }: {
    item: HeroItem;
    direction: Direction;
    headerLabel: string;
    badgeLabel: string;
    onNavigate: () => void;
    onNavigateSubtitle?: () => void;
    isActive?: boolean;
    isPlaying?: boolean;
  }) => (
    <AnimatePresence mode="wait" custom={direction} initial={false}>
      <motion.div
        key={item.id}
        className="flex flex-col items-center lg:items-start gap-3 sm:gap-4 w-full"
        initial="enter"
        animate="center"
        exit="exit"
      >
        {/* Header row */}
        <motion.div
          custom={direction}
          variants={stagger}
          initial="enter"
          animate={stagger.center(0)}
          className="flex items-center gap-3 flex-wrap justify-center lg:justify-start"
        >
          <div className="flex items-center gap-1.5 px-1">
            <Disc3
              className={cn(
                "size-3.5 transition-colors duration-500",
                isActive
                  ? "text-primary animate-spin-slow"
                  : "text-muted-foreground",
              )}
            />
            <span
              className="text-overline text-primary/80 font-bold tracking-[0.15em]"
              style={{ fontSize: "10px" }}
            >
              {headerLabel}
            </span>
          </div>

          <MoodBadge themeColor={item.themeColor} label={badgeLabel} />

          <AnimatePresence>
            {isActive && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-md"
              >
                <WaveformBars active={isPlaying ?? false} bars={3} />
                <span className="text-[9px] font-black text-primary uppercase tracking-widest">
                  {isPlaying ? "Đang phát" : "Tạm dừng"}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Title + waveform */}
        <div className="relative group/title w-full flex flex-col lg:flex-row lg:items-end gap-4">
          <motion.h1
            custom={direction}
            variants={stagger}
            animate={stagger.center(1)}
            onClick={onNavigate}
            className={cn(
              "cursor-pointer transition-all duration-500",
              "text-center lg:text-left flex-1 line-clamp-2",
              "group-hover/title:text-primary group-hover/title:translate-x-1",
              isActive && "text-brand drop-shadow-brand-glow",
            )}
            style={{
              fontSize: "clamp(2.2rem, 6vw, 4.5rem)",
              lineHeight: 1.15,
              paddingBottom: "0.12em",
            }}
          >
            {item.title}
          </motion.h1>

          {isActive && isPlaying && (
            <motion.div
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              className="hidden xl:flex pb-4"
            >
              <MirroredWaveform active />
            </motion.div>
          )}
        </div>

        {/* Subtitle (artist name, etc.) — only rendered when present */}
        {item.subtitle && (
          <motion.div
            custom={direction}
            variants={stagger}
            animate={stagger.center(2)}
            className="flex items-center gap-2 text-base justify-center lg:justify-start"
          >
            {item.subtitlePrefix && (
              <span className="text-muted-foreground">
                {item.subtitlePrefix}
              </span>
            )}
            <button
              onClick={onNavigateSubtitle}
              className="font-bold text-foreground transition-all duration-300 relative group/sub hover:text-primary"
              disabled={!onNavigateSubtitle}
            >
              {item.subtitle}
              {onNavigateSubtitle && (
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover/sub:w-full" />
              )}
            </button>
          </motion.div>
        )}

        {/* Description */}
        <motion.p
          custom={direction}
          variants={stagger}
          animate={stagger.center(3)}
          className={cn(
            "text-muted-foreground/80 leading-relaxed font-medium",
            "line-clamp-2 sm:line-clamp-3 text-center lg:text-left",
            "max-w-[42ch] sm:max-w-[50ch]",
            "text-[14px] sm:text-base border-l-2 border-transparent",
            "lg:hover:border-primary/30 lg:pl-0 lg:hover:pl-4 transition-all duration-500",
          )}
        >
          {item.description ||
            "Khám phá những giai điệu tuyệt vời nhất trong bộ sưu tập đặc biệt này từ Soundwave."}
        </motion.p>
      </motion.div>
    </AnimatePresence>
  ),
);
ContentText.displayName = "ContentText";

// ─────────────────────────────────────────────────────────────────────────────
// ACTION BAR — play button + entity-specific action slot
// ─────────────────────────────────────────────────────────────────────────────
const ActionBar = memo(
  ({
    isPlaying,
    isLoading,
    onPlay,
    actionExtra,
  }: {
    isPlaying: boolean;
    isLoading: boolean;
    onPlay: (e?: React.MouseEvent) => void;
    actionExtra?: ReactNode;
  }) => (
    <div className="flex items-center flex-wrap gap-3 pt-1 justify-center lg:justify-start">
      <motion.button
        onClick={onPlay}
        disabled={isLoading}
        whileHover={!isLoading ? { scale: 1.03, y: -1 } : {}}
        whileTap={!isLoading ? { scale: 0.96 } : {}}
        transition={SPRING_SNAPPY}
        aria-label={isPlaying ? "Tạm dừng" : "Phát ngay"}
        aria-pressed={isPlaying}
        className={cn(
          "btn-primary btn-lg relative overflow-hidden",
          "min-w-[148px] h-12 rounded-2xl",
          "disabled:opacity-50 disabled:pointer-events-none",
        )}
      >
        {/* Shimmer sweep */}
        <motion.span
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(105deg, transparent 30%, hsl(0 0% 100% / 0.12) 50%, transparent 70%)",
            backgroundSize: "200% 100%",
          }}
          initial={{ backgroundPosition: "-100% center" }}
          whileHover={{ backgroundPosition: "200% center" }}
          transition={{ duration: 0.55, ease: [0, 0, 0.2, 1] }}
          aria-hidden
        />

        <PlayButtonIcon isLoading={isLoading} isPlaying={isPlaying} />

        <motion.span
          key={isLoading ? "l" : isPlaying ? "p" : "pl"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 font-semibold tracking-wide"
        >
          {isLoading ? "Đang tải…" : isPlaying ? "Tạm dừng" : "Phát ngay"}
        </motion.span>
      </motion.button>

      {actionExtra}
    </div>
  ),
);
ActionBar.displayName = "ActionBar";

// ─────────────────────────────────────────────────────────────────────────────
// HERO BACKGROUND — GPU-composited, paint-isolated
// ─────────────────────────────────────────────────────────────────────────────
const HeroBackground = memo(({ item }: { item: HeroItem }) => (
  <>
    <div
      className="absolute inset-0 z-0 overflow-hidden"
      style={{
        contain: "strict",
        transform: "translateZ(0)",
        willChange: "transform",
      }}
    >
      {/* Dark mode: blurred cover */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={`bg-cover-${item.id}`}
          className="absolute inset-0 hidden dark:block"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          style={{ willChange: "opacity" }}
        >
          <img
            src={item.coverImage}
            alt=""
            aria-hidden
            loading="eager"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              transform: "scale(1.14) translateZ(0)",
              filter: "blur(72px) saturate(1.7) brightness(0.16)",
              willChange: "transform",
            }}
          />
          <div className="absolute inset-0 bg-background/55" />
        </motion.div>
      </AnimatePresence>

      {/* Light mode: mood tint */}
      <AnimatePresence>
        <motion.div
          key={`bg-tint-${item.id}`}
          className="absolute inset-0 dark:hidden pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9 }}
          style={{
            background: `radial-gradient(ellipse 140% 80% at 50% 0%, hsl(${item.themeColor} / 0.07) 0%, transparent 55%)`,
            willChange: "opacity",
          }}
        />
      </AnimatePresence>

      {/* Ambient radial */}
      <AnimatePresence>
        <motion.div
          key={`ambient-${item.id}`}
          className="absolute inset-0 z-[1] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4 }}
          style={{
            background: `radial-gradient(ellipse 65% 55% at 32% 42%, hsl(${item.themeColor} / 0.1) 0%, transparent 60%)`,
            willChange: "opacity",
          }}
        />
      </AnimatePresence>
    </div>

    {/* Vignette — outside contain:strict so it isn't clipped */}
    <div className="absolute inset-0 z-[2] pointer-events-none">
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background/70 dark:from-background/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-background dark:from-background/95 via-background/60 to-transparent" />
      <div className="absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-background/20 to-transparent hidden lg:block" />
      <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-background/15 to-transparent hidden lg:block" />
    </div>

    {/* Static noise grain */}
    <div
      className="absolute inset-0 z-[2] pointer-events-none opacity-[0.025]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: "200px 200px",
        transform: "translateZ(0)",
        willChange: "transform",
      }}
    />
  </>
));
HeroBackground.displayName = "HeroBackground";

// ─────────────────────────────────────────────────────────────────────────────
// NAV ARROW
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
        "glass-frosted border border-border text-brand",
        "hover:border-border-brand shadow-elevated",
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
// HERO CORE — the single generic orchestrator
// ─────────────────────────────────────────────────────────────────────────────
export function HeroCore({
  items,
  isLoading,
  isError,
  refetch,
  currentIndex,
  onNext,
  onPrev,
  onGoTo,
  direction,
  playback,
  onNavigateItem,
  onNavigateSubtitle,
  headerLabel,
  badgeLabel,
  actionExtra,
}: HeroCoreProps) {
  const currentItem = items[currentIndex];

  // ── Pointer drag — MotionValue pipeline, zero re-renders ─────────────────
  const dragX = useMotionValue(0);
  const dragOffsetX = useTransform(dragX, [-300, 0, 300], [-48, 0, 48]);
  const dragOpacity = useTransform(dragX, [-220, 0, 220], [0.55, 1, 0.55]);

  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const axisLocked = useRef<"x" | "y" | null>(null);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNext, onPrev]);

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
      if (finalDx < -60) onNext();
      else if (finalDx > 60) onPrev();
      isDragging.current = false;
      axisLocked.current = null;
    },
    [dragX, onNext, onPrev],
  );

  // ── Guard against drag-click on navigation ────────────────────────────────
  const handleNavigateItem = useCallback(() => {
    if (!isDragging.current) onNavigateItem();
  }, [onNavigateItem]);

  // ── Loading / error guards ─────────────────────────────────────────────────
  const hasResults = items.length > 0;

  if (isLoading && !hasResults) return <HeroSkeleton />;
  if (isLoading && hasResults) return <VinylLoader />;
  if (isError || !hasResults || !currentItem) {
    return (
      <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
        <MusicResult variant="error" onRetry={refetch} />
      </div>
    );
  }

  return (
    <section
      className={cn(
        "relative min-h-[88dvh] lg:min-h-[92vh] flex flex-col overflow-hidden",
        "bg-background",
      )}
      style={{ "--hero-mood": currentItem.themeColor } as React.CSSProperties}
      aria-label={`${badgeLabel} hero`}
    >
      <HeroBackground item={currentItem} />

      <div className="relative z-[3] flex flex-col flex-1">
        <div className="flex-1 flex items-center">
          <div className="container mx-auto px-4 sm:px-6 lg:px-10 py-14 lg:py-20 w-full">
            <div className="max-w-7xl mx-auto flex flex-col lg:grid lg:grid-cols-12 lg:gap-12 xl:gap-20 items-center">
              {/* Artwork column */}
              <div
                className="lg:col-span-5 flex justify-center mb-14 lg:mb-0 touch-pan-y"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                style={{ cursor: "grab", userSelect: "none" }}
                role="group"
                aria-label="Artwork. Drag or use ← → keys to navigate"
              >
                <motion.div
                  style={{ x: dragOffsetX, opacity: dragOpacity }}
                  className="will-change-t"
                >
                  <ArtworkCard
                    item={currentItem}
                    direction={direction}
                    isPlaying={playback.isPlaying}
                    isLoading={playback.isFetching}
                    onNavigate={handleNavigateItem}
                    onPlay={playback.onTogglePlay}
                  />
                </motion.div>
              </div>

              {/* Text + actions column */}
              <div className="lg:col-span-7 flex flex-col items-center lg:items-start w-full gap-4 sm:gap-5">
                <ContentText
                  item={currentItem}
                  direction={direction}
                  headerLabel={headerLabel}
                  badgeLabel={badgeLabel}
                  onNavigate={handleNavigateItem}
                  onNavigateSubtitle={onNavigateSubtitle}
                  isActive={playback.isActive}
                  isPlaying={playback.isPlaying}
                />

                <ActionBar
                  isPlaying={playback.isPlaying}
                  isLoading={playback.isFetching}
                  onPlay={playback.onTogglePlay}
                  actionExtra={actionExtra}
                />

                {/* Slide nav — desktop */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.38, ...SPRING_MEDIUM }}
                  className="hidden lg:flex items-center gap-4 pt-3"
                >
                  <SlideDots
                    count={items.length}
                    current={currentIndex}
                    onChange={onGoTo}
                  />
                  <span className="text-duration text-section-subtitle select-none">
                    {String(currentIndex + 1).padStart(2, "0")} /{" "}
                    {String(items.length).padStart(2, "0")}
                  </span>
                  <span className="text-[10px] text-section-subtitle select-none hidden xl:block">
                    · Dùng ← → để điều hướng
                  </span>
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        {/* Slide nav — mobile */}
        <div className="flex lg:hidden flex-col items-center gap-2 pb-8 sm:pb-10">
          <SlideDots
            count={items.length}
            current={currentIndex}
            onChange={onGoTo}
          />
          <span className="text-duration text-muted-foreground select-none">
            {String(currentIndex + 1).padStart(2, "0")} /{" "}
            {String(items.length).padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* Nav arrows — desktop only */}
      <div className="hidden lg:flex absolute inset-y-0 inset-x-0 items-center justify-between z-[4] pointer-events-none px-4 xl:px-6">
        <NavArrow
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          label="Trước"
          icon={ChevronLeft}
        />
        <NavArrow
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          label="Sau"
          icon={ChevronRight}
        />
      </div>
    </section>
  );
}

export default HeroCore;
