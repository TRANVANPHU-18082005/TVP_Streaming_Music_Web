/**
 * TopFeaturedTracks.tsx — Home-page chart widget (v4.0)
 */

import { memo, useMemo, useCallback, useRef, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  Loader2,
  Music2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  useRealtimeChart,
  RankedTrack,
} from "@/features/track/hooks/useRealtimeChart";
import { ChartItem } from "@/features/track/components/ChartItem";
import { cn } from "@/lib/utils";
import SectionAmbient from "./SectionAmbient";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

const TOP_N = 10;
const EASE_EXPO = [0.22, 1, 0.36, 1] as const;

const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.22, ease: EASE_EXPO },
} as const;

const slideUpVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.28, ease: EASE_EXPO },
} as const;

const makeRowVariants = (index: number, reduced: boolean) => ({
  layout: true as const,
  initial: reduced ? { opacity: 0 } : { opacity: 0, y: 10 },
  animate: reduced ? { opacity: 1 } : { opacity: 1, y: 0 },
  exit: reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97 },
  transition: reduced
    ? { duration: 0.15 }
    : {
        type: "spring" as const,
        stiffness: 520,
        damping: 32,
        delay: Math.min(index * 0.028, 0.28),
      },
});

// ─────────────────────────────────────────────────────────────────────────────
// DIVIDER — reusable wave-1 glow strip
// ─────────────────────────────────────────────────────────────────────────────

const WaveDivider = memo(() => (
  <div
    className="block h-px"
    style={{
      background: `linear-gradient(to right,
        transparent,
        hsl(var(--brand-glow) / 0.3) 30%,
        hsl(var(--brand-glow) / 0.28) 70%,
        transparent)`,
      boxShadow: "0 0 8px hsl(var(--brand-glow) / 0.1)",
    }}
  />
));
WaveDivider.displayName = "WaveDivider";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER
// ─────────────────────────────────────────────────────────────────────────────

const ChartHeader = memo(({ viewAllHref }: { viewAllHref: string }) => (
  <div className="flex items-start justify-between gap-4 mb-7 sm:mb-8">
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div
          className="flex items-center justify-center size-6 rounded-md"
          style={{
            background: "hsl(var(--brand-glow) / 0.12)",
            color: "hsl(var(--brand-glow))",
          }}
        >
          <BarChart3 className="size-3.5" aria-hidden="true" />
        </div>
        <span
          className="text-overline"
          style={{ color: "hsl(var(--brand-glow))" }}
        >
          Top Charts
        </span>
      </div>

      <h2
        className="text-section-title text-foreground leading-tight"
        id="top-featured-tracks-heading"
      >
        Top Featured Tracks
      </h2>

      <p className="text-section-subtitle hidden sm:block">
        Những bài hát được yêu thích nhất, cập nhật liên tục.
      </p>
    </div>

    <Link
      to={viewAllHref}
      className={cn(
        "group flex items-center gap-1.5 shrink-0 mt-1",
        "text-sm font-medium text-brand opacity-70",
        "hover:text-brand transition-colors duration-200 hover:opacity-100",
      )}
      aria-label="Xem tất cả bảng xếp hạng"
    >
      <span>Xem tất cả</span>
      <ChevronRight
        className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  </div>
));
ChartHeader.displayName = "ChartHeader";

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonGrid = memo(({ count }: { count: number }) => (
  <div
    className="flex flex-col gap-1"
    role="status"
    aria-label="Đang tải bảng xếp hạng"
    aria-busy="true"
  >
    {Array.from({ length: count }, (_, i) => (
      <div
        key={i}
        className="flex items-center gap-3 px-3 py-3 rounded-xl"
        style={{ animationDelay: `${i * 50}ms` }}
        aria-hidden="true"
      >
        <div className="w-[52px] shrink-0 flex flex-col items-center gap-1.5">
          <div className="skeleton w-5 h-3 rounded-full" />
          <div className="skeleton w-6 h-2.5 rounded-full" />
        </div>
        <div className="skeleton skeleton-cover w-11 h-11 sm:w-12 sm:h-12 shrink-0" />
        <div className="flex-1 space-y-2 min-w-0">
          <div
            className="skeleton h-3.5 rounded-full"
            style={{ width: `${40 + (i % 3) * 12}%` }}
          />
          <div
            className="skeleton h-3 rounded-full"
            style={{ width: `${24 + (i % 4) * 8}%` }}
          />
        </div>
        <div className="skeleton w-9 h-3 rounded-full hidden sm:block" />
        <div className="skeleton w-14 h-3 rounded-full hidden md:block" />
      </div>
    ))}
  </div>
));
SkeletonGrid.displayName = "SkeletonGrid";

// ─────────────────────────────────────────────────────────────────────────────
// ERROR / EMPTY STATES
// ─────────────────────────────────────────────────────────────────────────────

