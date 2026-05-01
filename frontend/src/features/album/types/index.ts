import { IArtist } from "@/features/artist";
import { IGenre } from "@/features/genre";
import { ITrack } from "@/features/track";

export interface IAlbum {
  _id: string;
  title: string;
  slug: string;
  type: "album" | "single" | "ep" | "compilation";
  description?: string;

  // Visuals
  coverImage: string; // Luôn là URL string khi nhận từ API
  themeColor: string; // Hex color

  // Relations (Thường đã được populate)
  artist: IArtist; // Backend trả về object Artist đầy đủ
  genres: IGenre[]; // Backend trả về mảng Genre đầy đủ

  // Release & Legal
  releaseDate: string; // ISO Date String
  releaseYear: number;
  label?: string;
  copyright?: string;
  upc?: string;
  tags?: string[];
  playCount: number; // Tổng lượt nghe của Album
  likeCount: number; // Số lượng yêu thích
  tracks?: ITrack[];
  // Stats & Status
  totalTracks: number;
  isPublic: boolean;
  totalDuration: number; // Tổng thời lượng tất cả track trong album (tính bằng giây)
  createdAt: string;
  updatedAt: string;
  trackIds: string[];
}

// ==========================================
// 2. INPUTS (Dữ liệu gửi lên API)
// ==========================================

// Base Input cho Form (Khớp với Zod Schema AlbumFormValues)
export interface AlbumFormInput {
  title: string;
  type: "album" | "single" | "ep" | "compilation";
  description?: string;

  coverImage: File | string | null;

  themeColor: string;
  artist: string;
  genreIds: string[];

  releaseDate: string; // YYYY-MM-DD
  isPublic: boolean;

  // New fields
  label?: string;
  copyright?: string;
  upc?: string;
  tags?: string;
}

// Input dùng cho hàm Create (thường giống FormInput)
export type CreateAlbumInput = AlbumFormInput;

// Input dùng cho hàm Update (cần thêm _id để định danh)
export interface UpdateAlbumInput extends Partial<AlbumFormInput> {
  _id: string;
}

// ==========================================
// 3. PARAMS & RESPONSE
// ==========================================

// Params lọc danh sách
export interface AlbumFilterParams {
  page?: number;
  limit?: number;
  keyword?: string;
  artistId?: string;
  genreId?: string;
  year?: number;
  type?: "album" | "single" | "ep" | "compilation" | "all";
  sort?: "newest" | "oldest" | "popular" | "name"; // Thêm sort
  isPublic?: boolean; // Admin có thể lọc theo trạng thái
}
export interface AlbumDetailResponse extends IAlbum {
  trackIds: string[];
}
