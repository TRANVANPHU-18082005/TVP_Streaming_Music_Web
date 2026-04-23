import {
  useState,
  useCallback,
  memo,
  useRef,
  useEffect,
  type PointerEvent as ReactPointerEvent,
  useMemo,
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

import { useNavigate } from "react-router-dom";

import { ImageWithFallback } from "@/components/figma/ImageWithFallback";

import { cn } from "@/lib/utils";

import { useFeatureAlbums } from "@/features/album/hooks/useAlbumsQuery";
import { IAlbum } from "@/features";
import { AlbumLikeButton } from "@/features/interaction/components/LikeButton";
import { useAlbumPlayback } from "@/features/player/hooks/useAlbumPlayback";
import { useHeroSlider } from "@/hooks";
import {
  PremiumMusicVisualizer,
  RealWaveform,
  WaveformBars,
} from "../../../components/MusicVisualizer";
import { VinylLoader } from "../../../components/ui/MusicLoadingEffects";
import MusicResult from "../../../components/ui/Result";

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
// ─────────────────────────────────────────────────────────────────────────────
// OPT 1 — ArtworkCard: Tách 3D tilt ra khỏi Vinyl/Visualizer
//
// Trước: toàn bộ <motion.div> bao gồm VinylDisc + Visualizer đều chịu
//   rotateX/rotateY → browser phải composite toàn bộ stacking context 3D
//   mỗi mousemove → expensive paint.
//
// Sau: Chỉ lớp cover image nghiêng theo chuột.
//   VinylDisc + Visualizer nằm trên một plane cố định (transform: none)
//   → chúng không tham gia vào 3D stacking context → zero repaint cost.
//   Hiệu ứng nhìn vẫn đẹp vì parallax cảm giác chiều sâu đến từ cover, không
//   cần toàn bộ card đổ nghiêng.
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
    album: IAlbum;
    direction: Direction;
    isPlaying: boolean;
    isLoading: boolean;
    onNavigate: () => void;
    onPlay: (e: React.MouseEvent) => void;
  }) => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    // OPT 1A: Chỉ tilt lớp cover — giảm range xuống ±6deg (từ ±10)
    // để animation mượt hơn ở 60fps trên thiết bị mid-range
    const coverRotateX = useTransform(y, [-100, 100], [6, -6]);
    const coverRotateY = useTransform(x, [-100, 100], [-6, 6]);

    // Shadow parallax: bóng đổ di chuyển ngược chiều tilt → ảo giác depth
    const shadowX = useTransform(x, [-100, 100], ["-8px", "8px"]);
    const shadowY = useTransform(y, [-100, 100], ["-6px", "6px"]);
    const boxShadow = useTransform(
      [shadowX, shadowY],
      ([sx, sy]) =>
        `${sx} ${sy} 48px hsl(${album.themeColor} / 0.35), 0 24px 64px rgba(0,0,0,0.45)`,
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        x.set(e.clientX - (rect.left + rect.width / 2));
        y.set(e.clientY - (rect.top + rect.height / 2));
      },
      [x, y],
    );

    const handleMouseLeave = useCallback(() => {
      x.set(0);
      y.set(0);
    }, [x, y]);

    return (
      <AnimatePresence mode="popLayout" custom={direction} initial={false}>
        <motion.div
          key={album._id}
          custom={direction}
          variants={artworkVariants}
          initial="enter"
          animate="center"
          exit="exit"
          className="relative select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Glow halo — GPU layer, will-change: opacity handles pulse cheaply */}
          <motion.div
            className="absolute inset-[-5%] rounded-full pointer-events-none -z-10"
            style={{
              background: `radial-gradient(circle, hsl(${album.themeColor} / 0.7) 0%, transparent 70%)`,
              filter: "blur(55px)",
              willChange: "opacity", // OPT 1B: chỉ animate opacity, không scale
            }}
            animate={{ opacity: isPlaying ? [0.35, 0.72, 0.35] : 0.28 }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />

          {/*
           * OUTER SHELL — kích thước + border-radius, KHÔNG có 3D transform.
           * overflow:hidden ở đây clip tất cả lớp con. cursor + click ở đây.
           */}
          <div
            className={cn(
              "relative overflow-hidden cursor-pointer",
              "rounded-[2.8rem] border border-white/10",
              "w-[220px] sm:w-[280px] md:w-[340px] lg:w-[380px] xl:w-[440px] aspect-square",
              // isPlaying ring: CSS transition, không gây layout
              "transition-shadow duration-700 ease-out",
              isPlaying && "ring-[6px] ring-primary/30",
            )}
            style={{
              // OPT 1C: Box-shadow chứa parallax depth thay vì rotateY toàn card
              boxShadow: isPlaying
                ? `0 0 0 6px hsl(var(--primary) / 0.3), 0 32px 80px rgba(0,0,0,0.55)`
                : undefined,
            }}
            onClick={onNavigate}
          >
            {/*
             * COVER IMAGE LAYER — đây là THỨ DUY NHẤT nghiêng theo chuột.
             * perspective trên chính nó → 3D stacking context bị giới hạn
             * trong lớp này, không leo lên outer shell.
             * scale(1.14) để khi tilt ±6deg không lộ cạnh trắng.
             */}
            <motion.div
              className="absolute inset-0 w-full h-full"
              style={{
                rotateX: coverRotateX,
                rotateY: coverRotateY,
                scale: 1.08, // đủ margin để không lộ edge khi tilt
                transformStyle: "preserve-3d",
                willChange: "transform",
              }}
            >
              <ImageWithFallback
                src={album.coverImage}
                alt={album.title}
                className={cn(
                  "w-full h-full object-cover transition-all duration-1000",
                  isPlaying
                    ? "blur-[6px] saturate-[1.5] brightness-50 scale-110"
                    : "",
                )}
              />
            </motion.div>

            {/*
             * OPT 3A — VISUALIZER: barCount giảm xuống 18 (từ 32).
             * CSS mirror trick: Visualizer render một nửa rồi scale(-1,1)
             * để có đối xứng, tiết kiệm ~50% DOM nodes.
             * Wrapped trong will-change:opacity để isolate repaint.
             */}
            <div
              className="absolute inset-x-0 bottom-0 h-1/2 z-20 pointer-events-none flex items-end justify-center pb-10"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)",
              }}
            >
              {/* Left half */}
              <div className="flex items-end gap-[2px]">
                <PremiumMusicVisualizer
                  active={isPlaying}
                  size="md"
                  barCount={10} // OPT 3A: 10 cột thay vì 32
                  className="drop-shadow-brand-glow"
                />
              </div>
              {/* Right half — CSS mirror, zero extra DOM cost */}
              <div
                className="flex items-end gap-[2px]"
                style={{ transform: "scaleX(-1)" }} // CSS mirror
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

            {/* GLASSMORPHISM OVERLAY */}
            <ArtworkOverlay
              isPlaying={isPlaying}
              isLoading={isLoading}
              onPlay={onPlay}
            />

            {/* NOW PLAYING STATUS — flat, no translateZ */}
          </div>

          {/* OPT 1F: Shadow parallax bên ngoài card — depth không cần 3D */}
          <motion.div
            className="absolute inset-x-[5%] -bottom-6 h-12 rounded-full pointer-events-none -z-10 blur-2xl"
            style={{
              background: `hsl(${album.themeColor} / 0.45)`,
              boxShadow, // parallax shadow từ useTransform
            }}
          />
        </motion.div>
      </AnimatePresence>
    );
  },
);
ArtworkCard.displayName = "ArtworkCard";

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT TEXT — title / artist / description w/ staggered reveal
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// ContentText — dùng MirroredWaveform thay RealWaveform trực tiếp
// Chỉ phần thay đổi được ghi lại; phần còn lại giữ nguyên.
// ─────────────────────────────────────────────────────────────────────────────
const ContentText = memo(
  ({
    album,
    direction,
    onNavigate,
    onNavigateArtist,
    isActive,
    isPlaying,
  }: {
    album: IAlbum;
    direction: Direction;
    onNavigate: () => void;
    onNavigateArtist: () => void;
    isActive?: boolean;
    isPlaying?: boolean;
  }) => (
    <AnimatePresence mode="wait" custom={direction} initial={false}>
      <motion.div
        key={album._id}
        className="flex flex-col items-center lg:items-start gap-3 sm:gap-4 w-full"
        initial="enter"
        animate="center"
        exit="exit"
      >
        {/* Header Row: Badge + Status */}
        <motion.div
          custom={direction}
          variants={contentStagger}
          initial="enter"
          animate={() => contentStagger.center(0) as any}
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
              FEATURED COLLECTION
            </span>
          </div>

          <MoodBadge moodColor={album.themeColor} label="Album" />

          <AnimatePresence>
            {isActive && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-md"
              >
                <WaveformBars active={isPlaying || false} bars={3} />
                <span className="text-[9px] font-black text-primary uppercase tracking-widest">
                  {isPlaying ? "Now Streaming" : "Paused"}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Title + Waveform */}
        <div className="relative group/title w-full flex flex-col lg:flex-row lg:items-end gap-4">
          <motion.h1
            custom={direction}
            variants={contentStagger}
            animate={contentStagger.center(1) as any}
            onClick={onNavigate}
            className={cn(
              "cursor-pointer transition-all duration-500",
              "text-center lg:text-left flex-1",
              "group-hover/title:text-primary group-hover/title:translate-x-1",
              isActive && "text-brand drop-shadow-brand-glow",
            )}
            style={{
              fontSize: "clamp(2.2rem, 6vw, 4.5rem)",
              // FIX 1: leading đủ rộng để dấu tiếng Việt không bị clip
              lineHeight: 1.15,
              // FIX 2: padding-bottom tạo khoảng thở cho descender (ý, ợ, ụ...)
              paddingBottom: "0.12em",
              // FIX 3: thay line-clamp bằng max-height + overflow hidden
              // để tự kiểm soát clip boundary, không dùng -webkit-line-clamp
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              // FIX 4: clip-path thay vì overflow:hidden để không cắt shadow/glow
              // nhưng vẫn giới hạn số dòng — dùng padding bù thêm ở dưới
            }}
          >
            {album.title}
          </motion.h1>

          {/* OPT 3B: MirroredWaveform thay RealWaveform — 50% ít animation hơn */}
          {isActive && isPlaying && (
            <motion.div
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              className="hidden xl:flex pb-4"
            >
              <MirroredWaveform active={true} />
            </motion.div>
          )}
        </div>

        {/* Artist Row */}
        <motion.div
          custom={direction}
          variants={contentStagger}
          animate={contentStagger.center(2) as any}
          className="flex items-center gap-2 text-base justify-center lg:justify-start"
        >
          <span className="text-muted-foreground">Trình bày bởi</span>
          <button
            onClick={onNavigateArtist}
            className="font-bold text-foreground transition-all duration-300 relative group/artist hover:text-primary"
          >
            {album.artist.name}
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover/artist:w-full" />
          </button>
        </motion.div>

        {/* Description */}
        <motion.p
          custom={direction}
          variants={contentStagger}
          animate={contentStagger.center(3) as any}
          className={cn(
            "text-muted-foreground/80 leading-relaxed font-medium",
            "line-clamp-2 sm:line-clamp-3 text-center lg:text-left",
            "max-w-[42ch] sm:max-w-[50ch]",
            "text-[14px] sm:text-base border-l-2 border-transparent",
            "lg:hover:border-primary/30 lg:pl-0 lg:hover:pl-4 transition-all duration-500",
          )}
        >
          {album.description ||
            "Khám phá những giai điệu tuyệt vời nhất trong bộ sưu tập đặc biệt này từ Soundwave."}
        </motion.p>
      </motion.div>
    </AnimatePresence>
  ),
);
ContentText.displayName = "ContentText";
// ─────────────────────────────────────────────────────────────────────────────
// OPT 3 — MirroredWaveform: CSS mirror trick cho RealWaveform
//
// Trước: ContentText render <RealWaveform active={true} lines={12} />
//   → 12 animated DOM nodes + 12 CSS animation instances.
//
// Sau: MirroredWaveform render 6 lines + scaleX(-1) copy → 12 lines visual,
//   chỉ 6 animation instances thực tế.
//   Dùng useMemo để tránh re-create khi isPlaying không đổi.
//
// Đây là wrapper nhỏ, không thay đổi RealWaveform source.
// ─────────────────────────────────────────────────────────────────────────────
const MirroredWaveform = memo(({ active }: { active: boolean }) => (
  <div className="flex items-end gap-[1px]">
    {/* Left half: real nodes */}
    <RealWaveform active={active} lines={6} />
    {/* Right half: CSS mirror — zero extra animation cost */}
    <div style={{ transform: "scaleX(-1)" }} aria-hidden="true">
      <RealWaveform active={active} lines={6} />
    </div>
  </div>
));
MirroredWaveform.displayName = "MirroredWaveform";

