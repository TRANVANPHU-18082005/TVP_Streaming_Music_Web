import type { IAlbum } from "@/features/album/types";
import { IGenre } from "@/features/genre";
import type { ITrack } from "@/features/track/types";
import { IUser } from "@/features/user";

// ─────────────────────────────────────────────────────────────────────────────
// 1. SUBSIDIARY TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  website?: string;
  spotify?: string;
  youtube?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. MAIN ENTITY INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface IArtist {
  _id: string;
  name: string;
  slug: string;
  aliases: string[]; // Các tên gọi khác (Sếp, Tùng Núi...)
  nationality: string; // VN, US, KR...

  bio?: string;
  avatar?: string;
  coverImage?: string;
  images: string[]; // Gallery ảnh nghệ sĩ
  themeColor: string; // Dùng cho Background Gradient ở trang Artist Detail

  // Relationships (Populated)
  user?: IUser | null; // Tài khoản quản lý profile này (nếu có)
  genres: IGenre[];

  socialLinks?: SocialLinks;

  // Stats (Denormalized từ Backend để render UI nhanh)
  totalTracks: number;
  totalAlbums: number;
  totalFollowers: number;
  totalPlays: number;
  monthlyListeners: number; // Chỉ số quan trọng để hiện: "1.5M người nghe hàng tháng"

  // Status & Verification
  isVerified: boolean;
  isActive: boolean; // Trạng thái hoạt động (Admin có thể ẩn Artist)
  isFollowed?: boolean; // Field động trả về dựa trên currentUser

  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. INPUT / FORM TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Dữ liệu thô dùng cho React Hook Form */
export interface ArtistFormInput {
  name: string;
  aliases: string[];
  nationality: string;
  bio?: string;

  // Có thể là File (khi upload mới) hoặc String URL (ảnh cũ)
  avatar?: any;
  coverImage?: any;
  images: any[];

  themeColor: string;
  genreIds: string[]; // Chỉ gửi mảng ID lên Backend
  userId?: string;

  socialLinks?: SocialLinks;
  isVerified: boolean;
  isActive: boolean;
}

export type CreateArtistInput = ArtistFormInput;

export interface UpdateArtistInput extends Partial<ArtistFormInput> {
  _id: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. QUERY & RESPONSE TYPES (Virtual Scroll Optimized)
// ─────────────────────────────────────────────────────────────────────────────

export interface ArtistFilterParams {
  page?: number;
  limit?: number;
  keyword?: string;
  genreId?: string;
  nationality?: string;
  isVerified?: boolean;
  isActive?: boolean;
  sort?: "newest" | "oldest" | "popular" | "name";
}

/**
 * RESPONSE CHO TRANG CHI TIẾT (Virtual Scroll)
 * Giống như Playlist, ta trả về Metadata + Mảng ID bài hát
 */
export interface ArtistDetailResponse {
  artist: IArtist & {
    trackIds: string[]; // Mảng ID của tất cả bài hát để FE làm Virtual Scroll
  };
  albums: IAlbum[]; // Danh sách đĩa nhạc (thường lấy top 10)
  // Có thể thêm topTracks nếu muốn hiện 5 bài hot nhất dạng tĩnh trước
  topTracks?: ITrack[];
}
