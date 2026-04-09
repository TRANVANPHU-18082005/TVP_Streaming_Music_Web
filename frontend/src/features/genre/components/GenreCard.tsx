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

    // FIX: Tạo moodColor đồng bộ với hệ thống shadow-brand-dynamic
    // Nếu genre có màu dạng #hex, ta nên convert hoặc dùng trực tiếp nếu CSS hỗ trợ
    const moodColorStyle = useMemo(() => {
      return {
        "--local-shadow-color": genre.color || "var(--primary)",
        ...(genre.gradient
          ? { background: genre.gradient }
          : { backgroundColor: genre.color || "hsl(var(--muted))" }),
      } as React.CSSProperties;
    }, [genre.color, genre.gradient]);

    const handleQuickPlay = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        togglePlayGenre();
      },
      [togglePlayGenre],
    );

    return (
      <Link
        to={`/genres/${genre.slug}`}
        className={cn(
          "group relative flex flex-col overflow-hidden transition-all duration-500",
          size === "lg" ? "aspect-[16/9]" : "aspect-[4/3] sm:aspect-square",
          "rounded-[18px] sm:rounded-2xl shadow-brand-dynamic", // Thêm shadow xịn của Phú
          "[will-change:transform] transform-gpu",
          isThisGenreActive
            ? "ring-2 ring-white/30 scale-[0.98]"
            : "hover:-translate-y-1.5",
          className,
        )}
        style={moodColorStyle}
      >
        {/* ── 1. BACKGROUND IMAGE ── */}
        <div className="absolute inset-0 z-0">
          {genre.image ? (
            <ImageWithFallback
              src={genre.image}
              alt=""
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-all duration-1000",
                "group-hover:scale-110",
                isThisGenrePlaying
                  ? "blur-[2px] opacity-70 scale-105"
                  : "opacity-60 group-hover:opacity-80",
              )}
            />
          ) : (
            <div className="absolute inset-0 bg-black/20" />
          )}
        </div>

        {/* ── 2. NEURAL VISUALIZER (Center-Center like Album Card) ── */}
        <AnimatePresence>
          {isThisGenreActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none bg-black/20 backdrop-blur-[2px]"
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

        {/* Gradient Overlay để text dễ đọc */}
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent z-10" />

        {/* ── 3. QUICK PLAY BUTTON (Floating like Album Card) ── */}
        <div
          className={cn(
            "absolute right-3 bottom-3 z-30 transition-all duration-300 ease-out",
            isThisGenreActive || isFetching
              ? "translate-y-0 opacity-100 scale-100"
              : "translate-y-3 opacity-0 scale-90 group-hover:translate-y-0 group-hover:opacity-100 group-hover:scale-100",
          )}
        >
          <button
            onClick={handleQuickPlay}
            disabled={isFetching}
            className={cn(
              "control-btn control-btn--primary size-12 shadow-glow-sm",
              isThisGenreActive && "bg-white text-black", // Làm nổi bật nút khi active
            )}
          >
            {isFetching ? (
              <Loader2 className="size-5 animate-spin" />
            ) : isThisGenrePlaying ? (
              <Pause className="size-5 fill-current" />
            ) : (
              <Play className="size-5 fill-current ml-0.5" />
            )}
          </button>
        </div>

        {/* ── 4. CONTENT ── */}
        <div className="relative z-20 flex h-full flex-col justify-between p-4">
          {/* Top Row: Trending & Mini Waveform */}
          <div className="flex justify-between items-start">
            {genre.isTrending ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-bold text-white border border-white/20">
                <TrendingUp className="size-3 text-rose-400" /> HOT
              </span>
            ) : (
              <div />
            )}

            {isThisGenreActive && (
              <WaveformBars active={isThisGenrePlaying} bars={3} />
            )}
          </div>

          {/* Bottom Row: Title & Desc */}
          <div className="flex flex-col gap-0.5 pr-12">
            {" "}
            {/* pr-12 để né nút Play */}
            <h3
              className={cn(
                "text-lg sm:text-xl font-black text-white drop-shadow-lg truncate leading-tight",
                isThisGenrePlaying && "blur-[2px] opacity-70 scale-105",
              )}
            >
              {genre.name}
            </h3>
            <p
              className={cn(
                "text-[11px] text-white/70 line-clamp-1 transition-all duration-500",
                "lg:max-h-0 lg:opacity-0 lg:group-hover:max-h-8 lg:group-hover:opacity-100",
                isThisGenreActive && "lg:max-h-8 lg:opacity-100",
                isThisGenrePlaying && "blur-[2px] opacity-70 scale-105",
              )}
            >
              {genre.description ||
                `${genre.trackCount?.toLocaleString()} bài hát`}
            </p>
          </div>
        </div>
      </Link>
    );
  },
  (p, n) =>
    p.genre._id === n.genre._id &&
    p.genre.image === n.genre.image &&
    p.genre.name === n.genre.name &&
    p.size === n.size,
);

export default GenreCard;
