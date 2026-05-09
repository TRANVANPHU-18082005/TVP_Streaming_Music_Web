"use client";

import { memo, useMemo, useCallback } from "react";
import { TrendingUp, Play, Pause, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { IGenre } from "../types";
import { useGenrePlayback } from "@/features/player/hooks/useGenrePlayback";
import {
  PremiumMusicVisualizer,
  WaveformBars,
} from "@/components/MusicVisualizer";

interface GenreCardProps {
  genre: IGenre;
  className?: string;
  size?: "md" | "lg";
}

export const GenreCard = memo<GenreCardProps>(
  function GenreCard({ genre, className, size = "md" }) {
    const {
      togglePlayGenre,
      isThisGenreActive,
      isThisGenrePlaying,
      isFetching,
    } = useGenrePlayback(genre);

    // ── Style động theo màu/gradient của genre ──
    const moodColorStyle = useMemo(() => {
      const style: React.CSSProperties & { "--local-shadow-color"?: string } = {
        "--local-shadow-color": genre.color || "var(--primary)",
        ...(genre.gradient
          ? { background: genre.gradient }
          : { backgroundColor: genre.color || "hsl(var(--muted))" }),
      };
      return style;
    }, [genre.color, genre.gradient]);

    // ── Stop propagation khi click nút play (giống AlbumCard dùng stopProp) ──
    const handleQuickPlay = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        togglePlayGenre();
      },
      [togglePlayGenre],
    );

    return (
      // Dùng <article> + onClick như AlbumCard thay vì <Link> bọc ngoài
      // → tách biệt rõ "click card = navigate" vs "click play = play"
      // → tránh nested interactive element (a > button) vi phạm a11y
      <article
        className={cn(
          "group cursor-pointer flex flex-col gap-3 relative",
          "genre-card !overflow-visible p-2 rounded-2xl transition-all duration-300",
          "hover:bg-muted/10",
          isThisGenreActive && "bg-primary/5 shadow-brand-soft",
          className,
        )}
      >
        {/* ── ARTWORK CONTAINER — giữ aspect-square đồng bộ AlbumCard ── */}
        <Link
          to={`/genres/${genre.slug}`}
          className={cn(
            "genre-card block aspect-square relative isolate overflow-hidden rounded-xl transition-all duration-500",
            isThisGenreActive
              ? "ring-2 ring-primary shadow-glow-md"
              : "ring-1 ring-border/50",
          )}
          style={moodColorStyle}
        >
          {/* Background image hoặc solid color từ genre.color */}
          <ImageWithFallback
            src={genre.image}
            alt={genre.name}
            className={cn(
              "img-cover transition-transform duration-1000",
              "group-hover:scale-110",
              // Làm mờ khi đang phát — giống AlbumCard
              isThisGenrePlaying && "blur-[2px] opacity-70 scale-105",
            )}
          />

          {/* ── Premium Visualizer — chỉ hiện khi ACTIVE (kể cả pause) ── */}
          <AnimatePresence>
            {isThisGenreActive && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 h-full flex items-center justify-center z-20 pointer-events-none bg-black/20 backdrop-blur-[2px]"
              >
                <PremiumMusicVisualizer
                  active={isThisGenrePlaying}
                  size={size === "lg" ? "md" : "sm"}
                  barCount={size === "lg" ? 24 : 16}
                  className="drop-shadow-brand-glow"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Gradient overlay để text dễ đọc */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

          {/* ── Trending Badge — top-left (Like Button chiếm top-right) ── */}
          {genre.isTrending && (
            <div className="absolute top-2.5 left-2.5 z-20">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-bold text-white border border-white/20">
                <TrendingUp className="size-3 text-rose-400" />
                HOT
              </span>
            </div>
          )}

          {/* ── Play Button — giống hệt AlbumCard ── */}
          <div
            className={cn(
              "absolute right-3 bottom-3 z-20 transition-all duration-300 ease-out",
              isThisGenreActive || isFetching
                ? "translate-y-0 opacity-100 scale-100"
                : "translate-y-3 opacity-0 scale-90 group-hover:translate-y-0 group-hover:opacity-100 group-hover:scale-100",
            )}
          >
            <button
              type="button"
              onClick={handleQuickPlay}
              disabled={isFetching}
              className={cn(
                "control-btn control-btn--primary size-12 sm:size-14 shadow-glow-sm",
                isThisGenreActive && "bg-primary text-white",
              )}
            >
              <AnimatePresence mode="wait">
                {isFetching ? (
                  <motion.div
                    key="loader"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Loader2 className="size-5 animate-spin" />
                  </motion.div>
                ) : isThisGenrePlaying ? (
                  <motion.div
                    key="pause"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                  >
                    <Pause className="size-5 fill-current" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="play"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                  >
                    <Play className="size-5 ml-0.5 fill-current" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>

          {/* Active Glow Ring khi đang tải */}
          {isFetching && (
            <div className="absolute inset-0 rounded-xl ring-2 ring-primary animate-glow-pulse pointer-events-none" />
          )}
        </Link>

        {/* ── INFO SECTION — đồng bộ AlbumCard ── */}
        <div className="px-1 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <h3
              className={cn(
                "text-track-title truncate transition-colors duration-200 flex-1",
                isThisGenreActive
                  ? "text-primary"
                  : "text-foreground group-hover:text-primary",
              )}
            >
              {genre.name}
            </h3>

            {/* Sóng nhạc mini cạnh tiêu đề — chỉ hiện khi Active, giống AlbumCard */}
            {isThisGenreActive && (
              <WaveformBars
                active={isThisGenrePlaying}
                bars={3}
                color="primary"
              />
            )}
          </div>

          {/* Sub-info: track count thay cho artist + releaseYear */}
          <div className="flex items-center gap-2 text-track-meta truncate">
            {genre.description ? (
              <span className="truncate">{genre.description}</span>
            ) : (
              <span className="text-duration">
                {genre.trackCount?.toLocaleString()} bài hát
              </span>
            )}
          </div>
        </div>
      </article>
    );
  },
  // Memo comparator — đồng bộ AlbumCard
  (p, n) =>
    p.genre._id === n.genre._id &&
    p.genre.image === n.genre.image &&
    p.genre.name === n.genre.name &&
    p.size === n.size,
);

export default GenreCard;
