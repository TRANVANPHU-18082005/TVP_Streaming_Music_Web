import React from "react";
import { motion } from "framer-motion";
import { MoreHorizontal } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/utils/track-helper";
import PlayCell from "@/features/track/components/PlayCell";
import LazyImage from "@/features/track/components/LazyImage";
import ArtistDisplay from "@/features/artist/components/ArtistDisplay";
import { ITrack } from "@/features/track";
import { fadeUp, SPRING_MEDIUM } from "../types";

export interface TrackRowProps {
  track: ITrack;
  index: number;
  isCurrentPlaying: boolean;
  isActive: boolean;
  isLoadingThis: boolean;
  onPlay: (e?: React.MouseEvent) => void;
  onMore: (e: React.MouseEvent) => void;
  highlightHtml?: string;
}

const SearchTrackRow = React.memo(
  ({
    track,
    index,
    isCurrentPlaying,
    isActive,
    isLoadingThis,
    onPlay,
    onMore,
    highlightHtml,
  }: TrackRowProps) => {
    const navigate = useNavigate();

    return (
      <motion.div
        custom={index}
        variants={fadeUp}
        className={cn(
          "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer",
          "transition-colors duration-150",
          isActive
            ? "bg-[hsl(var(--primary)/0.07)] hover:bg-[hsl(var(--primary)/0.1)]"
            : "",
          isCurrentPlaying
            ? "dark:bg-primary/10 bg-primary/8 shadow-sm"
            : "dark:hover:bg-white/[0.05] hover:bg-black/[0.04]",
        )}
      >
        {isCurrentPlaying && (
          <motion.div
            layoutId="search-track-accent"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 bg-primary rounded-r-full"
            transition={SPRING_MEDIUM}
          />
        )}

        <div className="w-6 shrink-0 flex justify-center items-center">
          <PlayCell
            index={index}
            isActive={isActive}
            isPlaying={isCurrentPlaying}
            onPlay={onPlay}
          />
        </div>

        <LazyImage
          src={track.coverImage}
          alt={track.title}
          isActive={isActive}
          isCurrentPlaying={isCurrentPlaying}
          isLoading={isLoadingThis}
          onClick={onPlay}
        />

        <div className="flex-1 min-w-0">
          <p
            onClick={() => navigate(`/tracks/${track._id}`)}
            className={cn(
              "text-[13.5px] font-bold truncate leading-tight transition-colors",
              isActive
                ? "text-primary"
                : "dark:text-white/90 text-gray-900 group-hover:text-primary",
            )}
            dangerouslySetInnerHTML={{ __html: highlightHtml || track.title }}
          />
          <ArtistDisplay
            mainArtist={track.artist}
            featuringArtists={track.featuringArtists}
            className="text-[11px] flex gap-1 items-center text-(--fp-fg-muted) mt-1 truncate max-w-[200px]"
          />
        </div>

        {track.album?.slug ? (
          <Link to={`/albums/${track.album.slug}`}>
            <p className="hidden md:block text-[12px] dark:text-white/30 text-gray-400 truncate max-w-[140px] shrink-0 px-4">
              {track.album.title || "Single"}
            </p>
          </Link>
        ) : (
          <p className="hidden md:block text-[12px] dark:text-white/30 text-gray-400 truncate max-w-[140px] shrink-0 px-4">
            Single
          </p>
        )}

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:block text-[11px] font-mono dark:text-white/30 text-gray-400 tabular-nums">
            {formatDuration(track.duration ?? 0)}
          </span>
          <button
            onClick={onMore}
            className="opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full dark:hover:bg-white/10 hover:bg-black/5 text-gray-400 hover:text-primary"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </div>
      </motion.div>
    );
  },
);

SearchTrackRow.displayName = "SearchTrackRow";
export default SearchTrackRow;