const ErrorState = memo(({ onRetry }: { onRetry?: () => void }) => (
  <div
    role="alert"
    className="flex flex-col items-center justify-center gap-3 py-16 px-6 rounded-2xl border text-center"
    style={{
      background: "hsl(var(--error) / 0.05)",
      borderColor: "hsl(var(--error) / 0.18)",
    }}
  >
    <div
      className="flex items-center justify-center size-12 rounded-full"
      style={{
        background: "hsl(var(--error) / 0.1)",
        color: "hsl(var(--error))",
      }}
    >
      <AlertCircle className="size-5" aria-hidden="true" />
    </div>
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">Đã có lỗi xảy ra</p>
      <p className="text-xs text-muted-foreground">
        Không thể tải bảng xếp hạng. Vui lòng thử lại.
      </p>
    </div>
    {onRetry && (
      <button
        onClick={onRetry}
        className="btn-outline btn-sm mt-1 flex items-center gap-1.5"
        aria-label="Thử tải lại bảng xếp hạng"
      >
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
        Thử lại
      </button>
    )}
  </div>
));
ErrorState.displayName = "ErrorState";

const EmptyState = memo(() => (
  <div
    role="status"
    aria-label="Chưa có bài hát nào"
    className="flex flex-col items-center justify-center gap-3 py-16 px-6 rounded-2xl border border-dashed border-border text-center"
  >
    <div className="flex items-center justify-center size-12 rounded-full bg-muted text-muted-foreground">
      <Music2 className="size-5" aria-hidden="true" />
    </div>
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">Chưa có nội dung</p>
      <p className="text-xs text-muted-foreground">
        Bảng xếp hạng đang được cập nhật. Vui lòng quay lại sau.
      </p>
    </div>
  </div>
));
EmptyState.displayName = "EmptyState";

// ─────────────────────────────────────────────────────────────────────────────
// RANK BADGE — FIX B + Score Glow
//
// Nhận thêm prop `trend` từ RankedTrack của Hook 10/10.
// trend === "new" → badge đặc biệt "MỚI" thay vì badge delta.
// trend === "up/down/same" → badge cũ.
//
// FIX #3 (Score Glow): nhận `scoreDelta` — khi score tăng, con số lóe
// sáng 1 lần qua keyframe pulse rồi tắt. Dùng `key` trick để reset animation
// mỗi lần score thay đổi mà không cần state.
// ─────────────────────────────────────────────────────────────────────────────

interface RankBadgeProps {
  rank: number;
  rankDelta: number;
  trend: RankedTrack["trend"];
  score: number; // lượt nghe hiện tại — dùng để glow
}

const ChartRankBadge = memo(
  ({ rank, rankDelta, trend, score }: RankBadgeProps) => {
    // Bài lần đầu lọt Top — badge "MỚI" đặc biệt
    if (trend === "new") {
      return (
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 600,
            damping: 22,
            delay: 0.1,
          }}
          aria-label="Bài hát mới vào bảng xếp hạng"
          className={cn(
            "inline-flex items-center gap-0.5 text-[9px] font-semibold tracking-wide",
            "leading-none px-1.5 py-0.5 rounded-full",
            "text-amber-400 bg-amber-400/10 ring-1 ring-amber-400/20",
          )}
        >
          <Sparkles className="w-2.5 h-2.5" aria-hidden="true" />
          MỚI
        </motion.span>
      );
    }

    // Hạng không đổi
    if (trend === "same") {
      return (
        <span
          aria-label="Hạng không thay đổi"
          className="inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground/40"
        >
          <Minus className="w-2.5 h-2.5" aria-hidden="true" />
        </span>
      );
    }

    // Tăng / giảm hạng
    const isUp = trend === "up";
    return (
      <motion.span
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 600,
          damping: 28,
          delay: 0.12,
        }}
        aria-label={`Hạng ${isUp ? "tăng" : "giảm"} ${Math.abs(rankDelta)}`}
        className={cn(
          "inline-flex items-center gap-0.5 text-[9px] font-semibold font-mono tracking-wide",
          "leading-none px-1 py-0.5 rounded-full",
          isUp
            ? "text-emerald-400 bg-emerald-400/10"
            : "text-rose-400   bg-rose-400/10",
        )}
      >
        {isUp ? (
          <TrendingUp className="w-2.5 h-2.5" aria-hidden="true" />
        ) : (
          <TrendingDown className="w-2.5 h-2.5" aria-hidden="true" />
        )}
        {Math.abs(rankDelta)}
      </motion.span>
    );
  },
);
ChartRankBadge.displayName = "ChartRankBadge";

// ─────────────────────────────────────────────────────────────────────────────
// SCORE GLOW WRAPPER
//
// Bọc bên ngoài ChartItem, dùng `key={score}` trick:
// mỗi khi score thay đổi React tạo element mới → animation chạy lại từ đầu.
// Không cần useEffect/state, không gây re-render component cha.
// ─────────────────────────────────────────────────────────────────────────────

