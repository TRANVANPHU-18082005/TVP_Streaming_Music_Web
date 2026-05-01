export type GenreStatus = "active" | "inactive" | "all";
export type GenreSort = "popular" | "priority" | "newest" | "oldest" | "name";

// Entity chính
export interface IGenre {
  _id: string;
  name: string;
  slug: string;
  description?: string;

  // Visuals & Hierarchy
  image?: string;
  color?: string; // Hex (#1db954)
  gradient?: string; // CSS Gradient string
  parentId?: IGenre | string | null; // Có thể là object (Populated) hoặc ID

  // Curation & Status
  priority: number; // Càng cao càng ưu tiên lên đầu
  isTrending: boolean;
  isActive: boolean;
  trackIds: string[];
  // Stats (Denormalized)
  trackCount: number;
  albumCount: number;
  artistCount: number;

  createdAt: string;
  updatedAt: string;
}

// Input dành cho Form (Giống PlaylistFormInput)
export interface GenreFormInput {
  name: string;
  description?: string;
  color?: string;
  gradient?: string;
  parentId?: string | null;
  priority?: number;
  isTrending?: boolean;
  isActive?: boolean;
  // image: Sử dụng any vì có thể là File (upload) hoặc string (URL cũ)
  image?: any;
}

export type CreateGenreInput = GenreFormInput;

export interface UpdateGenreInput extends Partial<GenreFormInput> {
  _id: string;
}

// Filter chuẩn hóa giống PlaylistFilterParams
export interface GenreFilterParams {
  page?: number;
  limit?: number | "all";
  status?: GenreStatus;
  keyword?: string;
  isTrending?: boolean;
  parentId?: string | "root";
  sort?: GenreSort;
}

// Response cho Virtual Scroll (Đồng bộ với PlaylistDetailResponse)
export interface GenreDetailResponse extends IGenre {
  subGenres: IGenre[]; // Danh sách con để hiện tab/chip
  breadcrumbs: Array<{ _id: string; name: string; slug: string }>; // Đường dẫn phân cấp
  trackIds: string[]; // Mảng ID bài hát để Frontend chạy Virtualizer
}
