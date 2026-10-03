import { memo, useMemo } from "react";
import { ListMusic, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import PublicAlbumCard from "@/features/album/components/PublicAlbumCard";
import PublicPlaylistCard from "@/features/playlist/components/PublicPlaylistCard";
import { useRecommendedTracks } from "@/features/track/hooks/useTracksQuery";
import type { ITrack } from "@/features/track/types";
import type { IAlbum } from "@/features/album/types";
import type { IPlaylist } from "@/features/playlist/types";
import { useSyncInteractions } from "@/features/interaction";
import { CLIENT_PATHS } from "@/config/paths";
import { HorizontalScroll } from "@/pages/client/home/HorizontalScroll";
import { ForYouTrackCard } from "./ForYouTrackCard";
import { useContinueAlbums, useContinuePlaylists } from "../hooks/useForMeFeed";
import SectionAmbient from "@/components/SectionAmbient";
import { cn } from "@/lib/utils";

const LIMIT = 8;
const EMPTY_TRACKS: ITrack[] = [];
const EMPTY_ALBUMS: IAlbum[] = [];
const EMPTY_PLAYLISTS: IPlaylist[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// MOTION PRESETS
// ─────────────────────────────────────────────────────────────────────────────
const EASE_EXPO = [0.22, 1, 0.36, 1] as const;

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 22, scale: 0.965 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.44, ease: EASE_EXPO },
  },
};

