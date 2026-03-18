import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Loader2 } from "lucide-react";

import { useRealtimeChart } from "@/features/track/hooks/useRealtimeChart";
import { ChartItem } from "@/features/track/components/ChartItem";
import { SectionHeader } from "@/pages/client/home/SectionHeader";
import { ChartTrack } from "@/features/track/types";
import { cn } from "@/lib/utils";

// ─── Component ───────────────────────────────────────────────────────────────
export const TopFeaturedTracks = () => {
  const { tracks, prevRankMap, isLoading, isUpdating } = useRealtimeChart();
  const top10 = tracks.slice(0, 10);

  if (isLoading) {
    return (
      <section className="section-block bg-background">
        <div className="section-container">
          <SkeletonList count={10} />
        </div>
      </section>
    );
  }

  return (
    <section className="section-block bg-background">
      <div className="section-container">
        <div className="section-header-wrap">
          <SectionHeader
            icon={<BarChart3 className="w-4 h-4" />}
            label="Top Charts"
            title="Top Featured Tracks"
            description="Những bài hát được yêu thích nhất hiện nay."
            viewAllHref="/charts"
          />
        </div>

        <div className="relative">
          {/* Updating overlay indicator */}
          <AnimatePresence>
            {isUpdating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-0 right-0 flex items-center gap-1.5 text-xs text-muted-foreground z-10"
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Đang cập nhật…</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Track list */}
          <div
            className={cn(
              "flex flex-col gap-1 transition-opacity duration-400",
              isUpdating && "opacity-60 pointer-events-none select-none",
            )}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {top10.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center py-16 text-muted-foreground text-sm"
                >
                  Chưa có bài hát nào trong bảng xếp hạng.
                </motion.div>
              ) : (
                top10.map((track: ChartTrack, index: number) => {
                  const rank = index + 1;
                  const prevRank = prevRankMap[track._id] ?? rank;

                  return (
                    <ChartItem
                      key={track._id}
                      track={track}
                      rank={rank}
                      prevRank={prevRank}
                    />
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonList({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-1">
      {/* Skeleton header placeholder */}
      <div className="section-header-wrap mb-8 md:mb-12">
        <div className="flex flex-col gap-3">
          <div className="h-4 w-24 rounded-full bg-muted animate-pulse" />
          <div className="h-7 w-56 rounded-lg bg-muted animate-pulse" />
          <div className="h-3.5 w-72 rounded-full bg-muted animate-pulse" />
        </div>
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-3 py-3 rounded-xl"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div className="w-6 h-4 rounded bg-muted animate-pulse shrink-0" />
          <div className="w-10 h-10 rounded-lg bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <div className="h-3.5 w-2/5 rounded-full bg-muted animate-pulse" />
            <div className="h-3 w-1/4 rounded-full bg-muted animate-pulse" />
          </div>
          <div className="h-3 w-10 rounded-full bg-muted animate-pulse hidden sm:block" />
          <div className="h-3 w-8 rounded-full bg-muted animate-pulse hidden md:block" />
        </div>
      ))}
    </div>
  );
}
