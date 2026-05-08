import { IArtist } from "@/features/artist";

export interface IAlbum {
  _id: string;
  title: string;
  slug: string;
  type: "album" | "single" | "ep" | "compilation";
  description?: string;
  coverImage: string;
  themeColor: string;
  artist: IArtist;
  releaseDate: string;
  releaseYear: number;
  tags?: string[];
  playCount: number; // Tổng lượt nghe của Album
  likeCount: number; // Số lượng yêu thích
  totalTracks: number;
  isPublic: boolean;
  totalDuration: number; // Tổng thời lượng tất cả track trong album (tính bằng giây)
  createdAt: string;
  updatedAt: string;
}

export interface IAlbumDetail extends IAlbum {
  totalTracksCount: number;
  trackIds: string[];
}
