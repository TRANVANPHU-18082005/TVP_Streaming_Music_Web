/**
 * @file context-sheet.types.ts
 * @description Type definitions cho Context Sheet System.
 *
 * Mỗi entity (Album, Playlist, Artist, Genre) có interface riêng
 * + một union discriminant để sheet provider phân loại đúng sheet cần render.
 */

import { IAlbumDetail } from "@/features/album";
import { IArtistDetail } from "@/features/artist";
import { IGenreDetail } from "@/features/genre";
import { IPlaylistDetail } from "@/features/playlist";
import { ITrack } from "@/features/track";
import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// BASE ENTITY INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// DISCRIMINATED UNION cho Sheet State
// ─────────────────────────────────────────────────────────────────────────────

export type ContextSheetPayload =
  | { type: "album"; entity: IAlbumDetail }
  | { type: "playlist"; entity: IPlaylistDetail }
  | { type: "artist"; entity: IArtistDetail }
  | { type: "genre"; entity: IGenreDetail }
  | { type: "track"; track: ITrack | null }
  | { type: "sleepTimer" }
  | {
      type: "addToPlaylist";
      sourceEntity?: IAlbumDetail | IArtistDetail | IGenreDetail;
      tracks: ITrack[] | null;
    }
  | null;

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface ContextSheetContextValue {
  openAlbumSheet: (entity: IAlbumDetail) => void;
  openPlaylistSheet: (entity: IPlaylistDetail) => void;
  openArtistSheet: (entity: IArtistDetail) => void;
  openGenreSheet: (entity: IGenreDetail) => void;
  openAddToPlaylistSheet: (
    sourceEntity?: IAlbumDetail | IArtistDetail | IGenreDetail,
    tracks?: ITrack[] | null,
  ) => void;
  openTrackSheet: (track?: ITrack | null) => void;
  // Open the global Sleep Timer sheet
  openSleepTimerSheet: () => void;
  closeContextSheet: () => void;
}

// ────────────────────────────────────────────────────────────────────────────
// PROVIDER CALLBACK TYPES (explicit prefixed names to avoid prop collisions)
// ────────────────────────────────────────────────────────────────────────────

export interface AlbumCallbacks {
  onAlbumPlay?: (album: IAlbumDetail) => void;
  onAlbumShuffle?: (album: IAlbumDetail) => void;
  onAlbumAddToQueue?: (album: IAlbumDetail) => void;
  onAlbumAddAllToPlaylist?: (album: IAlbumDetail) => void;
  onAlbumGoToArtist?: (artistId: string) => void;
  onAlbumShare?: (album: IAlbumDetail) => void;
  onAlbumDownloadAll?: (album: IAlbumDetail) => void;
}

export interface PlaylistCallbacks {
  onPlaylistPlay?: (playlist: IPlaylistDetail) => void;
  onPlaylistShuffle?: (playlist: IPlaylistDetail) => void;
  onPlaylistAddToQueue?: (playlist: IPlaylistDetail) => void;
  onPlaylistEdit?: (playlist: IPlaylistDetail) => void;
  onPlaylistDelete?: (playlist: IPlaylistDetail) => void;
  onPlaylistToggleVisibility?: (playlist: IPlaylistDetail) => void;
  onPlaylistShare?: (playlist: IPlaylistDetail) => void;
  onPlaylistAddToLibrary?: (playlist: IPlaylistDetail) => void;
}

export interface ArtistCallbacks {
  onArtistAddToQueue?: (artist: IArtistDetail) => void;
  onArtistViewProfile?: (artist: IArtistDetail) => void;
  onArtistShare?: (artist: IArtistDetail) => void;
}

export interface GenreCallbacks {
  onGenreAddToQueue?: (genre: IGenreDetail) => void;

  onGenreShare?: (genre: IGenreDetail) => void;
}

export interface AddToPlaylistCallbacks {
  onAlbumAddToPlaylistSelect?: (
    album: IAlbumDetail,
    playlistId: string,
  ) => void;
  onArtistAddToPlaylistSelect?: (
    artist: IArtistDetail,
    playlistId: string,
  ) => void;
  onGenreAddToPlaylistSelect?: (
    genre: IGenreDetail,
    playlistId: string,
  ) => void;
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
