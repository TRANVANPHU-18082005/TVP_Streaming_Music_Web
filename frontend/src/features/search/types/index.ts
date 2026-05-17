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
// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const TRENDING_FALLBACK = [
  "Sơn Tùng M-TP",
  "Chill cùng Indie",
  "Pop Ballad",
  "Rap Việt",
  "Nhạc Trẻ",
  "Tập Gym",
  "Mới Phát Hành",
  "Lo-fi Nhẹ Nhàng",
];

export const MAX_RECENT_SEARCHES = 10;
export const STORAGE_KEY = "recentSearches";

export const SEARCH_TABS = [
  { id: "all", label: "Tất cả", Icon: "Music2" },
  { id: "track", label: "Bài hát", Icon: "Music2" },
  { id: "artist", label: "Nghệ sĩ", Icon: "Mic2" },
  { id: "album", label: "Đĩa nhạc", Icon: "Disc3" },
  { id: "playlist", label: "Danh sách phát", Icon: "ListMusic" },
  { id: "genre", label: "Thể loại", Icon: "Tag" },
] as const;

export type SearchTab = (typeof SEARCH_TABS)[number]["id"];

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION PRESETS
// ─────────────────────────────────────────────────────────────────────────────

export const SPRING_FAST = {
  type: "spring",
  stiffness: 500,
  damping: 32,
} as const;
export const SPRING_MEDIUM = {
  type: "spring",
  stiffness: 300,
  damping: 28,
} as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { ...SPRING_MEDIUM, delay: i * 0.045 },
  }),
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};
// --- Specific API Responses ---
export type SearchResponse = BaseSearchResponse<SearchData>;
export type SuggestResponse = BaseSearchResponse<SuggestItem[]>;
export type TrendingResponse = BaseSearchResponse<string[]>;
