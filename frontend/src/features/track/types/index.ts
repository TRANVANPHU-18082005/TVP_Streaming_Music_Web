import { Album } from "@/features/album/types";
import { Artist } from "@/features/artist/types";

export interface ITrack {
  _id: string;
  title: string;
  slug: string;
  description?: string;

  // Populated Data
  artist: Artist;
  featuringArtists: Artist[];
  album?: Album | null;
  genres: Array<{ _id: string; name: string }>;
  uploader: string;

  // Resources
  trackUrl: string;
  hlsUrl?: string; // 🔥 Cực kỳ quan trọng cho Streaming player
  coverImage: string;

  // Context
  trackNumber: number;
  diskNumber: number;
  releaseDate: string;
  isExplicit: boolean;
  copyright?: string;
  isrc?: string;

  // Content
  lyrics?: string;
  tags: string[];

  // Technical Specs (Backend trả về sau khi xử lý file)
  duration: number;
  fileSize: number;
  format: string;
  bitrate: number;

  // Stats
  isLiked?: boolean; // 🔥 Quan trọng để hiển thị trạng thái Like
  playCount: number;
  likeCount: number;
  status: "pending" | "processing" | "ready" | "failed";
  isPublic: boolean;
  errorReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrackFilterParams {
  page?: number;
  limit?: number;
  keyword?: string;
  artistId?: string;
  albumId?: string;
  genreId?: string;
  status?: "pending" | "processing" | "ready" | "failed";
  sort?: "newest" | "popular" | "alphabetical";
  isPublic?: boolean;
}

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
  featuringArtists: Artist[];
}

export interface IRealtimeChartData {
  items: IChartItem[];
  chart: IChartDataPoint[];
}

export interface IChartResponse {
  success: boolean;
  data: IRealtimeChartData;
  lastUpdatedAt: string;
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
  lastUpdatedAt: string;
}

export type ChartUpdatePayload = Partial<IRealtimeChartData>;
