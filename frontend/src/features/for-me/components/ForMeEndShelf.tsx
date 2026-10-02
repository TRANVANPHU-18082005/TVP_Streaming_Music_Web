import PublicAlbumCard from "@/features/album/components/PublicAlbumCard";
import PublicPlaylistCard from "@/features/playlist/components/PublicPlaylistCard";
import type { IAlbum } from "@/features/album/types";
import type { IPlaylist } from "@/features/playlist/types";
import { useContinueAlbums, useContinuePlaylists } from "../hooks/useForMeFeed";

const EMPTY_ALBUMS: IAlbum[] = [];
const EMPTY_PLAYLISTS: IPlaylist[] = [];

export function ForMeEndShelf() {
  const albumsQuery = useContinueAlbums(6);
  const playlistsQuery = useContinuePlaylists(6);
  const albums = albumsQuery.data ?? EMPTY_ALBUMS;
  const playlists = playlistsQuery.data ?? EMPTY_PLAYLISTS;
  const isLoading = albumsQuery.isLoading || playlistsQuery.isLoading;
  const isError = albumsQuery.isError && playlistsQuery.isError;

  return (
    <section className="border-t border-white/10 px-3 py-3" aria-label="Nghe tiếp">
      <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-white/60">
        Nghe tiếp
      </p>
      {isLoading ? (
        <p className="px-1 text-sm text-white/50">Đang tìm album và playlist...</p>
      ) : null}
      {isError ? (
        <button
          type="button"
          className="px-1 text-sm text-white underline"
          onClick={() => {
            void albumsQuery.refetch();
            void playlistsQuery.refetch();
          }}
        >
          Không tải được. Thử lại
        </button>
      ) : null}
      {!isLoading && !isError && albums.length === 0 && playlists.length === 0 ? (
        <p className="px-1 text-sm text-white/50">Chưa có album hay playlist để nghe tiếp.</p>
      ) : null}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {albums.map((album) => (
          <div key={album._id} className="w-36 shrink-0">
            <PublicAlbumCard album={album} />
          </div>
        ))}
        {playlists.map((playlist) => (
          <div key={playlist._id} className="w-36 shrink-0">
            <PublicPlaylistCard playlist={playlist} />
          </div>
        ))}
      </div>
    </section>
  );
}
