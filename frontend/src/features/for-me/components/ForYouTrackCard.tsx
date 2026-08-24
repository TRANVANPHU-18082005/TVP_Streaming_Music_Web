"use client";

import { memo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { Play, Pause } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { ITrack } from "@/features/track/types";
import { setQueue, togglePlayPause, selectPlayer } from "@/features/player/slice/playerSlice";
import { CLIENT_PATHS } from "@/config/paths";
import { TrackLikeButton } from "@/features/interaction/components/LikeButton";
import { WaveformBars } from "@/components/MusicVisualizer";

interface ForYouTrackCardProps {
  track: ITrack;
  index: number;
  tracks: ITrack[];
  className?: string;
  reason?: string;
}

export const ForYouTrackCard = memo<ForYouTrackCardProps>(function ForYouTrackCard({
  track,
  index,
  tracks,
  className,
  reason,
}) {
  const dispatch = useDispatch();
  const player = useSelector(selectPlayer);

  const isThisTrackActive = player.currentTrackId === track._id;
  const isThisTrackPlaying = isThisTrackActive && player.isPlaying;

  const handlePlayClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (isThisTrackActive) {
        dispatch(togglePlayPause());
      } else {
        dispatch(
          setQueue({
            trackIds: tracks.map((t) => t._id),
            initialMetadata: tracks,
            startIndex: index,
            source: { id: CLIENT_PATHS.FOR_ME, type: "suggestions", title: "Dành cho bạn" },
          }),
        );
      }
    },
    [dispatch, isThisTrackActive, tracks, index],
  );

  return (
    <article
      className={cn(
        "group cursor-pointer flex flex-col gap-3 relative",
        "album-card !overflow-visible p-2 rounded-2xl transition-all duration-300",
        "hover:bg-muted/10",
        isThisTrackActive && "bg-primary/5 shadow-brand-soft",
        className,
      )}
    >
      {reason && (
        <div className="absolute -top-3 left-2 z-30 bg-primary/90 backdrop-blur text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full shadow-lg pointer-events-none truncate max-w-[90%]">
          {reason}
        </div>
      )}

      <div
        className={cn(
          "album-card aspect-square relative isolate overflow-hidden rounded-xl transition-all duration-500",
          isThisTrackActive
            ? "ring-2 ring-primary shadow-glow-md"
            : "ring-1 ring-border/50",
        )}
      >
        <ImageWithFallback
          src={track.coverImage}
          alt={track.title}
          className={cn(
            "img-cover transition-transform duration-1000",
            "group-hover:scale-110",
            isThisTrackPlaying && "blur-[1px] opacity-80 scale-105",
          )}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

        <div className="absolute top-2.5 right-2.5 z-20 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <TrackLikeButton id={track._id} />
        </div>

        <div
          className={cn(
            "absolute right-3 bottom-3 z-20 transition-all duration-300 ease-out",
            isThisTrackActive
              ? "translate-y-0 opacity-100 scale-100"
              : "translate-y-3 opacity-0 scale-90 group-hover:translate-y-0 group-hover:opacity-100 group-hover:scale-100",
          )}
        >
          <button
            type="button"
            onClick={handlePlayClick}
            className={cn(
              "control-btn control-btn--primary size-12 sm:size-14 shadow-glow-sm",
              isThisTrackActive && "bg-primary text-white",
            )}
          >
            <AnimatePresence mode="wait">
              {isThisTrackPlaying ? (
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
      </div>

      <div className="px-1 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h3
            className={cn(
              "text-track-title truncate transition-colors duration-200 flex-1",
              isThisTrackActive
                ? "text-primary"
                : "text-foreground group-hover:text-primary",
            )}
          >
            {track.title}
          </h3>

          {isThisTrackActive && (
            <WaveformBars active={isThisTrackPlaying} bars={3} />
          )}
        </div>
        <div className="flex items-center gap-2 text-track-meta truncate">
          <Link
            to={`/artists/${typeof track.artist === "object" ? track.artist?.slug || track.artist?._id : track.artist}`}
            onClick={(e) => e.stopPropagation()}
            className="hover:text-primary hover:underline transition-colors"
          >
            {typeof track.artist === "object" && track.artist?.name ? track.artist.name : ""}
          </Link>
        </div>
      </div>
    </article>
  );
});
