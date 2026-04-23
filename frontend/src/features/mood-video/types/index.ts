export interface IMoodVideo {
  _id: string;
  title: string;
  slug: string;
  videoUrl: string; // URL từ Cloudinary
  thumbnailUrl: string; // Thumb trích xuất từ video
  tags: string[];
  isActive: boolean;
  usageCount: number; // Số bài hát đang sử dụng canvas này
  createdAt: string;
  updatedAt: string;
}

export interface MoodVideoFilterParams {
  page?: number;
  limit?: number;
  keyword?: string;
  isActive?: boolean;
  sort?: "newest" | "oldest" | "name" | "popular";
}

export interface MoodVideoFormInput {
  title: string;
  tags: string[];
  isActive: boolean;
  video: File | string | null; // Có thể là File khi tạo/sửa hoặc URL khi xem
}
