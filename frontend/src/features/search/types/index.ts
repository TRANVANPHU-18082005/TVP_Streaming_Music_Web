import { IAlbum } from "@/features/album";
import { IArtist } from "@/features/artist";
import { IGenre } from "@/features/genre";
import { IPlaylist } from "@/features/playlist";
import { ITrack } from "@/features/track";

// --- Base Entities ---
export interface SearchArtist extends IArtist {
  highlightHtml?: string; // Mới thêm từ backend v4
}

export interface SearchTrack extends ITrack {
  highlightHtml?: string; // Mới thêm từ backend v4
}

export interface SearchAlbum extends IAlbum {
  highlightHtml?: string; // Mới thêm từ backend v4
}
export interface SearchGenre extends IGenre {
  highlightHtml?: string; // Mới thêm từ backend v4
}

export interface SearchPlaylist extends IPlaylist {
  highlightHtml?: string; // Mới thêm từ backend v4
}

// --- Suggestion Types (Endpoint /suggest) ---
export interface SuggestItem {
  id: string;
  label: string; // Title hoặc Name
  slug: string;
  type: "track" | "artist" | "album" | "genre";
}

// --- Top Result Union Type ---
export type TopResultItem =
  | ({ type: "artist" } & SearchArtist)
  | ({ type: "track" } & SearchTrack)
  | ({ type: "album" } & SearchAlbum)
  | ({ type: "playlist" } & SearchPlaylist)
  | ({ type: "genre" } & SearchGenre);

// --- Main Data Structure ---
export interface SearchData {
  topResult: TopResultItem | null;
  tracks: SearchTrack[];
  artists: SearchArtist[];
  albums: SearchAlbum[];
  playlists: SearchPlaylist[];
  genres: SearchGenre[];
}

// --- API Generic Response ---
export interface BaseSearchResponse<T> {
  status: "success" | "error";
  data: T;
  message?: string;
}

// --- Specific API Responses ---
export type SearchResponse = BaseSearchResponse<SearchData>;
export type SuggestResponse = BaseSearchResponse<SuggestItem[]>;
export type TrendingResponse = BaseSearchResponse<string[]>;
