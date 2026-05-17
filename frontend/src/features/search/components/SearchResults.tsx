import React, { useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useContextSheet } from "@/app/provider/SheetProvider";
import {
  SearchAlbum,
  SearchArtist,
  SearchGenre,
  SearchPlaylist,
  SearchTab,
  SPRING_MEDIUM,
  staggerContainer,
} from "@/features/search";
import { ITrack } from "@/features/track";

import {
  SectionHeader,
  SearchArtistCard,
  SearchAlbumCard,
  SearchPlaylistCard,
  SearchGenreCard,
} from "./SearchCards";

import TopResultCard from "./TopResultCard";
import SearchTrackRow from "./SearchTrackRow";

interface Props {
  searchResult: any;
  activeTab: SearchTab;
  tabDir: number;
  isGlobalPlaying: boolean;
  currentTrackId: string | null;
  loadingId: string | null;
  handlePlayTrack: (e: React.MouseEvent, track: ITrack) => void;
  handleResultClick: (url: string) => void;
  switchTab: (tab: SearchTab) => void;
}

function SearchResults({
  searchResult,
  activeTab,
  tabDir,
  isGlobalPlaying,
  currentTrackId,
  loadingId,
  handlePlayTrack,
  handleResultClick,
  switchTab,
}: Props) {
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
      {/* ── TRACKS + TOP RESULT ─────────────────────────────────────────── */}
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
                    <SearchTrackRow
                      key={track._id}
                      track={track}
                      index={i}
                      isCurrentPlaying={
                        isGlobalPlaying && currentTrackId === track._id
                      }
                      isActive={currentTrackId === track._id}
                      isLoadingThis={loadingId === track._id}
                      highlightHtml={track.highlightHtml}
                      onPlay={(e) => handlePlayTrack(e!, track)}
                      onMore={(e) => {
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

      {/* ── ARTISTS ─────────────────────────────────────────────────────── */}
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

      {/* ── ALBUMS ──────────────────────────────────────────────────────── */}
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

      {/* ── PLAYLISTS ───────────────────────────────────────────────────── */}
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

      {/* ── GENRES ──────────────────────────────────────────────────────── */}
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
export default SearchResults;
