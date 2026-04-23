import { IAlbum } from "@/features/album";
import { IArtist } from "@/features/artist";
import { IMoodVideo } from "@/features/mood-video/types";

export interface IWord {
  /** Display text */
  word: string;
  /** Absolute start time in ms */
  startTime: number;
  /** Duration in ms */
  endTime: number;
}

export type LyricType = "none" | "plain" | "synced" | "karaoke";

export interface ILyricLine extends ILyricSyncLine, IKaraokeLine { }

export interface ILyricSyncLine {
  startTime: number;
  endTime: number;
  text: string;
}
export interface IKaraokeLine {
  text: string;
  start: number;
  end: number;
  words: { word: string; startTime: number; endTime: number }[];
}

export interface ITrack {
  _id: string;
  title: string;
  slug: string;
  description?: string;

  // Populated Data
  artist: IArtist;
  featuringArtists: IArtist[];
  album?: IAlbum | null;
  genres: Array<{ _id: string; name: string }>;
  uploader: string;

  // Resources
  trackUrl: string;
  hlsUrl?: string;
  coverImage: string;

  // === UPGRADE: LYRICS & KARAOKE ===
  // none: không lời, plain: lời thô, synced: theo dòng (.lrc), karaoke: từng chữ
  lyricType: "none" | "plain" | "synced" | "karaoke";

  // URL dẫn đến file .json chứa data lyrics đầy đủ trên B2
  lyricUrl?: string;

  // Lưu 5-10 câu đầu để Preview/SEO (không cần fetch file JSON)
  lyricPreview: ILyricLine[];

  // Lời bài hát thô để Search Engine (MongoDB Full-text search)
  plainLyrics?: string;

  // === UPGRADE: VISUAL CONTEXT ===
  // Gán trực tiếp Object MoodVideo hoặc ID (Canvas)
  moodVideo?: IMoodVideo | null;

  // Context & Metadata
  trackNumber: number;
  diskNumber: number;
  releaseDate: string;
  isExplicit: boolean;
  copyright?: string;
  isrc?: string;

  // Tags (Cực kỳ quan trọng để Worker tự động khớp Canvas)
  tags: string[];

  // Technical Specs (Enriched by Worker)
  duration: number;
  fileSize: number;
  format: string;
  bitrate: number;

  // Stats & States
  isLiked?: boolean;
  playCount: number;
  likeCount: number;
  status: "pending" | "processing" | "ready" | "failed";
  isPublic: boolean;
  errorReason?: string;
  createdAt: string;
  updatedAt: string;
}

// 2. Cập nhật Filter Params (Bổ sung lọc theo Mood/Lyric)
export interface TrackFilterParams {
  page?: number;
  limit?: number;
  keyword?: string;
  artistId?: string;
  albumId?: string;
  genreId?: string;
  moodVideoId?: string; // Lọc các bài cùng Canvas
  lyricType?: "none" | "plain" | "synced" | "karaoke";
  status?: "pending" | "processing" | "ready" | "failed";
  sort?: "newest" | "popular" | "alphabetical" | "trending";
  isPublic?: boolean;
}

// 3. Chart Interfaces (Giữ nguyên cấu trúc nhưng đồng bộ technical fields)
export interface IChartItem {
  _id: string;
  title: string;
  slug: string;
  duration: number;
  coverImage: string;
  hlsUrl?: string;
  playCount: number;
  score: number;
  artist: {
    _id: string;
    name: string;
    avatar: string;
    slug: string;
  };
  album?: {
    _id: string;
    title: string;
    slug: string;
  };
  featuringArtists: IArtist[];
  moodVideo?: string | null; // Cho phép hiển thị Canvas ngay trên Chart
}

// ... Các interface Chart khác giữ nguyên cấu trúc bạn đã gửi
// 1. Dữ liệu 1 điểm trên biểu đồ (Time Series)
export interface ChartDataPoint {
  time: string;
  top1: number;
  top2: number;
  top3: number;
}

export interface IChartDataPoint {
  time: string;
  top1: number;
  top2: number;
  top3: number;
}

export interface IChartResponse {
  success: boolean;
  data: IRealtimeChartData;
}
// Định nghĩa Artist và Album tối giản để dùng chung cho Chart và Track
export interface IArtistMin {
  _id: string;
  name: string;
  avatar: string;
  slug: string;
}

export interface IAlbumMin {
  _id: string;
  title: string;
  slug: string;
}

// 1. Dữ liệu điểm biểu đồ
export interface IChartDataPoint {
  time: string;
  top1: number;
  top2: number;
  top3: number;
}

// 3. ChartTrack dùng cho UI (thêm các field tính toán hạng)
export interface ChartTrack extends IChartItem {
  rank?: number;
  lastRank?: number;
}

// 4. Cấu trúc Data từ API
export interface IRealtimeChartData {
  items: IChartItem[];
  chart: IChartDataPoint[];
  lastUpdatedAt?: string; // Đưa vào đây luôn cho đồng bộ
}

// 5. Response chuẩn từ Backend
export interface IChartResponse {
  success: boolean;
  data: IRealtimeChartData;
}

export type ChartUpdatePayload = Partial<IRealtimeChartData>;
