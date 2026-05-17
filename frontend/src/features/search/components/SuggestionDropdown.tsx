import React, { memo } from "react";
import { motion } from "framer-motion";
import { SearchIcon, Loader2, Mic2, Music2, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SPRING_FAST, SuggestItem } from "@/features/search";
import { highlightMatch } from "../utils";

function typeIcon(type: string) {
  if (type === "artist") return <Mic2 className="size-3 shrink-0" />;
  return <Music2 className="size-3 shrink-0" />;
}

function typeLabel(type: string) {
  return type === "artist" ? "Nghệ sĩ" : "Bài hát";
}

interface Props {
  suggestions: SuggestItem[];
  isLoading: boolean;
  query: string;
  onSelect: (item: { label: string; slug: string; type: string }) => void;
  activeIndex: number;
}

const SuggestionDropdown = memo(
  ({ suggestions, isLoading, query, onSelect, activeIndex }: Props) => (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={SPRING_FAST}
      className={cn(
        "absolute top-[calc(100%+6px)] left-0 right-0 z-[60]",
        "rounded-xl overflow-hidden",
        "dark:bg-[#141414] bg-white",
        "border dark:border-white/[0.08] border-black/[0.08]",
        "shadow-2xl dark:shadow-black/50",
      )}
    >
      {isLoading ? (
        <div className="flex items-center gap-2 px-4 py-3 dark:text-white/35 text-gray-400">
          <Loader2 className="size-3.5 animate-spin" />
          <span className="text-[13px]">Đang tìm...</span>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="px-4 py-3 text-[13px] dark:text-white/35 text-gray-400">
          Không có gợi ý
        </div>
      ) : (
        <ul className="py-1.5">
          {suggestions.map((item, i) => (
            <li key={item.id}>
              <motion.button
                onClick={() => onSelect(item)}
                whileTap={{ scale: 0.99 }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                  activeIndex === i
                    ? "dark:bg-white/[0.07] bg-black/[0.04]"
                    : "dark:hover:bg-white/[0.04] hover:bg-black/[0.03]",
                )}
              >
                <SearchIcon className="size-3.5 dark:text-white/25 text-gray-400 shrink-0" />
                <span className="flex-1 text-[13.5px] dark:text-white/80 text-gray-800 truncate">
                  {highlightMatch(item.label, query)}
                </span>
                <span
                  className={cn(
                    "flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0",
                    item.type === "artist"
                      ? "dark:bg-primary/15 bg-primary/10 dark:text-primary/80 text-primary"
                      : "dark:bg-white/6 bg-black/5 dark:text-white/40 text-gray-500",
                  )}
                >
                  {typeIcon(item.type)}
                  {typeLabel(item.type)}
                </span>
                <ArrowUpRight className="size-3 dark:text-white/20 text-gray-300 shrink-0" />
              </motion.button>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  ),
);

SuggestionDropdown.displayName = "SuggestionDropdown";
export default SuggestionDropdown;