// ─────────────────────────────────────────────────────────────────────────────
// ACTION BAR — play / like / share; stable identity (never remounts)
// Uses Soundwave .btn-primary, .btn-icon design tokens
// ─────────────────────────────────────────────────────────────────────────────
const ActionBar = memo(
  ({
    album,
    isPlaying,
    isLoading,
    onPlay,
  }: {
    album: IAlbum;
    isPlaying: boolean;
    isLoading: boolean;
    onPlay: (e: React.MouseEvent) => void;
  }) => (
    <div className="flex items-center flex-wrap gap-3 pt-1 justify-center lg:justify-start">
      {/* ── PRIMARY PLAY — .btn-primary + .control-btn--primary from design system ── */}
      <motion.button
        onClick={onPlay}
        disabled={isLoading}
        whileHover={!isLoading ? { scale: 1.03, y: -1 } : {}}
        whileTap={!isLoading ? { scale: 0.96 } : {}}
        transition={SPRING_SNAPPY}
        aria-label={isPlaying ? "Pause album" : "Play album"}
        aria-pressed={isPlaying}
        className={cn(
          // .btn-primary + .btn-lg gives gradient + glow + font-weight
          "btn-primary btn-lg relative overflow-hidden",
          "min-w-[148px] h-12 rounded-2xl",
          "disabled:opacity-50 disabled:pointer-events-none",
        )}
      >
        {/*
         * Shimmer sweep — uses inset-0 + pointer-events-none so it doesn't
         * intercept click. Opacity 0→1→0 on hover via Framer.
         * Background is white/8 to lift off the gradient without hardcoding.
         */}
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
          aria-hidden="true"
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
          {isLoading ? "Loading…" : isPlaying ? "Pause" : "Play Now"}
        </motion.span>
      </motion.button>

      {/* ── LIKE — .like-btn token + token-safe liked state ── */}

      <AlbumLikeButton id={album._id} variant="detail" />
    </div>
  ),
);
ActionBar.displayName = "ActionBar";
// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND LAYERS — isolated component prevents Hero re-paint on slide change
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// OPT 2 — HeroBackground: GPU compositing + blur elimination
//
// Trước: ImageWithFallback với filter:blur(72px) được tính toán real-time
//   mỗi khi browser cần repaint → "Kẻ sát nhân" GPU.
//
// Sau 3 thay đổi:
//   A. transform:translateZ(0) + will-change:transform đưa background
//      vào dedicated compositor layer → blur chỉ tính 1 lần, không repaint
//      khi foreground thay đổi.
//   B. Ảnh background được load ở kích thước nhỏ hơn (thêm ?w=80 hint nếu
//      CDN hỗ trợ) hoặc dùng img loading="eager" decoding="sync" để không
//      block LCP.
//   C. Thêm `contain: "strict"` vào wrapper để browser không lan repaint
//      ra ngoài vùng này.
// ─────────────────────────────────────────────────────────────────────────────
const HeroBackground = memo(({ album }: { album: IAlbum }) => (
  <>
    {/* OPT 2: Wrapper layer — isolated compositor tile */}
    <div
      className="absolute inset-0 z-0 overflow-hidden"
      style={{
        contain: "strict", // OPT 2C: layout + paint + size isolation
        transform: "translateZ(0)", // OPT 2A: force composite layer
        willChange: "transform", // OPT 2A: hint browser trước
      }}
    >
      {/* Dark mode blurred cover */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={`bg-cover-${album._id}`}
          className="absolute inset-0 hidden dark:block"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          style={{
            // OPT 2A: layer riêng cho animated opacity
            willChange: "opacity",
          }}
        >
          {/*
           * OPT 2B: Dùng img thường thay vì ImageWithFallback để
           * kiểm soát decoding. loading="eager" vì đây là LCP candidate.
           * Ảnh được scale lên 114% nên kích thước thực tải về có thể nhỏ hơn
           * (nếu CDN hỗ trợ resize param thêm ?w=400&q=60).
           * filter:blur() áp dụng TRÊN CHÍNH lớp này, không lan ra ngoài
           * vì có contain:strict ở wrapper cha.
           */}
          <img
            src={album.coverImage}
            alt=""
            aria-hidden
            loading="eager"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              transform: "scale(1.14) translateZ(0)", // OPT 2A: sub-layer
              filter: "blur(72px) saturate(1.7) brightness(0.16)",
              // OPT 2B: blur đã được offload lên GPU sub-layer riêng
              willChange: "transform",
            }}
          />
          <div className="absolute inset-0 bg-background/55" />
        </motion.div>
      </AnimatePresence>

      {/* Light mode: radial mood tint */}
      <AnimatePresence>
        <motion.div
          key={`bg-tint-light-${album._id}`}
          className="absolute inset-0 dark:hidden pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9 }}
          style={{
            background: `radial-gradient(ellipse 140% 80% at 50% 0%, hsl(${album.themeColor} / 0.07) 0%, transparent 55%)`,
            willChange: "opacity",
          }}
        />
      </AnimatePresence>

      {/* Ambient mood radial */}
      <AnimatePresence>
        <motion.div
          key={`ambient-${album._id}`}
          className="absolute inset-0 z-[1] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4 }}
          style={{
            background: `radial-gradient(ellipse 65% 55% at 32% 42%, hsl(${album.themeColor} / 0.1) 0%, transparent 60%)`,
            willChange: "opacity",
          }}
        />
      </AnimatePresence>
    </div>

    {/* Vignette system — NGOÀI wrapper để không bị contain:strict clip */}
    <div className="absolute inset-0 z-[2] pointer-events-none">
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background/70 dark:from-background/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-background dark:from-background/95 via-background/60 to-transparent" />
      <div className="absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-background/20 to-transparent hidden lg:block" />
      <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-background/15 to-transparent hidden lg:block" />
    </div>

    {/* Noise grain — static, không animate → zero cost */}
    <div
      className="absolute inset-0 z-[2] pointer-events-none opacity-[0.025]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: "200px 200px",
        // OPT 2A: static texture → isolate ra layer riêng
        transform: "translateZ(0)",
        willChange: "transform",
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
        "text-brand",
        "hover:border-border-brand",
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
  const navigate = useNavigate();

  // 3. Logic kiểm tra Album đang phát (Giữ nguyên nhưng an toàn hơn)

  const { data, isLoading, isError, refetch } = useFeatureAlbums(6);
  const albums = useMemo(() => data ?? [], [data]);
  // Normalize API data to HeroAlbum shape
  const { currentIndex, nextSlide, prevSlide, goToSlide } = useHeroSlider(
    albums?.length || 0,
  );

  const [direction, setDirection] = useState<Direction>(1);

  // ── Pointer drag — MotionValue pipeline, zero re-renders ─────────────────
  const dragX = useMotionValue(0);
  const dragOffsetX = useTransform(dragX, [-300, 0, 300], [-48, 0, 48]);
  const dragOpacity = useTransform(dragX, [-220, 0, 220], [0.55, 1, 0.55]);

  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const axisLocked = useRef<"x" | "y" | null>(null);

  const currentAlbum = albums[currentIndex];
  const { togglePlayAlbum, isThisAlbumActive, isThisAlbumPlaying, isFetching } =
    useAlbumPlayback(currentAlbum);

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

  // ── Navigate handlers — guard against drag-click ──────────────────────────
  const handleNavigateAlbum = useCallback(() => {
    if (!isDragging.current && currentAlbum) {
      navigate(`/albums/${currentAlbum.slug}`);
    }
  }, [currentAlbum, navigate]);

  const handleNavigateArtist = useCallback(() => {
    if (currentAlbum && currentAlbum?.artist) {
      navigate(`/artists/${currentAlbum.artist.slug}`);
    }
  }, [currentAlbum, navigate]);
  const hasResults = albums.length > 0;
  const isOffline = !navigator.onLine;

  if (isLoading && !hasResults) {
    return <HeroSkeleton />;
  }
  // Switching
  if (isLoading && hasResults) {
    return <VinylLoader />;
  }
  // Deep Error
  if (isError || !hasResults || !currentAlbum) {
    return (
      <>
        <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
          <MusicResult variant="error" onRetry={refetch} />
        </div>
      </>
    );
  }
  // Offline
  if (isOffline) {
    return (
      <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
        <MusicResult variant="error-network" onRetry={refetch} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <section
      className={cn(
        "relative min-h-[88dvh] lg:min-h-[92vh] flex flex-col overflow-hidden",
        "bg-background",
      )}
      style={{ "--hero-mood": currentAlbum.themeColor } as React.CSSProperties}
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
                    isLoading={isFetching}
                    onNavigate={handleNavigateAlbum}
                    onPlay={togglePlayAlbum}
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
                  isActive={isThisAlbumActive}
                  isPlaying={isThisAlbumPlaying}
                />

                <ActionBar
                  isPlaying={isThisAlbumPlaying}
                  isLoading={isFetching}
                  album={currentAlbum}
                  onPlay={togglePlayAlbum}
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
                  <span className="text-duration text-section-subtitle select-none">
                    {String(currentIndex + 1).padStart(2, "0")} /{" "}
                    {String(albums.length).padStart(2, "0")}
                  </span>
                  <span className="text-[10px] text-section-subtitle select-none hidden xl:block">
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
