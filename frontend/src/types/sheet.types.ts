/**
 * @file context-sheet.types.ts
 * @description Type definitions cho Context Sheet System.
 *
 * Mỗi entity (Album, Playlist, Artist, Genre) có interface riêng
 * + một union discriminant để sheet provider phân loại đúng sheet cần render.
 */

import { IAlbum, IArtist, IGenre, IPlaylist, ITrack } from "@/features";
import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// BASE ENTITY INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// DISCRIMINATED UNION cho Sheet State
// ─────────────────────────────────────────────────────────────────────────────

export type ContextSheetPayload =
  | { type: "album"; entity: IAlbum }
  | { type: "playlist"; entity: IPlaylist }
  | { type: "artist"; entity: IArtist }
  | { type: "genre"; entity: IGenre }
  | { type: "track"; track: ITrack | null }
  | {
      type: "addToPlaylist";
      sourceEntity?: IAlbum | IArtist | IGenre;
      tracks: ITrack[] | null;
    }
  | null;

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface ContextSheetContextValue {
  openAlbumSheet: (entity: IAlbum) => void;
  openPlaylistSheet: (entity: IPlaylist) => void;
  openArtistSheet: (entity: IArtist) => void;
  openGenreSheet: (entity: IGenre) => void;
  openAddToPlaylistSheet: (
    sourceEntity?: IAlbum | IArtist | IGenre,
    tracks?: ITrack[] | null,
  ) => void;
  openTrackSheet: (track?: ITrack | null) => void;
  closeContextSheet: () => void;
}

// ────────────────────────────────────────────────────────────────────────────
// PROVIDER CALLBACK TYPES (explicit prefixed names to avoid prop collisions)
// ────────────────────────────────────────────────────────────────────────────

export interface AlbumCallbacks {
  onAlbumPlay?: (album: IAlbum) => void;
  onAlbumShuffle?: (album: IAlbum) => void;
  onAlbumAddToQueue?: (album: IAlbum) => void;
  onAlbumAddAllToPlaylist?: (album: IAlbum) => void;
  onAlbumGoToArtist?: (artistId: string) => void;
  onAlbumShare?: (album: IAlbum) => void;
  onAlbumDownloadAll?: (album: IAlbum) => void;
}

export interface PlaylistCallbacks {
  onPlaylistPlay?: (playlist: IPlaylist) => void;
  onPlaylistShuffle?: (playlist: IPlaylist) => void;
  onPlaylistAddToQueue?: (playlist: IPlaylist) => void;
  onPlaylistEdit?: (playlist: IPlaylist) => void;
  onPlaylistDelete?: (playlist: IPlaylist) => void;
  onPlaylistToggleVisibility?: (playlist: IPlaylist) => void;
  onPlaylistShare?: (playlist: IPlaylist) => void;
  onPlaylistAddToLibrary?: (playlist: IPlaylist) => void;
}

export interface ArtistCallbacks {
  onArtistAddToQueue?: (artist: IArtist) => void;
  onArtistViewProfile?: (artist: IArtist) => void;
  onArtistShare?: (artist: IArtist) => void;
}

export interface GenreCallbacks {
  onGenreAddToQueue?: (genre: IGenre) => void;

  onGenreShare?: (genre: IGenre) => void;
}

export interface AddToPlaylistCallbacks {
  onAlbumAddToPlaylistSelect?: (album: IAlbum, playlistId: string) => void;
  onArtistAddToPlaylistSelect?: (artist: IArtist, playlistId: string) => void;
  onGenreAddToPlaylistSelect?: (genre: IGenre, playlistId: string) => void;
}

export interface ContextSheetProviderProps
  extends
    AlbumCallbacks,
    PlaylistCallbacks,
    ArtistCallbacks,
    GenreCallbacks,
    AddToPlaylistCallbacks {
  children: ReactNode;
  zIndexBase?: number;
}
