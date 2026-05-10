import React, { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Loader2,
  MoreHorizontal,
  ArrowUpRight,
} from "lucide-react";

import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { formatDuration, toCDN } from "@/utils/track-helper";
import { TrackLikeButton } from "@/features/interaction/components/LikeButton";
import { cn } from "@/lib/utils";
import PlayCell from "@/features/track/components/PlayCell";
import LazyImage from "@/features/track/components/LazyImage";

import ArtistDisplay from "@/features/artist/components/ArtistDisplay";
import { Link, useNavigate } from "react-router-dom";
import { useContextSheet } from "@/app/provider/SheetProvider";
import {
  SearchAlbum,
  SearchArtist,
  SearchGenre,
  SearchPlaylist,
  TopResultItem,
} from "@/features/search";
import { ITrack } from "@/features/track";

// Types

const SPRING_MEDIUM = { type: "spring", stiffness: 300, damping: 28 } as const;

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { ...SPRING_MEDIUM, delay: i * 0.045 },
  }),
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

const SectionHeader = ({
  title,
  showMore,
  onMore,
}: {
  title: string;
  showMore?: boolean;
  onMore?: () => void;
}) => (
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-[11px] font-black uppercase tracking-[0.2em] dark:text-white/45 text-gray-500">
      {title}
    </h2>
    {showMore && (
      <motion.button
        onClick={onMore}
        whileHover={{ x: 2 }}
        transition={SPRING_MEDIUM}
        className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.12em] dark:text-white/40 text-gray-500 hover:text-primary transition-colors"
      >
        Xem tất cả <ArrowUpRight className="size-3.5" />
      </motion.button>
    )}
  </div>
);