const mobileCardVariants = {
  hidden: { opacity: 0, x: 16 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.065, duration: 0.38, ease: EASE_EXPO },
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────────────────────
const ContinueHeader = memo(({ viewAllHref }: { viewAllHref: string }) => (
  <div className="flex items-start justify-between gap-4 mb-7 sm:mb-8">
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div
          className="flex items-center justify-center size-6 rounded-md"
          style={{
            background: "hsl(var(--wave-3) / 0.12)",
            color: "hsl(var(--wave-3))",
          }}
        >
          <ListMusic className="size-3.5" />
        </div>
        <span className="text-overline" style={{ color: "hsl(var(--wave-3))" }}>
          Tiếp tục nghe
        </span>
      </div>

      <h2
        className="text-section-title text-foreground leading-tight"
        id="continue-shelf-heading"
      >
        Nghe tiếp
      </h2>

      <p className="text-section-subtitle hidden sm:block">
        Gợi ý dựa trên hoạt động nghe gần đây của bạn.
      </p>
    </div>

    <Link
      to={viewAllHref}
      className={cn(
        "group flex items-center gap-1.5 shrink-0 mt-1",
        "text-sm font-medium text-wave-3 opacity-70",
        "hover:text-wave-3 transition-colors duration-200 hover:opacity-100",
      )}
      style={{ "--tw-text-opacity": 1 } as React.CSSProperties}
    >
      <span>Mở Dành cho tôi</span>
      <ChevronRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  </div>
));
ContinueHeader.displayName = "ContinueHeader";

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON GRID
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonGrid = memo(({ count }: { count: number }) => (
  <>
    <div className="flex gap-4 overflow-hidden lg:hidden">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="w-[168px] sm:w-[200px] shrink-0 space-y-2.5">
          <div className="skeleton skeleton-cover" style={{ borderRadius: "1rem" }} />
          <div className="skeleton skeleton-text w-3/4" />
          <div className="skeleton skeleton-text w-1/2" />
        </div>
      ))}
    </div>
    <div className="hidden lg:grid grid-cols-3 xl:grid-cols-6 gap-5 xl:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2.5">
          <div className="skeleton skeleton-cover" style={{ borderRadius: "1rem" }} />
          <div className="skeleton skeleton-text w-3/4" />
          <div className="skeleton skeleton-text w-1/2" />
        </div>
      ))}
    </div>
  </>
));
SkeletonGrid.displayName = "SkeletonGrid";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function ContinueShelf() {
  const tracksQuery = useRecommendedTracks(LIMIT);
  const albumsQuery = useContinueAlbums(LIMIT);
  const playlistsQuery = useContinuePlaylists(LIMIT);

  const tracks = tracksQuery.data ?? EMPTY_TRACKS;
  const albums = albumsQuery.data ?? EMPTY_ALBUMS;
  const playlists = playlistsQuery.data ?? EMPTY_PLAYLISTS;

  const trackIds = useMemo(() => tracks.map((track) => track._id), [tracks]);
  const albumIds = useMemo(() => albums.map((album) => album._id), [albums]);
  const playlistIds = useMemo(() => playlists.map((playlist) => playlist._id), [playlists]);

  useSyncInteractions(trackIds, "like", "track", trackIds.length > 0);
  useSyncInteractions(albumIds, "like", "album", albumIds.length > 0);
  useSyncInteractions(playlistIds, "like", "playlist", playlistIds.length > 0);

  const isLoading = tracksQuery.isLoading || albumsQuery.isLoading || playlistsQuery.isLoading;
  const isError = tracksQuery.isError && albumsQuery.isError && playlistsQuery.isError;
  const hasItems = tracks.length > 0 || albums.length > 0 || playlists.length > 0;

  if (!isLoading && !hasItems && !isError) return null;

  const renderContent = () => {
    if (isLoading && !hasItems) {
      return <SkeletonGrid count={6} />;
    }

    if (isError) {
      return (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>Không tải được gợi ý nghe tiếp.</span>
          <button
            type="button"
            className="font-semibold text-foreground underline"
            onClick={() => {
              void tracksQuery.refetch();
              void albumsQuery.refetch();
              void playlistsQuery.refetch();
            }}
          >
            Thử lại
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-10">
        {tracks.length > 0 && (
          <div className="relative">
            <h3 className="mb-4 text-sm font-semibold text-muted-foreground tracking-wide uppercase">Bài hát</h3>
            <div className="lg:hidden scroll-overflow-mask -mx-4 px-4">
              <HorizontalScroll>
                {tracks.map((track, i) => (
                  <motion.div
                    key={track._id}
                    custom={i}
                    variants={mobileCardVariants}
                    initial="hidden"
                    animate="visible"
                    className={cn("snap-start shrink-0", "w-[168px] sm:w-[200px]", "first:pl-0 last:pr-4")}
                  >
                    <ForYouTrackCard track={track} index={i} tracks={tracks} reason={track.reason} />
                  </motion.div>
                ))}
              </HorizontalScroll>
            </div>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-48px" }}
              className="hidden lg:grid grid-cols-3 xl:grid-cols-6 gap-5 xl:gap-6"
            >
              {tracks.map((track, i) => (
                <motion.div key={track._id} variants={cardVariants}>
                  <ForYouTrackCard track={track} index={i} tracks={tracks} reason={track.reason} />
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}

        {albums.length > 0 && (
          <div className="relative">
            <h3 className="mb-4 text-sm font-semibold text-muted-foreground tracking-wide uppercase">Album</h3>
            <div className="lg:hidden scroll-overflow-mask -mx-4 px-4">
              <HorizontalScroll>
                {albums.map((album, i) => (
                  <motion.div
                    key={album._id}
                    custom={i}
                    variants={mobileCardVariants}
                    initial="hidden"
                    animate="visible"
                    className={cn("snap-start shrink-0", "w-[168px] sm:w-[200px]", "first:pl-0 last:pr-4")}
                  >
                    <PublicAlbumCard album={album} />
                  </motion.div>
                ))}
              </HorizontalScroll>
            </div>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-48px" }}
              className="hidden lg:grid grid-cols-3 xl:grid-cols-6 gap-5 xl:gap-6"
            >
              {albums.map((album) => (
                <motion.div key={album._id} variants={cardVariants}>
                  <PublicAlbumCard album={album} />
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}

        {playlists.length > 0 && (
          <div className="relative">
            <h3 className="mb-4 text-sm font-semibold text-muted-foreground tracking-wide uppercase">Playlist</h3>
            <div className="lg:hidden scroll-overflow-mask -mx-4 px-4">
              <HorizontalScroll>
                {playlists.map((playlist, i) => (
                  <motion.div
                    key={playlist._id}
                    custom={i}
                    variants={mobileCardVariants}
                    initial="hidden"
                    animate="visible"
                    className={cn("snap-start shrink-0", "w-[168px] sm:w-[200px]", "first:pl-0 last:pr-4")}
                  >
                    <PublicPlaylistCard playlist={playlist} />
                  </motion.div>
                ))}
              </HorizontalScroll>
            </div>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-48px" }}
              className="hidden lg:grid grid-cols-3 xl:grid-cols-6 gap-5 xl:gap-6"
            >
              {playlists.map((playlist) => (
                <motion.div key={playlist._id} variants={cardVariants}>
                  <PublicPlaylistCard playlist={playlist} />
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div
        className="lg:block h-px"
        style={{
          background: `linear-gradient(
              to right,
              transparent,
              hsl(var(--wave-3) / 0.3) 30%,
              hsl(var(--wave-3) / 0.28) 70%,
              transparent
            )`,
          boxShadow: "0 0 8px hsl(var(--wave-3) / 0.1)",
        }}
      />
      <section
        className="section-block section-block--alt"
        aria-labelledby="continue-shelf-heading"
      >
        <SectionAmbient style="wave-3" />
        <div className="section-container">
          <ContinueHeader viewAllHref={`/${CLIENT_PATHS.FOR_ME}`} />
          {renderContent()}
        </div>
      </section>
    </>
  );
}

export default ContinueShelf;
