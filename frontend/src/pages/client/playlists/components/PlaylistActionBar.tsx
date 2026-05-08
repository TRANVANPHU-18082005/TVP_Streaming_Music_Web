import React, { memo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Loader2,
  Shuffle,
  ListMusic,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PlaylistLikeButton } from "@/features/interaction/components/LikeButton";
import type { IPlaylist } from "@/features/playlist/types";

type Palette = {
  hex: string;
  r: (opacity: number) => string;
  heroGradient: string;
  hslChannels: string;
  glowShadow: string;
};

export interface PlaylistActionBarProps {
  playlist: IPlaylist;
  handleMoreOptions: (playlist: IPlaylist) => void;
  palette: Palette;
  isLoadingPlay: boolean;
  isLoadingShuffle: boolean;
  isPlaying: boolean;
  hasTracks: boolean;
  isOwner: boolean;
  density?: "compact" | "full";
  onPlay: () => void;
  onShuffle: () => void;
  onManageTracks: () => void;
}

const SP_SNAPPY = { type: "spring", stiffness: 440, damping: 28 } as const;

const ActionIconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      "size-10 sm:size-11 rounded-full flex items-center justify-center",
      "border border-border/50 bg-background/25 backdrop-blur-sm",
      "text-foreground/70 hover:text-foreground hover:bg-muted/60 hover:border-border",
      "transition-all duration-150 active:scale-90",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
      "disabled:opacity-40 disabled:cursor-not-allowed",
      className,
    )}
    {...props}
  >
    {children}
  </button>
));
ActionIconButton.displayName = "ActionIconButton";

const TooltipAction: React.FC<{
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}> = ({ label, icon, onClick }) => (
  <ActionIconButton onClick={onClick} aria-label={label}>
    {icon}
  </ActionIconButton>
);

export const PlaylistActionBar = memo<PlaylistActionBarProps>(
  ({
    playlist,
    handleMoreOptions,
    palette,
    isLoadingPlay,
    isLoadingShuffle,
    isPlaying,
    hasTracks,
    isOwner,
    density = "full",
    onPlay,
    onShuffle,
    onManageTracks,
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
        handleMoreOptions(playlist);
      },
      [playlist, handleMoreOptions],
    );
    return (
      <div
        className="flex items-center gap-3"
        role="toolbar"
        aria-label="Playlist controls"
      >
        <motion.button
          type="button"
          onClick={onPlay}
          disabled={!canPlay}
          aria-label={isPlaying ? "Pause playlist" : "Play playlist"}
          aria-pressed={isPlaying}
          className={cn(
            playSz,
            "rounded-full flex items-center justify-center shrink-0 shadow-lg",
            "transition-[box-shadow,transform] duration-300",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
          )}
          style={{
            backgroundColor: palette.hex,
            boxShadow: isPlaying
              ? `${palette.glowShadow}, 0 0 0 5px ${palette.r(0.22)}`
              : palette.glowShadow,
          }}
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
          aria-label="Shuffle playlist"
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

        <PlaylistLikeButton id={playlist._id} variant="detail" />

        {isOwner && (
          <>
            <TooltipAction
              label="Add tracks"
              icon={<ListMusic className={ctrlIconSz} aria-hidden="true" />}
              onClick={onManageTracks}
            />
          </>
        )}

        <div className="flex-1" aria-hidden="true" />
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
PlaylistActionBar.displayName = "PlaylistActionBar";

export default PlaylistActionBar;
