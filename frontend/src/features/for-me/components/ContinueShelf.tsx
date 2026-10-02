import { useMemo } from "react";
import { ListMusic } from "lucide-react";
import { Link } from "react-router-dom";

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

const LIMIT = 8;
const EMPTY_TRACKS: ITrack[] = [];
const EMPTY_ALBUMS: IAlbum[] = [];
const EMPTY_PLAYLISTS: IPlaylist[] = [];

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

  return (
    <section className="section-container" aria-labelledby="continue-shelf-heading">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-brand">
            <ListMusic className="size-4" aria-hidden="true" />
            <span className="text-overline">Dành cho tôi</span>
          </div>
          <h2 id="continue-shelf-heading" className="text-section-title text-foreground">
            Nghe tiếp
          </h2>
        </div>
        <Link to={`/${CLIENT_PATHS.FOR_ME}`} className="text-sm font-medium text-brand hover:underline">
          Mở Dành cho tôi
        </Link>
      </div>

      {isLoading && !hasItems ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="skeleton aspect-square rounded-2xl" />
          ))}
        </div>
      ) : null}

      {isError ? (
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
      ) : null}

      {tracks.length > 0 ? (
        <>
          <div className="hidden gap-5 lg:grid lg:grid-cols-4 xl:grid-cols-6">
            {tracks.map((track, index) => (
              <ForYouTrackCard
                key={track._id}
                track={track}
                index={index}
                tracks={tracks}
                reason={track.reason}
              />
            ))}
          </div>
          <HorizontalScroll>
            {tracks.map((track, index) => (
              <div key={track._id} className="w-[168px] shrink-0 snap-start sm:w-[200px]">
                <ForYouTrackCard
                  track={track}
                  index={index}
                  tracks={tracks}
                  reason={track.reason}
                />
              </div>
            ))}
          </HorizontalScroll>
        </>
      ) : null}

      {albums.length > 0 ? (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Album</h3>
          <div className="hidden gap-5 lg:grid lg:grid-cols-4 xl:grid-cols-6">
            {albums.map((album) => (
              <PublicAlbumCard key={album._id} album={album} />
            ))}
          </div>
          <HorizontalScroll>
            {albums.map((album) => (
              <div key={album._id} className="w-[168px] shrink-0 snap-start sm:w-[200px]">
                <PublicAlbumCard album={album} />
              </div>
            ))}
          </HorizontalScroll>
        </div>
      ) : null}

      {playlists.length > 0 ? (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Playlist</h3>
          <div className="hidden gap-5 lg:grid lg:grid-cols-4 xl:grid-cols-6">
            {playlists.map((playlist) => (
              <PublicPlaylistCard key={playlist._id} playlist={playlist} />
            ))}
          </div>
          <HorizontalScroll>
            {playlists.map((playlist) => (
              <div key={playlist._id} className="w-[168px] shrink-0 snap-start sm:w-[200px]">
                <PublicPlaylistCard playlist={playlist} />
              </div>
            ))}
          </HorizontalScroll>
        </div>
      ) : null}
    </section>
  );
}

export default ContinueShelf;
