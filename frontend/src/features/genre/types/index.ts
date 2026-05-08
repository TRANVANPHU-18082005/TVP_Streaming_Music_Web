export type GenreStatus = "active" | "inactive" | "all";
export type GenreSort = "popular" | "priority" | "newest" | "oldest" | "name";

// Entity chính
export interface IGenre {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string | null | { _id: string; name: string; slug?: string }; // Có thể là ID hoặc object phụ (nếu API trả về populated)
  image: string;
  color: string;
  gradient: string;
  priority: number;
  isTrending: boolean;
  trackCount: number;
  playCount: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface IGenreDetail extends IGenre {
  artistCount?: number;
  totalTracksCount: number;

  subGenres: IGenre[]; // Danh sách con để hiện tab/chip
  breadcrumbs: Array<{ _id: string; name: string; slug: string }>; // Đường dẫn phân cấp
  trackIds: string[]; // Mảng ID bài hát để Frontend chạy Virtualizer
}
