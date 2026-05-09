import React, { memo, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Loader2, MoreHorizontal, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { AlbumLikeButton } from "@/features/interaction/components/LikeButton";
import { Palette } from "@/utils/color";
import { IAlbumDetail } from "@/features/album";

const SP_SNAPPY = { type: "spring", stiffness: 440, damping: 28 } as const;

export interface AlbumActionBarProps {
  album: IAlbumDetail;
  handleMoreOptions: (album: IAlbumDetail) => void;
  palette: Palette;
  isLoadingPlay: boolean;
  isLoadingShuffle: boolean;
  isPlaying: boolean;
  hasTracks: boolean;
  density?: "compact" | "full";
  onPlay: (e?: React.MouseEvent) => void;
  onShuffle: () => void;
}

export const AlbumActionBar = memo<AlbumActionBarProps>(
  ({
    album,
    handleMoreOptions,
    palette,
    isLoadingPlay,
    isLoadingShuffle,
    isPlaying,
    hasTracks,
    density = "full",
    onPlay,
    onShuffle,
  }) => {
    const isCompact = density === "compact";
    const playSz = isCompact ? "size-12" : "size-14 sm:size-16";
    const playIconSz = isCompact ? "size-5" : "size-6 sm:size-7";
    const ctrlSz = isCompact ? "size-10" : "size-10 sm:size-11";
    const ctrlIconSz = isCompact ? "size-3.5" : "size-4";
    const canPlay = hasTracks && !isLoadingPlay;
    const canShuffle = hasTracks && !isLoadingShuffle;
    const handleMore = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        handleMoreOptions(album);
      },
      [album, handleMoreOptions],
    );
    const playBtnStyle = useMemo(() => {
      const outline = isPlaying
        ? `${palette.glowShadow}, 0 0 0 5px ${palette.r(0.22)}`
        : palette.glowShadow;
      return {
        backgroundColor: palette.hex,
        boxShadow: outline,
      } as React.CSSProperties;
    }, [palette.hex, palette.glowShadow, isPlaying, palette]);

    return (
      <div
        className="flex items-center gap-3"
        role="toolbar"
        aria-label="Album controls"
      >
        <motion.button
          type="button"
          onClick={onPlay}
          disabled={!canPlay}
          aria-label={isPlaying ? "Pause album" : "Play album"}
          aria-pressed={isPlaying}
          className={cn(
            playSz,
            "rounded-full flex items-center justify-center shrink-0 shadow-lg",
            "transition-[box-shadow,transform] duration-300",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
          )}
          style={playBtnStyle}
          whileHover={canPlay ? { scale: 1.06 } : undefined}
          whileTap={canPlay ? { scale: 0.93 } : undefined}
          transition={SP_SNAPPY}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isLoadingPlay ? (
              <motion.span
                key="load"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Loader2
                  className={cn(playIconSz, "text-white animate-spin")}
                  aria-hidden="true"
                />
              </motion.span>
            ) : isPlaying ? (
              <motion.span
                key="pause"
                initial={{ scale: 0.6, opacity: 0, rotate: -15 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.6, opacity: 0, rotate: 15 }}
                transition={SP_SNAPPY}
              >
                <Pause
                  className={cn(playIconSz, "text-white fill-white")}
                  aria-hidden="true"
                />
              </motion.span>
            ) : (
              <motion.span
                key="play"
                initial={{ scale: 0.6, opacity: 0, rotate: 15 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.6, opacity: 0, rotate: -15 }}
                transition={SP_SNAPPY}
              >
                <Play
                  className={cn(playIconSz, "text-white fill-white ml-0.5")}
                  aria-hidden="true"
                />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        <motion.button
          type="button"
          onClick={onShuffle}
          disabled={!canShuffle}
          aria-label="Shuffle album"
          className={cn(
            ctrlSz,
            "rounded-full flex items-center justify-center border border-border/50",
            "bg-background/30 backdrop-blur-sm text-foreground/70",
            "hover:text-foreground hover:bg-muted/60 hover:border-border",
            "transition-colors duration-150",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
          )}
          whileTap={canShuffle ? { scale: 0.9 } : undefined}
          transition={SP_SNAPPY}
        >
          {isLoadingShuffle ? (
            <Loader2
              className={cn(ctrlIconSz, "animate-spin")}
              aria-hidden="true"
            />
          ) : (
            <Shuffle className={ctrlIconSz} aria-hidden="true" />
          )}
        </motion.button>

        <AlbumLikeButton id={album?._id} variant="detail" />
        <button
          className="rounded-full flex items-center justify-center border border-border/50  size-10  bg-background/30 backdrop-blur-sm text-foreground/70 hover:text-foreground hover:bg-muted/60 hover:border-border active:scale-90 transition-all"
          aria-label="More options"
          onClick={handleMore}
        >
          <MoreHorizontal className="size-6" strokeWidth={2} />
        </button>
      </div>
    );
  },
);

AlbumActionBar.displayName = "AlbumActionBar";

export default AlbumActionBar;
