// --- Base Entities ---
export interface SearchArtist {
  _id: string;
  name: string;
  slug: string;
  avatar: string;
  totalFollowers: number;
  highlightHtml?: string; // Mới thêm từ backend v4
}

export interface SearchTrack {
  _id: string;
  title: string;
  slug: string;
  coverImage: string;
  duration: number;
  plays: number;
  artist: {
    name: string;
    slug: string;
  };
  highlightHtml?: string; // Mới thêm từ backend v4
}

export interface SearchAlbum {
  _id: string;
  title: string;
  slug: string;
  coverImage: string;
  year: number;
  artist: {
    name: string;
  };
  highlightHtml?: string; // Mới thêm từ backend v4
}

export interface SearchPlaylist {
  _id: string;
  title: string;
  slug: string;
  coverImage: string;
  user: {
    fullName: string;
  };
}

// --- Suggestion Types (Endpoint /suggest) ---
export interface SuggestItem {
  id: string;
  label: string; // Title hoặc Name
  slug: string;
  type: "track" | "artist" | "album";
}

// --- Top Result Union Type ---
export type TopResultItem =
  | ({ type: "artist" } & SearchArtist)
  | ({ type: "track" } & SearchTrack)
  | ({ type: "album" } & SearchAlbum);

// --- Main Data Structure ---
export interface SearchData {
  topResult: TopResultItem | null;
  tracks: SearchTrack[];
  artists: SearchArtist[];
  albums: SearchAlbum[];
  playlists: SearchPlaylist[];
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
