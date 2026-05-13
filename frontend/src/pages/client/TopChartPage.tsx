import React, {
  memo,
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  lazy,
  Suspense,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Loader2,
  BarChart2,
  Flame,
  Globe2,
  Info,
  TrendingUp,
  Music2,
  AlertCircle,
  RefreshCw,
  ChevronUp,
  ArrowDown,
} from "lucide-react";

import {
  RankedTrack,
  useRealtimeChart,
} from "@/features/track/hooks/useRealtimeChart";
// Lazy-load heavy track components to split large chart/vendor bundles
const ChartItem = lazy(() =>
  import("@/features/track/components/ChartItem").then((m) => ({
    default: m.default ?? m.ChartItem,
  })),
);
const ChartLine = lazy(() =>
  import("@/features/track/components/ChartLine").then((m) => ({
    default: m.default ?? m.ChartLine,
  })),
);
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import SectionAmbient from "@/components/SectionAmbient";
import TopChartPageSkeleton from "@/features/analytics/components/TopChartPageSkeleton";

import MusicResult from "@/components/ui/Result";
import { useNavigate } from "react-router-dom";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { IChartDataPoint } from "@/features/track";
import { useSyncInteractions } from "@/features/interaction";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_VISIBLE = 10;
const EXPO_EASE = [0.22, 1, 0.36, 1] as const;

const RANK_STYLES = [
  { token: "--wave-4", label: "Gold" },
  { token: "--brand-400", label: "Silver" },
  { token: "--wave-2", label: "Bronze" },
] as const;

const SKELETON_WIDTHS = [
  { title: "42%", artist: "26%" },
  { title: "55%", artist: "32%" },
  { title: "38%", artist: "20%" },
  { title: "48%", artist: "28%" },
  { title: "61%", artist: "35%" },
  { title: "44%", artist: "24%" },
  { title: "52%", artist: "30%" },
  { title: "39%", artist: "22%" },
  { title: "58%", artist: "34%" },
  { title: "46%", artist: "27%" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

const fadeUp = (delay = 0, reduced = false) =>
  reduced
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.15 },
      }
    : ({
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { delay, duration: 0.54, ease: EXPO_EASE },
      } as const);

const listItem = (index: number, reduced = false) =>
  reduced
    ? {
        layout: true as const,
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.12 },
      }
    : ({
        layout: true as const,
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, scale: 0.97 },
        transition: {
          type: "spring" as const,
          stiffness: 500,
          damping: 30,
          delay: Math.min(index * 0.028, 0.35),
        },
      } as const);

// ─────────────────────────────────────────────────────────────────────────────
// usePullToRefresh — Production v2 (fully ref-based, zero re-renders)
//
// FIX B2+B3+P1: Previous version used useState for pullProgress inside
// touchmove — caused re-render on EVERY touchmove + closure stale bug
// in onTouchEnd (state.pullProgress always captured old value).
// Now: all state is refs, indicator updated via imperative DOM mutation.
// ─────────────────────────────────────────────────────────────────────────────

const PULL_THRESHOLD = 72;

interface PullIndicatorHandle {
  indicatorRef: React.RefObject<HTMLDivElement | null>;
  textRef: React.RefObject<HTMLSpanElement | null>;
  arrowRef: React.RefObject<HTMLSpanElement | null>;
}

