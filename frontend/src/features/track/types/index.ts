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

export interface ILyricLine extends ILyricSyncLine, IKaraokeLine {}

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
  highlightHtml?: string;
  description?: string;
  artist: IArtist;
  featuringArtists: IArtist[];
  album?: IAlbum | null;
  genres: Array<{ _id: string; name: string }>;
  uploader: string;
  // Media URLs
  trackUrl: string;
  hlsUrl?: string;
  coverImage: string;
  // Lyrics & Mood Video
  lyricType: "none" | "plain" | "synced" | "karaoke";
  lyricUrl?: string;
  lyricPreview: ILyricLine[];
  plainLyrics?: string;
  moodVideo?: IMoodVideo | null;
  // Technical Specs
  trackNumber: number;
  diskNumber: number;
  releaseDate: Date;
  isExplicit: boolean;
  copyright?: string;
  isrc?: string;
  tags: string[];
  duration: number;
  fileSize: number;
  format: string;
  bitrate: number;
  // Stats & Flags
  playCount: number;
  likeCount: number;
  status: "pending" | "processing" | "ready" | "failed";
  isPublic: boolean;
  isDeleted: boolean;
  errorReason?: string;
  createdAt: string;
  updatedAt: string;
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

// Compatibility exports
export type Track = ITrack;
export type {
  TrackFilterParams,
  TrackCreateFormValues,
  TrackEditFormValues,
  BulkTrackFormValues,
} from "../schemas/track.schema";
