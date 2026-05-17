import React, { memo } from "react";
import { motion } from "framer-motion";
import { Clock, Flame, History, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SPRING_FAST, SPRING_MEDIUM } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────

const TrendingTagSkeleton = () => (
  <div className="flex flex-wrap gap-2">
    {Array.from({ length: 8 }).map((_, i) => (
      <div
        key={i}
        className="h-9 rounded-full dark:bg-white/[0.05] bg-black/[0.04] animate-pulse"
        style={{ width: `${70 + (i % 3) * 30}px` }}
      />
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  recentSearches: string[];
  trendingSearches: string[];
  trendingData: string[] | null | undefined;
  isTrendingLoading: boolean;
  onTagClick: (term: string) => void;
  onRemoveHistory: (e: React.MouseEvent, term: string) => void;
  onClearAllHistory: () => void;
}

const SearchHomeState = memo(
  ({
    recentSearches,
    trendingSearches,
    trendingData,
    isTrendingLoading,
    onTagClick,
    onRemoveHistory,
    onClearAllHistory,
  }: Props) => (
    <motion.div
      key="home"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={SPRING_MEDIUM}
      className="max-w-2xl space-y-10 mt-2"
    >
      {/* Recent searches */}
      {recentSearches.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 dark:text-white/55 text-gray-600">
              <Clock className="size-4 text-primary" />
              <span className="text-[11px] font-black uppercase tracking-[0.2em]">
                Lịch sử
              </span>
            </div>
            <button
              onClick={onClearAllHistory}
              className="text-[11px] font-bold dark:text-white/28 text-gray-400 hover:text-destructive transition-colors"
            >
              Xóa tất cả
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {recentSearches.map((term, i) => (
              <motion.div
                key={term}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...SPRING_FAST, delay: i * 0.03 }}
                className={cn(
                  "group flex items-center gap-1.5 px-3.5 py-1.5 rounded-full cursor-pointer",
                  "dark:bg-white/[0.06] bg-white border dark:border-white/[0.08] border-black/[0.08]",
                  "dark:hover:border-primary/30 hover:border-primary/25 transition-all duration-200",
                  "text-[13px] dark:text-white/70 text-gray-700 font-medium",
                )}
                onClick={() => onTagClick(term)}
              >
                <History className="size-3 dark:text-white/30 text-gray-400 shrink-0" />
                <span>{term}</span>
                <button
                  onClick={(e) => onRemoveHistory(e, term)}
                  className="opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 dark:hover:text-white hover:text-gray-900"
                >
                  <X className="size-3" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Trending */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 dark:text-white/55 text-gray-600">
          <Flame className="size-4 text-primary" />
          <span className="text-[11px] font-black uppercase tracking-[0.2em]">
            Đang thịnh hành
          </span>
          {trendingData?.length && !isTrendingLoading && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/15 text-primary"
            >
              Live
            </motion.span>
          )}
        </div>

        {isTrendingLoading ? (
          <TrendingTagSkeleton />
        ) : (
          <div className="flex flex-wrap gap-2">
            {trendingSearches.map((term, i) => (
              <motion.button
                key={term}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING_MEDIUM, delay: i * 0.04 }}
                whileHover={{ scale: 1.04, y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onTagClick(term)}
                className={cn(
                  "group flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold",
                  "dark:bg-white/[0.06] bg-white border dark:border-white/[0.08] border-black/[0.08]",
                  "dark:text-white/65 text-gray-700",
                  "dark:hover:border-primary/35 hover:border-primary/30",
                  "dark:hover:text-white hover:text-primary",
                  "transition-colors duration-200 shadow-sm",
                )}
              >
                <TrendingUp className="size-3 group-hover:opacity-100 transition-opacity text-primary" />
                {term}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  ),
);

SearchHomeState.displayName = "SearchHomeState";
export default SearchHomeState;