const ScoreGlow = memo(
  ({ score, children }: { score: number; children: React.ReactNode }) => {
    const isFirstRender = useRef(true);

    useEffect(() => {
      isFirstRender.current = false;
    }, []);

    // Bỏ qua lần mount đầu — chỉ glow khi score thực sự tăng qua socket
    if (isFirstRender.current) return <>{children}</>;

    return (
      <motion.div
        // key thay đổi → motion.div được unmount/mount → initial chạy lại
        key={score}
        initial={{ boxShadow: "0 0 0px 0px hsl(var(--brand-glow) / 0)" }}
        animate={{
          boxShadow: [
            "0 0 0px   0px  hsl(var(--brand-glow) / 0)",
            "0 0 14px  4px  hsl(var(--brand-glow) / 0.35)",
            "0 0 6px   2px  hsl(var(--brand-glow) / 0.18)",
            "0 0 0px   0px  hsl(var(--brand-glow) / 0)",
          ],
        }}
        transition={{ duration: 0.9, ease: "easeOut", times: [0, 0.2, 0.6, 1] }}
        className="rounded-xl"
      >
        {children}
      </motion.div>
    );
  },
);
ScoreGlow.displayName = "ScoreGlow";

// ─────────────────────────────────────────────────────────────────────────────
// UPDATING INDICATOR
// ─────────────────────────────────────────────────────────────────────────────

const UpdatingIndicator = memo(({ visible }: { visible: boolean }) => (
  <div
    className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
    aria-live="polite"
    aria-atomic="true"
  >
    <AnimatePresence>
      {visible && (
        <motion.div
          key="updating"
          {...fadeVariants}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full",
            "glass-frosted border border-border/30",
            "text-[11px] font-medium text-muted-foreground",
            "shadow-raised",
          )}
        >
          <Loader2
            className="w-3 h-3 animate-spin text-primary/70"
            aria-hidden="true"
          />
          <span>Đang cập nhật...</span>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
));
UpdatingIndicator.displayName = "UpdatingIndicator";

// ─────────────────────────────────────────────────────────────────────────────
// CHART ROW — memo'd, nhận RankedTrack trực tiếp từ hook
// Không còn tính prevRank ở đây — đã được tính sẵn trong hook
// ─────────────────────────────────────────────────────────────────────────────

const ChartRow = memo(
  ({
    track,
    index,
    reduced,
  }: {
    track: RankedTrack;
    index: number;
    reduced: boolean;
  }) => {
    const variants = useMemo(
      () => makeRowVariants(index, reduced),
      [index, reduced],
    );

    return (
      <motion.div key={track._id} {...variants}>
        {/* FIX #3: Score Glow bọc ngoài ChartItem */}
        <ScoreGlow score={track.score ?? 0}>
          <ChartItem
            track={track}
            rank={track.rank}
            // Truyền badge đã tính sẵn để ChartItem không phải tự tính lại
          />
        </ScoreGlow>
      </motion.div>
    );
  },
);
ChartRow.displayName = "ChartRow";

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

export const TopFeaturedTracks = () => {
  const { tracks, isLoading, isUpdating, error, refetch } = useRealtimeChart();
  // FIX A: optional chaining — tránh crash khi tracks undefined trong re-sync
  const top10 = useMemo(() => tracks?.slice(0, TOP_N) ?? [], [tracks]);

  const reduced = useReducedMotion() ?? false;
  const handleRetry = useCallback(() => refetch?.(), [refetch]);

  // ── Loading ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <>
        <WaveDivider />
        <section
          className="section-block section-block--alt"
          aria-labelledby="top-featured-tracks-heading"
          aria-busy="true"
        >
          <div className="section-container">
            <ChartHeader viewAllHref="/charts" />
            <SkeletonGrid count={TOP_N} />
          </div>
        </section>
      </>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <>
        <WaveDivider />
        <section
          className="section-block section-block--alt"
          aria-labelledby="top-featured-tracks-heading"
        >
          <div className="section-container">
            <ChartHeader viewAllHref="/charts" />
            <AnimatePresence mode="wait">
              <motion.div key="error" {...slideUpVariants}>
                <ErrorState onRetry={handleRetry} />
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      </>
    );
  }

  // ── Populated / Empty ────────────────────────────────────────────────────

  return (
    <>
      <WaveDivider />
      <section
        className="section-block section-block--alt relative overflow-hidden transition-colors duration-300"
        aria-labelledby="top-featured-tracks-heading"
      >
        <SectionAmbient />

        <div className="section-container relative z-[1]">
          <ChartHeader viewAllHref="/chart-top" />

          <div className="relative">
            <UpdatingIndicator visible={isUpdating} />

            <div
              className={cn(
                "flex flex-col gap-0.5 transition-opacity duration-[350ms]",
                isUpdating && "opacity-50 pointer-events-none select-none",
              )}
              aria-busy={isUpdating}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {top10.length === 0 ? (
                  <motion.div key="empty" {...slideUpVariants}>
                    <EmptyState />
                  </motion.div>
                ) : (
                  top10.map((track, index) => (
                    <ChartRow
                      key={track._id}
                      track={track}
                      index={index}
                      reduced={reduced}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default TopFeaturedTracks;