interface SearchArtistCardProps {
  artist: SearchArtist;
  onClick: (e: React.MouseEvent) => void;
}
const SearchArtistCard = React.memo(
  ({ artist, onClick }: SearchArtistCardProps) => (
    <motion.div
      onClick={onClick}
      variants={fadeUp}
      whileHover={{ y: -4 }}
      transition={SPRING_MEDIUM}
      className="group relative flex flex-col gap-3 p-4 rounded-xl cursor-pointer dark:hover:bg-white/[0.04] hover:bg-black/[0.03] transition-colors"
    >
      <div className="relative aspect-square rounded-full overflow-hidden shadow-md dark:bg-white/5 bg-black/5">
        <ImageWithFallback
          src={toCDN(artist.avatar)}
          alt={artist.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-col items-center text-center">
        <h3
          className="text-[14px] font-bold truncate w-full dark:text-white/90 text-gray-900 group-hover:text-primary transition-colors"
          dangerouslySetInnerHTML={{
            __html: artist.highlightHtml || artist.name,
          }}
        />
        <p className="text-[12px] dark:text-white/40 text-gray-500 mt-0.5">
          Nghệ sĩ
        </p>
      </div>
    </motion.div>
  ),
);

interface SearchAlbumCardProps {
  album: SearchAlbum;
  onClick: (e: React.MouseEvent) => void;
}
const SearchAlbumCard = React.memo(
  ({ album, onClick }: SearchAlbumCardProps) => (
    <motion.div
      onClick={onClick}
      variants={fadeUp}
      whileHover={{ y: -4 }}
      transition={SPRING_MEDIUM}
      className="group relative flex flex-col gap-3 p-4 rounded-xl cursor-pointer dark:hover:bg-white/[0.04] hover:bg-black/[0.03] transition-colors"
    >
      <div className="relative aspect-square rounded-xl overflow-hidden shadow-md dark:bg-white/5 bg-black/5">
        <ImageWithFallback
          src={toCDN(album.coverImage)}
          alt={album.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-col">
        <h3
          className="text-[14px] font-bold truncate w-full dark:text-white/90 text-gray-900 group-hover:text-primary transition-colors"
          dangerouslySetInnerHTML={{
            __html: album.highlightHtml || album.title,
          }}
        />
        <p className="text-[12px] dark:text-white/40 text-gray-500 mt-0.5 truncate">
          {album.artist?.name || "Đĩa nhạc"}
        </p>
      </div>
    </motion.div>
  ),
);
interface SearchPlaylistCardProps {
  playlist: SearchPlaylist;
  onClick: (e: React.MouseEvent) => void;
}
const SearchPlaylistCard = React.memo(
  ({ playlist, onClick }: SearchPlaylistCardProps) => (
    <motion.div
      onClick={onClick}
      variants={fadeUp}
      whileHover={{ y: -4 }}
      transition={SPRING_MEDIUM}
      className="group relative flex flex-col gap-3 p-4 rounded-xl cursor-pointer dark:hover:bg-white/[0.04] hover:bg-black/[0.03] transition-colors"
    >
      <div className="relative aspect-square rounded-xl overflow-hidden shadow-md dark:bg-white/5 bg-black/5">
        <ImageWithFallback
          src={toCDN(playlist.coverImage)}
          alt={playlist.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-col">
        <h3
          className="text-[14px] font-bold truncate w-full dark:text-white/90 text-gray-900 group-hover:text-primary transition-colors"
          dangerouslySetInnerHTML={{
            __html: playlist.highlightHtml || playlist.title,
          }}
        />
        <p className="text-[12px] dark:text-white/40 text-gray-500 mt-0.5 truncate">
          Danh sách phát
        </p>
      </div>
    </motion.div>
  ),
);
interface SearchGenreCardProps {
  genre: SearchGenre;
  onClick: (e: React.MouseEvent) => void;
}
const SearchGenreCard = React.memo(
  ({ genre, onClick }: SearchGenreCardProps) => (
    <motion.div
      onClick={onClick}
      variants={fadeUp}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={SPRING_MEDIUM}
      className="group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-shadow"
      style={{ backgroundColor: genre.color || "#6366f1" }}
    >
      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
      <h3
        className="absolute top-4 left-4 text-white text-lg font-black tracking-tight"
        dangerouslySetInnerHTML={{ __html: genre.highlightHtml || genre.name }}
      />
      <ImageWithFallback
        src={toCDN(genre.image)}
        alt={genre.name}
        className="absolute -bottom-2 -right-4 w-24 h-24 object-cover rounded shadow-xl rotate-[25deg] transition-transform duration-500 group-hover:rotate-[20deg] group-hover:scale-110"
      />
    </motion.div>
  ),
);
interface TrackRowProps {
  track: ITrack;
  index: number;
  isCurrentPlaying: boolean;
  isActive: boolean;
  isLoadingThis: boolean;
  onPlay: (e?: React.MouseEvent) => void;
  onMore: (e: React.MouseEvent) => void;
  highlightHtml?: string;
}
const TrackRow = React.memo(
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
          src={toCDN(track.coverImage) || track.coverImage}
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
            className="text-[11px] flex gap-1 items-center text-(--fp-fg-muted) mt-1 text-2xl truncate max-w-[200px]"
          />
        </div>
        <TrackLikeButton id={track._id} />
        {track.album?.slug ? (
          <Link to={`/albums/${track.album?.slug}`}>
            <p className="hidden md:block text-[12px] dark:text-white/30 text-gray-400 truncate max-w-[140px] shrink-0 px-4">
              {track.album?.title || "Single"}
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

interface TopResultCardProps {
  item: TopResultItem;
  isCurrentPlaying: boolean;
  isLoadingThis: boolean;

  onPlay: (e: React.MouseEvent, track: ITrack) => void;
}
const TopResultCard = React.memo(
  ({ item, isCurrentPlaying, isLoadingThis, onPlay }: TopResultCardProps) => {
    const type = item.type;
    const navigate = useNavigate();
    const onNavigate = () => {
      if (type === "album") {
        navigate(`/albums/${item.slug}`);
      }
      if (type === "artist") {
        navigate(`/artists/${item.slug}`);
      }
      if (type === "playlist") {
        navigate(`/playlists/${item.slug}`);
      }
      if (type === "track") {
        navigate(`/tracks/${item.slug}`);
      }
      if (type === "genre") {
        navigate(`/genres/${item.slug}`);
      }
      if (type === "playlist") {
        navigate(`/playlists/${item._id}`);
      }
    };
    return (
      <motion.div
        variants={fadeUp}
        custom={0}
        className="h-full flex flex-col gap-3.5"
      >
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] dark:text-white/45 text-gray-500">
          Kết quả hàng đầu
        </h2>
        <motion.div
          onClick={onNavigate}
          whileHover={{ scale: 1.012 }}
          transition={SPRING_MEDIUM}
          className={cn(
            "group relative flex-1 flex flex-col justify-end p-6 rounded-2xl overflow-hidden cursor-pointer",
            "dark:bg-white/[0.04] bg-black/[0.03]",
            "border dark:border-white/[0.06] border-black/[0.06]",
            "dark:hover:border-primary/30 hover:border-primary/25",
            "transition-colors duration-300 min-h-[220px]",
            "shadow-sm hover:shadow-lg",
          )}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-gradient-to-br from-primary/10 via-transparent to-transparent" />

          <div
            className={cn(
              "absolute top-6 left-6 shadow-xl transition-transform duration-500 group-hover:scale-[1.04]",
              type === "artist" || type === "genre"
                ? "size-24 rounded-full border-2 dark:border-white/10 border-black/10"
                : "size-24 rounded-xl",
              "overflow-hidden",
            )}
          >
            <ImageWithFallback
              src={
                type === "artist"
                  ? item.avatar
                  : type === "genre"
                    ? item.image
                    : item.coverImage
              }
              alt={
                type === "artist"
                  ? item.name
                  : type === "genre"
                    ? item.name
                    : item.title
              }
              className="w-full h-full object-cover"
            />
          </div>

          <div className="relative z-10 mt-28 flex flex-col gap-2">
            <h3
              className="text-2xl font-black tracking-tight dark:text-white text-gray-900 line-clamp-2 group-hover:text-primary transition-colors"
              dangerouslySetInnerHTML={{
                __html:
                  item.highlightHtml ||
                  (type !== "artist" && type !== "genre"
                    ? item.title
                    : item.name),
              }}
            />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-full dark:bg-white/8 bg-black/6 dark:text-white/55 text-gray-600">
                {type === "artist"
                  ? "Nghệ sĩ"
                  : type === "album"
                    ? "Album"
                    : type === "playlist"
                      ? "Playlist"
                      : type === "genre"
                        ? "Thể loại"
                        : "Bài hát"}
              </span>
              {type !== "artist" &&
                type !== "genre" &&
                type !== "playlist" &&
                item.artist?.name && (
                  <span className="text-sm dark:text-white/45 text-gray-500 truncate">
                    {item.artist.name}
                  </span>
                )}
            </div>
          </div>

          {type === "track" && (
            <motion.button
              onClick={(e: React.MouseEvent) => onPlay(e, item as ITrack)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              transition={SPRING_MEDIUM}
              disabled={isLoadingThis}
              className={cn(
                "absolute bottom-5 right-5 z-10",
                "flex items-center justify-center size-13 rounded-full",
                "bg-primary text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)]",
                "group-hover:opacity-100 translate-y-2 group-hover:translate-y-0",
                "transition-all duration-250",
                isCurrentPlaying && "opacity-100 translate-y-0",
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                {isLoadingThis ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : isCurrentPlaying ? (
                  <Pause className="size-5 fill-current" />
                ) : (
                  <Play className="size-5 fill-current ml-0.5" />
                )}
              </AnimatePresence>
            </motion.button>
          )}
        </motion.div>
      </motion.div>
    );
  },
);

export default function SearchResults({
  searchResult,
  activeTab,
  tabDir,
  isGlobalPlaying,
  currentTrackId,
  loadingId,
  handlePlayTrack,
  handleResultClick,
  switchTab,
}: any) {
  const { openTrackSheet } = useContextSheet();

  const handleMoreOptions = useCallback(
    (t: ITrack) => openTrackSheet(t),
    [openTrackSheet],
  );

  const tracks = searchResult?.tracks ?? [];
  const artists = searchResult?.artists ?? [];
  const playlists = searchResult?.playlists ?? [];
  const albums = searchResult?.albums ?? [];
  const genres = searchResult?.genres ?? [];
  const topResult = searchResult?.topResult;
  return (
    <motion.div
      key={`results-${activeTab}`}
      custom={tabDir}
      initial={{ opacity: 0, x: tabDir * 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: tabDir * -20 }}
      transition={SPRING_MEDIUM}
      className="space-y-10 mt-2"
    >
      {(activeTab === "all" || activeTab === "track") && (
        <div
          className={cn(
            "grid gap-6 lg:gap-8",
            activeTab === "all" && topResult
              ? "grid-cols-1 lg:grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr]"
              : "grid-cols-1",
          )}
        >
          {activeTab === "all" && topResult && (
            <TopResultCard
              item={topResult}
              isCurrentPlaying={
                isGlobalPlaying && currentTrackId === topResult._id
              }
              isLoadingThis={loadingId === topResult._id}
              onPlay={handlePlayTrack}
            />
          )}

          {tracks.length > 0 && (
            <div className="flex flex-col gap-1">
              <SectionHeader
                title="Bài hát"
                showMore={activeTab === "all" && tracks.length > 4}
                onMore={() => switchTab("track")}
              />
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className={cn(
                  "flex flex-col",
                  activeTab === "track" && "md:grid md:grid-cols-2 md:gap-x-4",
                )}
              >
                {(activeTab === "all" ? tracks.slice(0, 5) : tracks).map(
                  (track: ITrack, i: number) => (
                    <TrackRow
                      key={track._id}
                      track={track}
                      index={i}
                      isCurrentPlaying={
                        isGlobalPlaying && currentTrackId === track._id
                      }
                      isActive={currentTrackId === track._id}
                      isLoadingThis={loadingId === track._id}
                      highlightHtml={track.highlightHtml}
                      onPlay={(e?: React.MouseEvent) =>
                        handlePlayTrack(e, track)
                      }
                      onMore={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        handleMoreOptions(track);
                      }}
                    />
                  ),
                )}
              </motion.div>
            </div>
          )}
        </div>
      )}

      {(activeTab === "all" || activeTab === "artist") &&
        artists.length > 0 && (
          <div>
            <SectionHeader
              title="Nghệ sĩ"
              showMore={activeTab === "all" && artists.length > 6}
              onMore={() => switchTab("artist")}
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {(activeTab === "all" ? artists.slice(0, 6) : artists).map(
                (artist: SearchArtist) => (
                  <SearchArtistCard
                    key={artist._id}
                    artist={artist}
                    onClick={() => handleResultClick(`/artists/${artist.slug}`)}
                  />
                ),
              )}
            </div>
          </div>
        )}

      {(activeTab === "all" || activeTab === "album") && albums.length > 0 && (
        <div>
          <SectionHeader
            title="Đĩa nhạc"
            showMore={activeTab === "all" && albums.length > 5}
            onMore={() => switchTab("album")}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
            {(activeTab === "all" ? albums.slice(0, 5) : albums).map(
              (album: SearchAlbum) => (
                <SearchAlbumCard
                  key={album._id}
                  album={album}
                  onClick={() => handleResultClick(`/albums/${album.slug}`)}
                />
              ),
            )}
          </div>
        </div>
      )}

      {(activeTab === "all" || activeTab === "playlist") &&
        playlists.length > 0 && (
          <div>
            <SectionHeader
              title="Danh sách phát"
              showMore={activeTab === "all" && playlists.length > 5}
              onMore={() => switchTab("playlist")}
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
              {(activeTab === "all" ? playlists.slice(0, 5) : playlists).map(
                (pl: SearchPlaylist) => (
                  <SearchPlaylistCard
                    key={pl._id}
                    playlist={pl}
                    onClick={() => handleResultClick(`/playlists/${pl._id}`)}
                  />
                ),
              )}
            </div>
          </div>
        )}

      {(activeTab === "all" || activeTab === "genre") && genres.length > 0 && (
        <div>
          <SectionHeader
            title="Thể loại"
            showMore={activeTab === "all" && genres.length > 5}
            onMore={() => switchTab("genre")}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
            {(activeTab === "all" ? genres.slice(0, 5) : genres).map(
              (genre: SearchGenre) => (
                <SearchGenreCard
                  key={genre._id}
                  genre={genre}
                  onClick={() => handleResultClick(`/genres/${genre.slug}`)}
                />
              ),
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
