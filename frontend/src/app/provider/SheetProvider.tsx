import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  AlbumSheet,
  PlaylistSheet,
  ArtistSheet,
  GenreSheet,
  OptionSheet,
  AddToPlaylistSheet,
} from "@/app/context/SheetContext";

import {
  ContextSheetContextValue,
  ContextSheetPayload,
  ContextSheetProviderProps,
} from "@/types/sheet.types";
import { IAlbum, IArtist, IGenre, IPlaylist, ITrack } from "@/features";

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

const ContextSheetContext = createContext<ContextSheetContextValue>({
  openAlbumSheet: () => {},
  openPlaylistSheet: () => {},
  openArtistSheet: () => {},
  openGenreSheet: () => {},
  openAddToPlaylistSheet: () => {},
  openOptionSheet: () => {},
  closeContextSheet: () => {},
});

export function useContextSheet() {
  return useContext(ContextSheetContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export function ContextSheetProvider({
  children,
  zIndexBase = 90,
  // Album callbacks
  onAlbumAddToQueue,
  onAlbumAddAllToPlaylist,
  onAlbumGoToArtist,
  onAlbumShare,
  onAlbumDownloadAll,
  // Playlist callbacks
  onPlaylistPlay,
  onPlaylistShuffle,
  onPlaylistAddToQueue,
  onPlaylistEdit,
  onPlaylistDelete,
  onPlaylistToggleVisibility,
  onPlaylistShare,
  onPlaylistAddToLibrary,
  // Artist callbacks

  onArtistViewProfile,

  onArtistShare,

  onArtistAddToQueue,
  // Genre callbacks

  onGenreAddToQueue,

  onGenreShare,
}: ContextSheetProviderProps) {
  // use zIndexBase to avoid unused var lint; sheets themselves use their own zIndex values
  void zIndexBase;
  const [active, setActive] = useState<ContextSheetPayload>(null);
  // Keep entity alive during exit animation (220ms)
  const [frozen, setFrozen] = useState<ContextSheetPayload>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const closeContextSheet = useCallback(() => {
    setActive(null);
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setFrozen(null), 400);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => () => clearTimeout(closeTimerRef.current), []);

  const openAlbumSheet = useCallback((entity: IAlbum) => {
    setFrozen({ type: "album", entity });
    setActive({ type: "album", entity });
  }, []);

  const openAddToPlaylistSheet = useCallback(
    (sourceEntity?: IAlbum | IArtist | IGenre, tracks?: ITrack[] | null) => {
      setFrozen({
        type: "addToPlaylist",
        sourceEntity,
        tracks: tracks ?? null,
      });
      setActive({
        type: "addToPlaylist",
        sourceEntity,
        tracks: tracks ?? null,
      });
    },
    [],
  );

  const openPlaylistSheet = useCallback((entity: IPlaylist) => {
    setFrozen({ type: "playlist", entity });
    setActive({ type: "playlist", entity });
  }, []);

  const openOptionSheet = useCallback((track?: ITrack | null) => {
    setFrozen({ type: "options", track: track ?? null } as ContextSheetPayload);
    setActive({ type: "options", track: track ?? null } as ContextSheetPayload);
  }, []);

  const openArtistSheet = useCallback((entity: IArtist) => {
    setFrozen({ type: "artist", entity });
    setActive({ type: "artist", entity });
  }, []);

  const openGenreSheet = useCallback((entity: IGenre) => {
    setFrozen({ type: "genre", entity });
    setActive({ type: "genre", entity });
  }, []);

  // Resolve mỗi entity từ frozen (giữ data sống trong animation exit)
  const display = active ?? frozen;

  // Capture concrete entities so delayed callbacks don't read a null `active` later
  const albumEntity = display?.type === "album" ? display.entity : undefined;
  const playlistEntity =
    display?.type === "playlist" ? display.entity : undefined;
  const artistEntity = display?.type === "artist" ? display.entity : undefined;
  const genreEntity = display?.type === "genre" ? display.entity : undefined;
  const addToPlaylistEntity =
    display?.type === "addToPlaylist" ? display : undefined;
  const optionEntity =
    display?.type === "options"
      ? (display as { type: "options"; track: ITrack | null })
      : undefined;

  return (
    <ContextSheetContext.Provider
      value={{
        openAlbumSheet,
        openPlaylistSheet,
        openArtistSheet,
        openGenreSheet,
        openOptionSheet,
        openAddToPlaylistSheet,
        closeContextSheet,
      }}
    >
      {children}

      {/* ── Sheets rendered once, outside tree ── */}
      <AlbumSheet
        album={albumEntity}
        isOpen={active?.type === "album"}
        onClose={closeContextSheet}
        onOpenAddToPlaylistSheet={
          albumEntity
            ? (tracks) => openAddToPlaylistSheet(albumEntity, tracks)
            : undefined
        }
        onAddToQueue={onAlbumAddToQueue}
        onAddAllToPlaylist={onAlbumAddAllToPlaylist}
        onGoToArtist={onAlbumGoToArtist}
        onShare={onAlbumShare}
        onDownloadAll={onAlbumDownloadAll}
      />

      <PlaylistSheet
        playlist={playlistEntity}
        isOpen={active?.type === "playlist"}
        onClose={closeContextSheet}
        onPlay={onPlaylistPlay}
        onShuffle={onPlaylistShuffle}
        onAddToQueue={onPlaylistAddToQueue}
        onEdit={onPlaylistEdit}
        onDelete={onPlaylistDelete}
        onToggleVisibility={onPlaylistToggleVisibility}
        onShare={onPlaylistShare}
        onAddToLibrary={onPlaylistAddToLibrary}
      />

      <ArtistSheet
        artist={artistEntity}
        isOpen={active?.type === "artist"}
        onClose={closeContextSheet}
        onOpenAddToPlaylistSheet={
          artistEntity
            ? (tracks) => openAddToPlaylistSheet(artistEntity, tracks)
            : undefined
        }
        onAddToQueue={onArtistAddToQueue}
        onViewProfile={onArtistViewProfile}
        onShare={onArtistShare}
      />

      <GenreSheet
        genre={genreEntity}
        isOpen={active?.type === "genre"}
        onClose={closeContextSheet}
        onOpenAddToPlaylistSheet={
          genreEntity
            ? (tracks) => openAddToPlaylistSheet(genreEntity, tracks)
            : undefined
        }
        onAddToQueue={onGenreAddToQueue}
        onShare={onGenreShare}
      />

      {/* Option Sheet (global) */}
      {optionEntity && (
        <OptionSheet
          track={optionEntity.track ?? null}
          isOpen={active?.type === "options"}
          onClose={closeContextSheet}
          onAddToPlaylist={(t: ITrack) => {
            // Close option sheet, then open AddToPlaylistSheet after exit animation
            closeContextSheet();
            setTimeout(() => openAddToPlaylistSheet(undefined, [t]), 220);
          }}
        />
      )}

      {/* Add to Playlist Sheet */}
      {addToPlaylistEntity && (
        <AddToPlaylistSheet
          tracks={addToPlaylistEntity.tracks ?? null}
          isOpen={active?.type === "addToPlaylist"}
          onClose={closeContextSheet}
        />
      )}
    </ContextSheetContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USAGE HOOK — convenience shortcuts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shorthand hook để chỉ lấy openSheet functions, không cần destructure thủ công.
 *
 * @example
 *   const { openAlbum, openPlaylist } = useOpenContextSheet();
 *   <AlbumCard onLongPress={() => openAlbum(album)} />
 */
export function useOpenContextSheet() {
  const {
    openAlbumSheet,
    openPlaylistSheet,
    openArtistSheet,
    openGenreSheet,
    openAddToPlaylistSheet,
    openOptionSheet,
    closeContextSheet,
  } = useContextSheet();
  return {
    openAlbum: openAlbumSheet,
    openPlaylist: openPlaylistSheet,
    openArtist: openArtistSheet,
    openOption: openOptionSheet,
    openAddToPlaylist: openAddToPlaylistSheet,
    openGenre: openGenreSheet,
    closeSheet: closeContextSheet,
  };
}
