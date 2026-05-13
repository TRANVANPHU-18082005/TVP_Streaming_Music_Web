import { IAlbum } from "@/features/album";
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
  coverImage: string;
  images: string[]; // Gallery ảnh nghệ sĩ
  themeColor: string; // Dùng cho Background Gradient ở trang Artist Detail

  // Relationships (Populated)
  user?: IUser | null; // Tài khoản quản lý profile này (nếu có)

  socialLinks?: SocialLinks;

  totalTracks: number;
  totalAlbums: number;
  totalFollowers: number;
  playCount: number;
  monthlyListeners: number; // Chỉ số quan trọng để hiện: "1.5M người nghe hàng tháng"

  // Status & Verification
  isVerified: boolean;
  isActive: boolean; // Trạng thái hoạt động (Admin có thể ẩn Artist)
  isDeleted: boolean; // Trạng thái đã xoá (Admin có thể xoá mềm)
  createdAt: string;
  updatedAt: string;
}
export interface IArtistDetail extends IArtist {
  totalTracksCount: number;
  trackIds: string[];
  albums: IAlbum[];
}
