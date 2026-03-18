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

// 2. Cấu trúc bài hát trong BXH
export interface ChartTrack extends ITrack {
  rank?: number;
  lastRank?: number;
}

// 3. Cấu trúc Data trả về từ API / Socket (Bao gồm cả List và Chart)
export interface RealtimeChartData {
  items: ChartTrack[]; // Danh sách 100 bài
  chart: ChartDataPoint[]; // Dữ liệu biểu đồ cho Top 3
}

// 4. Response bọc ngoài cùng
export interface ChartResponse {
  success: boolean;
  data: RealtimeChartData; // 🔥 Sửa lại chỗ này: Không phải ChartTrack[] nữa
  timestamp?: string;
}