function usePullToRefresh(
  onRefresh: () => void,
  handle: PullIndicatorHandle,
): void {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const startY = useRef<number | null>(null);
  const progressRef = useRef(0);

  useEffect(() => {
    const { indicatorRef, textRef, arrowRef } = handle;

    const showIndicator = (progress: number) => {
      const el = indicatorRef.current;
      const txt = textRef.current;
      const arrow = arrowRef.current;
      if (!el) return;

      el.style.opacity = String(Math.min(progress, 1));
      el.style.transform = `translateY(${progress > 0 ? 0 : -32}px)`;
      el.style.display = progress > 0 ? "flex" : "none";

      if (txt)
        txt.textContent = progress >= 1 ? "Thả để làm mới" : "Kéo để làm mới";
      if (arrow)
        arrow.style.transform = `rotate(${progress >= 1 ? 180 : 0}deg)`;
    };

    const hideIndicator = () => {
      const el = indicatorRef.current;
      if (el) {
        el.style.opacity = "0";
        el.style.display = "none";
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 4) return;
      startY.current = e.touches[0].clientY;
      progressRef.current = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        startY.current = null;
        hideIndicator();
        return;
      }
      progressRef.current = Math.min(dy / PULL_THRESHOLD, 1);
      showIndicator(progressRef.current);
    };

    const onTouchEnd = () => {
      if (progressRef.current >= 1) onRefreshRef.current();
      startY.current = null;
      progressRef.current = 0;
      hideIndicator();
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [handle]);
}

// ─────────────────────────────────────────────────────────────────────────────
// useSticky — Production v2 (IntersectionObserver, no layout thrash)
//
// FIX P2: Previous version used getBoundingClientRect() inside rAF scroll
// handler — forces layout recalculation every frame. IntersectionObserver
// fires only on boundary crossing, zero layout cost.
// ─────────────────────────────────────────────────────────────────────────────

function useSticky<T extends HTMLElement>(): [
  React.RefObject<T>,
  boolean,
] {
  const ref = useRef<T>(null!);
  const [sticky, setSticky] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setSticky(!entry.isIntersecting),
      { threshold: 0, rootMargin: "0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, sticky];
}

// ─────────────────────────────────────────────────────────────────────────────
// PULL INDICATOR — shown at top of page during pull gesture
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PullIndicator — v2: imperative DOM-driven (no Framer Motion)
 * Controlled entirely by usePullToRefresh via refs.
 * Zero re-renders during pull gesture.
 */
const PullIndicator = React.forwardRef<
  HTMLDivElement,
  {
    textRef: React.Ref<HTMLSpanElement>;
    arrowRef: React.Ref<HTMLSpanElement>;
  }
>(({ textRef, arrowRef }, ref) => (
  <div
    ref={ref}
    aria-live="polite"
    aria-label="Kéo để làm mới"
    className="fixed top-3 inset-x-0 z-50 flex justify-center pointer-events-none transition-[opacity,transform] duration-150"
    style={{ opacity: 0, display: "none" }}
  >
    <div
      className={cn(
        "flex items-center gap-2 px-3.5 py-1.5 rounded-full",
        "glass-frosted border border-border/40 shadow-raised",
        "text-[11px] font-bold text-primary uppercase tracking-wide",
      )}
    >
      <span ref={arrowRef} className="transition-transform duration-200">
        <ArrowDown className="w-3 h-3" aria-hidden="true" />
      </span>
      <span ref={textRef}>Kéo để làm mới</span>
    </div>
  </div>
));
PullIndicator.displayName = "PullIndicator";

// ─────────────────────────────────────────────────────────────────────────────
// LIVE BADGE
// ─────────────────────────────────────────────────────────────────────────────

const LiveBadge = memo(({ time }: { time: string }) => (
  <div className="badge-playing badge inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest select-none">
    <span className="relative flex h-[7px] w-[7px]" aria-hidden="true">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
      <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-primary" />
    </span>
    Live&nbsp;·&nbsp;{time}
  </div>
));
LiveBadge.displayName = "LiveBadge";

// ─────────────────────────────────────────────────────────────────────────────
// LEADER AVATARS
// ─────────────────────────────────────────────────────────────────────────────

const LeaderAvatars = memo(({ tracks }: { tracks: RankedTrack[] }) => {
  if (tracks.length < 3) return null;
  const top3 = tracks.slice(0, 3);
  return (
    <div className="flex items-center gap-3">
      <span
        className="hidden sm:block text-[10px] font-bold text-brand uppercase tracking-widest"
        aria-hidden="true"
      >
        Top 3
      </span>
      <div className="flex -space-x-2.5" role="list" aria-label="Top 3 tracks">
        {top3.map((t, i) => (
          <div
            key={t._id}
            role="listitem"
            aria-label={`#${i + 1} — ${t.title} (${RANK_STYLES[i].label})`}
            className="relative group/avatar"
            style={{ zIndex: 3 - i }}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full overflow-hidden",
                "border-[2.5px] shadow-sm",
                "transition-transform duration-200 ease-out",
                "group-hover/avatar:scale-110 group-hover/avatar:z-10",
              )}
              style={{ borderColor: `hsl(var(${RANK_STYLES[i].token}))` }}
            >
              <ImageWithFallback
                src={t.coverImage}
                alt={`#${i + 1}: ${t.title}`}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>
            <span
              aria-hidden="true"
              className={cn(
                "absolute -bottom-0.5 -right-0.5 w-[15px] h-[15px] rounded-full",
                "flex items-center justify-center",
                "text-[7px] font-black text-white leading-none",
                "border border-background shadow-sm",
              )}
              style={{ backgroundColor: `hsl(var(${RANK_STYLES[i].token}))` }}
            >
              {i + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
LeaderAvatars.displayName = "LeaderAvatars";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK SKELETON
// ─────────────────────────────────────────────────────────────────────────────

const TrackSkeleton = memo(({ index }: { index: number }) => {
  const w = SKELETON_WIDTHS[index % SKELETON_WIDTHS.length];
  return (
    <div
      className="flex items-center gap-3 px-3 py-3 rounded-xl"
      style={{ animationDelay: `${index * 52}ms` }}
      aria-hidden="true"
    >
      <div className="w-[52px] shrink-0 flex flex-col items-center gap-1.5">
        <div className="skeleton h-[18px] w-5 rounded-sm" />
        <div className="skeleton h-3 w-6 rounded-full" />
      </div>
      <div className="skeleton skeleton-cover w-11 h-11 sm:w-12 sm:h-12 shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <div
          className="skeleton h-3.5 rounded-full"
          style={{ width: w.title }}
        />
        <div
          className="skeleton h-3 rounded-full"
          style={{ width: w.artist }}
        />
      </div>
      <div className="skeleton h-3 rounded-full hidden lg:block w-[140px]" />
      <div className="skeleton h-3 w-9 rounded-full hidden sm:block" />
    </div>
  );
});
TrackSkeleton.displayName = "TrackSkeleton";

const TrackSkeletonList = memo(({ count }: { count: number }) => (
  <div
    className="flex flex-col gap-0.5"
    role="status"
    aria-label="Loading tracks"
    aria-live="polite"
  >
    {Array.from({ length: count }, (_, i) => (
      <TrackSkeleton key={i} index={i} />
    ))}
  </div>
));
TrackSkeletonList.displayName = "TrackSkeletonList";

// ─────────────────────────────────────────────────────────────────────────────
// PAGE LOADER / ERROR / EMPTY
// ─────────────────────────────────────────────────────────────────────────────

const PageLoader = memo(() => (
  <div
    className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background"
    role="status"
    aria-label="Loading chart data"
  >
    <div className="relative w-16 h-16">
      <span
        className="absolute inset-0 rounded-full border border-primary/10 animate-ping"
        aria-hidden="true"
      />
      <span
        className="absolute inset-[4px] rounded-full border border-primary/20 animate-ping"
        style={{ animationDelay: "0.15s" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 rounded-full border border-primary/18 flex items-center justify-center">
        <Loader2
          className="w-6 h-6 animate-spin text-primary"
          aria-hidden="true"
        />
      </div>
    </div>
    <div className="text-center space-y-1.5">
      <p className="text-[12px] font-black uppercase tracking-[0.18em] text-foreground/70">
        Đang tải bảng xếp hạng
      </p>
      <p className="text-[11px] text-muted-foreground/50 font-medium">
        Đang lấy dữ liệu thời gian thực…
      </p>
    </div>
  </div>
));
PageLoader.displayName = "PageLoader";

const ErrorPage = memo(({ onRetry }: { onRetry?: () => void }) => (
  <div
    className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-8"
    role="alert"
    aria-label="Chart failed to load"
  >
    <div className="relative">
      <div
        className="absolute inset-0 rounded-full bg-destructive/10 blur-2xl scale-150"
        aria-hidden="true"
      />
      <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center glass border border-destructive/20 shadow-raised">
        <AlertCircle
          className="w-7 h-7 text-destructive/60"
          aria-hidden="true"
          strokeWidth={1.5}
        />
      </div>
    </div>
    <div className="text-center space-y-2 max-w-xs">
      <p className="font-black text-lg text-foreground/80 tracking-tight">
        Không thể tải bảng xếp hạng
      </p>
      <p className="text-sm text-muted-foreground/55 leading-relaxed">
        Không thể tải được dữ liệu. Đây thường là lỗi mạng tạm thời.
      </p>
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="btn-outline btn-lg gap-2 rounded-full"
      >
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
        Thử lại
      </button>
    )}
  </div>
));
ErrorPage.displayName = "ErrorPage";

const EmptyState = memo(() => (
  <div
    className="flex flex-col items-center justify-center py-24 gap-5 text-center"
    role="status"
    aria-label="No chart data"
  >
    <div className="relative">
      <div
        className="absolute inset-0 rounded-full bg-primary/8 blur-2xl scale-150 animate-glow-breathe"
        aria-hidden="true"
      />
      <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center glass border border-border/40 shadow-raised">
        <Music2
          className="w-6 h-6 text-muted-foreground/45"
          aria-hidden="true"
          strokeWidth={1.5}
        />
      </div>
    </div>
    <div className="space-y-1.5">
      <p className="text-sm font-bold text-foreground/65 tracking-tight">
        Chưa có dữ liệu bảng xếp hạng
      </p>
      <p className="text-xs text-muted-foreground/45 max-w-[240px] leading-relaxed">
        Bảng xếp hạng sẽ hiển thị khi có đủ dữ liệu nghe nhạc. Hãy quay lại sau
        nhé.
      </p>
    </div>
  </div>
));
EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────────────────────
// UPDATING BADGE
// ─────────────────────────────────────────────────────────────────────────────

const UpdatingBadge = memo(({ visible }: { visible: boolean }) => (
  <div aria-live="polite" aria-atomic="true">
    <AnimatePresence>
      {visible && (
        <motion.div
          key="updating"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.18 }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/22 shadow-glow-xs"
        >
          <Loader2
            className="w-3 h-3 animate-spin text-primary"
            aria-hidden="true"
          />
          <span className="text-[10px] font-bold text-primary uppercase tracking-wide">
            Đang cập nhật
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
));
UpdatingBadge.displayName = "UpdatingBadge";

// ─────────────────────────────────────────────────────────────────────────────
// SHOW MORE BUTTON
// ─────────────────────────────────────────────────────────────────────────────

interface ShowMoreButtonProps {
  showAll: boolean;
  totalTracks: number;
  onToggle: () => void;
  reduced: boolean;
}

const ShowMoreButton = memo(
  ({ showAll, totalTracks, onToggle, reduced }: ShowMoreButtonProps) => {
    const remaining = totalTracks - INITIAL_VISIBLE;
    return (
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4, ease: EXPO_EASE }}
        className="mt-10 flex justify-center"
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={showAll}
          aria-label={
            showAll ? "Thu gọn danh sách" : `Xem tất cả ${totalTracks} bài`
          }
          className="btn-secondary rounded-full gap-2.5 font-bold text-[11px] uppercase tracking-widest shadow-raised hover:shadow-elevated backdrop-blur-sm"
        >
          {showAll ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              Thu gọn
            </>
          ) : (
            <>
              <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
              {`Xem thêm ${remaining} bài`}
            </>
          )}
        </button>
      </motion.div>
    );
  },
);
ShowMoreButton.displayName = "ShowMoreButton";

// ─────────────────────────────────────────────────────────────────────────────
// HERO SECTION
// ChartLine receives chartAnimationDelay so its draw animation fires
// 200ms after the hero title animation completes (staggered entry).
// ─────────────────────────────────────────────────────────────────────────────

interface HeroSectionProps {
  tracks: RankedTrack[];
  chartData: IChartDataPoint[];
  lastUpdated: string;
  reduced: boolean;
  isLoading: boolean;
}

const HeroSection = memo(
  ({
    tracks,
    chartData,
    lastUpdated,
    reduced,
    isLoading,
  }: HeroSectionProps) => (
    <section
      aria-label="Chart overview"
      className="relative pt-12 pb-12 md:pt-20 md:pb-16 overflow-hidden"
    >
      <div
        className="absolute inset-0 pointer-events-none -z-10"
        aria-hidden="true"
        style={{ contain: "strict" }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(1000px,100%)] h-80 blur-[100px] rounded-full bg-primary-07" />
        <div
          className={cn(
            "absolute top-12 right-[8%] w-[280px] h-[180px] rounded-full blur-[72px]",
            !reduced && "animate-float-slow",
            "bg-wave-2-042",
          )}
        />
        <div
          className={cn(
            "absolute bottom-0 left-[5%] w-[220px] h-[150px] rounded-full blur-[60px]",
            !reduced && "animate-float-slower",
            "bg-wave-3-032",
          )}
        />
        <div
          className="absolute inset-0 opacity-[0.022] dark:opacity-[0.036]"
          style={{
            backgroundImage: [
              "linear-gradient(hsl(var(--foreground)/1) 1px, transparent 1px)",
              "linear-gradient(90deg, hsl(var(--foreground)/1) 1px, transparent 1px)",
            ].join(","),
            backgroundSize: "44px 44px",
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        <motion.div
          {...fadeUp(0, reduced)}
          className="flex justify-center mb-7"
        >
          <LiveBadge time={lastUpdated} />
        </motion.div>

        <motion.div {...fadeUp(0.07, reduced)} className="text-center mb-11">
          <h1 className="font-black tracking-[-0.045em] leading-[0.88] mb-3 select-none text-[clamp(3.2rem,11vw,6.5rem)]">
            <span className="text-primary bg-clip-text  ">#Charts</span>
          </h1>
        </motion.div>

        {/* Chart card — ChartLine staggered 200ms after title (0.07 + 0.54 ≈ 0.61s → +0.2 = 0.81) */}
        <motion.div {...fadeUp(0.14, reduced)}>
          <div
            className="rounded-2xl border border-border/50 dark:border-primary/15 shadow-brand p-0 md:p-4 animate-fade-up animation-fill-both"
            style={{ animationDelay: "80ms" }}
          >
            <div className="rounded-2xl overflow-hidden border border-border/50 dark:border-border/30 glass-frosted shadow-elevated">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 dark:border-border/25 bg-muted/20 dark:bg-muted/10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center bg-primary/10 border border-primary/15">
                    <BarChart2
                      className="w-[18px] h-[18px] text-primary"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <p className="text-[13.5px] font-bold text-section-title leading-tight">
                      24H Performance
                    </p>
                    <p className="text-[11px] text-section-subtitle leading-tight mt-[1px]">
                      Real-time listening trends
                    </p>
                  </div>
                </div>
                <LeaderAvatars tracks={tracks} />
              </div>

              <div className="p-4 sm:p-5">
                {/*
                chartAnimationDelay: hero title finishes at ~0.61s.
                Adding 0.2s gap gives the eye time to land before lines draw.
                ChartLine should accept this prop and pass it to its draw animation.
              */}
                <Suspense
                  fallback={
                    <div className="h-44">
                      <div className="skeleton rounded-lg h-full" />
                    </div>
                  }
                >
                  <ChartLine
                    data={chartData}
                    tracks={tracks}
                    animationDelay={reduced ? 0 : 0.81}
                    isLoading={isLoading}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  ),
);
HeroSection.displayName = "HeroSection";

// ─────────────────────────────────────────────────────────────────────────────
// STICKY LIST HEADER
//
// Rendered inside TrackListSection as a separate node.
// Fades + slides down into view once `sticky` becomes true.
// Uses glass-frosted so content behind it stays readable.
// ─────────────────────────────────────────────────────────────────────────────

interface StickyHeaderProps {
  totalTracks: number;
  isUpdating: boolean;
  visible: boolean;
}

const StickyHeader = memo(
  ({ totalTracks, isUpdating, visible }: StickyHeaderProps) => (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="sticky-header"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.22, ease: EXPO_EASE }}
          className={cn(
            "sticky top-0 z-30",
            "flex items-center justify-between gap-3",
            "px-4 sm:px-6 lg:px-8 py-2.5",
            "glass-frosted border-b border-border/30",
            "shadow-raised",
            // Negative horizontal margin so it bleeds edge-to-edge inside the section
            "-mx-4 sm:-mx-6 lg:-mx-8",
          )}
          aria-label="Chart section header"
        >
          <div className="flex items-center gap-2">
            <Flame
              className="w-4 h-4 shrink-0"
              style={{ color: "hsl(var(--wave-4))" }}
              aria-hidden="true"
            />
            <span className="font-black tracking-tight text-foreground text-sm">
              Top {totalTracks}
            </span>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 border border-border/50">
              <Globe2
                className="w-2.5 h-2.5 text-brand shrink-0"
                aria-hidden="true"
              />
              <span className="text-[9px] font-bold text-brand uppercase tracking-widest">
                Vietnam
              </span>
            </div>
          </div>
          <UpdatingBadge visible={isUpdating} />
        </motion.div>
      )}
    </AnimatePresence>
  ),
);
StickyHeader.displayName = "StickyHeader";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK LIST SECTION
// Separated from HeroSection so isUpdating only re-renders this tree.
// Includes sticky header anchor + RankedTrack-aware ChartItem calls.
// ─────────────────────────────────────────────────────────────────────────────

interface TrackListSectionProps {
  tracks: RankedTrack[];
  visibleTracks: RankedTrack[];
  isLoading: boolean;
  isUpdating: boolean;
  showAll: boolean;
  onToggleAll: () => void;
  reduced: boolean;
}

const TrackListSection = memo(
  ({
    tracks,
    visibleTracks,
    isLoading,
    isUpdating,
    showAll,
    onToggleAll,
    reduced,
  }: TrackListSectionProps) => {
    // Sticky header: anchor ref sits above the section heading
    const [anchorRef, isSticky] = useSticky<HTMLDivElement>();

    return (
      <section
        id="chart-list"
        aria-label="Chart rankings"
        className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl mt-2 pb-4"
      >
        <SectionAmbient />

        {/* Sentinel element — useSticky watches this div's top edge */}
        <div ref={anchorRef} aria-hidden="true" />

        {/* Sticky header — fades in once sentinel scrolls past viewport top */}
        <StickyHeader
          totalTracks={tracks.length || INITIAL_VISIBLE}
          isUpdating={isUpdating}
          visible={isSticky}
        />

        {/* Static list controls (always visible, not sticky) */}
        <motion.div
          {...fadeUp(0.2, reduced)}
          className="flex items-center justify-between gap-3 mb-6 flex-wrap"
        >
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            <Flame
              className="w-[18px] h-[18px] shrink-0"
              style={{ color: "hsl(var(--wave-4))" }}
              aria-hidden="true"
            />
            <h2 className="font-black tracking-tight text-foreground text-xl sm:text-2xl">
              Top {tracks.length || INITIAL_VISIBLE}
            </h2>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 border border-border/50">
              <Globe2
                className="w-3 h-3 text-brand shrink-0"
                aria-hidden="true"
              />
              <span className="text-[10px] font-bold text-brand uppercase tracking-widest">
                Vietnam
              </span>
            </div>
            {/* UpdatingBadge here only when header is not sticky */}
            {!isSticky && <UpdatingBadge visible={isUpdating} />}
          </div>

          <Button
            variant="ghost"
            size="sm"
            aria-label="Xem quy tắc xếp hạng"
            className="text-muted-foreground/55 hover:text-foreground text-[11px] font-semibold h-8 gap-1.5 shrink-0 rounded-lg"
          >
            <Info className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Quy tắc xếp hạng</span>
            <span className="sm:hidden">Quy tắc</span>
          </Button>
        </motion.div>

        {/* Track list */}
        <div
          className={cn(
            "flex flex-col gap-0.5",
            "transition-opacity duration-300 ease-out",
            isUpdating && "opacity-50 pointer-events-none select-none",
          )}
          aria-busy={isUpdating}
        >
          {isLoading ? (
            <TrackSkeletonList count={INITIAL_VISIBLE} />
          ) : tracks.length === 0 ? (
            <EmptyState />
          ) : (
            <Suspense fallback={<TrackSkeletonList count={INITIAL_VISIBLE} />}>
              <AnimatePresence mode="popLayout" initial={false}>
                {visibleTracks.map((track, index) => (
                  <motion.div key={track._id} {...listItem(index, reduced)}>
                    {/*
                      ChartItem v5: takes RankedTrack directly.
                      rank/trend/rankDelta pre-computed in hook — no prevRank needed.
                    */}
                    <ChartItem track={track} rank={track.rank} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </Suspense>
          )}
        </div>

        <AnimatePresence>
          {!isLoading && tracks.length > INITIAL_VISIBLE && (
            <ShowMoreButton
              key="show-more"
              showAll={showAll}
              totalTracks={tracks.length}
              onToggle={onToggleAll}
              reduced={reduced}
            />
          )}
        </AnimatePresence>
      </section>
    );
  },
);
TrackListSection.displayName = "TrackListSection";

// ─────────────────────────────────────────────────────────────────────────────
// SKIP TO CONTENT
// ─────────────────────────────────────────────────────────────────────────────

const SkipToContent = memo(() => (
  <a
    href="#chart-list"
    className="sr-only focus:not-sr-only fixed top-3 left-3 z-[200] px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    Chuyển đến danh sách bài hát
  </a>
));
SkipToContent.displayName = "SkipToContent";

// ─────────────────────────────────────────────────────────────────────────────
// TOP CHART PAGE — ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

export const TopChartPage = () => {
  const {
    tracks = [],
    chartData = [],
    isLoading,
    isUpdating,
    error,
    refetch,
    lastUpdatedAt,
  } = useRealtimeChart();
  const [showAll, setShowAll] = useState(false);
  const reduced = useReducedMotion() ?? false;
  console.log(chartData,tracks);
  const handleRetry = useCallback(() => refetch?.(), [refetch]);
  const handleToggleAll = useCallback(() => setShowAll((v) => !v), []);

  // Pull-to-refresh refs — imperative, zero re-renders during gesture
  const pullIndicatorRef = useRef<HTMLDivElement>(null);
  const pullTextRef = useRef<HTMLSpanElement>(null);
  const pullArrowRef = useRef<HTMLSpanElement>(null);
  const pullHandle = useMemo(
    () => ({
      indicatorRef: pullIndicatorRef,
      textRef: pullTextRef,
      arrowRef: pullArrowRef,
    }),
    [],
  );
  usePullToRefresh(handleRetry, pullHandle);

  const lastUpdated = useMemo(
    () =>
      new Date(lastUpdatedAt ?? Date.now()).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [lastUpdatedAt],
  );

  // Slice memoized — re-computes only when tracks ref or showAll changes
  const visibleTracks = useMemo(
    () => (showAll ? tracks : tracks.slice(0, INITIAL_VISIBLE)),
    [tracks, showAll],
  );

  const trackIds = useMemo(() => tracks.map((t) => t._id), [tracks]);

  useSyncInteractions(
    trackIds,
    "like",
    "track",
    !isLoading && trackIds.length > 0,
  );
  const navigate = useNavigate();

  const hasResults = tracks.length > 0 && chartData.length > 0;
  const isOffline = !useOnlineStatus();
  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  }, [navigate]);
  if (isLoading && !hasResults) {
    return <TopChartPageSkeleton />;
  }

  if (isLoading && hasResults) {
    return <WaveformLoader glass={false} text="Đang tải" />;
  }
  // Deep Error
  if (error && !hasResults) {
    return (
      <>
        <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
          <MusicResult variant="error" onRetry={refetch} />
        </div>
      </>
    );
  }
  if (isOffline) {
    return (
      <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
        <MusicResult
          variant="error-network"
          onRetry={refetch}
          onBack={handleBack}
        />
      </div>
    );
  }

  return (
    <>
      <SkipToContent />

      {/* Pull-to-refresh indicator — mobile only, zero cost on desktop */}
      <PullIndicator
        ref={pullIndicatorRef}
        textRef={pullTextRef}
        arrowRef={pullArrowRef}
      />

      <main
        id="top-chart-main"
        className="min-h-screen bg-background overflow-x-hidden pb-24 pb-[env(safe-area-inset-bottom,0px)]"
      >
        {/* Hero never re-renders on live refresh — no isUpdating dependency */}
        <HeroSection
          isLoading={isLoading}
          tracks={tracks}
          chartData={chartData}
          lastUpdated={lastUpdated}
          reduced={reduced}
        />

        {/* Track list — isUpdating re-renders only this tree */}
        <TrackListSection
          tracks={tracks}
          visibleTracks={visibleTracks}
          isLoading={isLoading}
          isUpdating={isUpdating}
          showAll={showAll}
          onToggleAll={handleToggleAll}
          reduced={reduced}
        />
      </main>
    </>
  );
};

export default TopChartPage;
