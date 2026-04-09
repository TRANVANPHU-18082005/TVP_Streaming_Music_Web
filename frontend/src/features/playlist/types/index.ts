import { ITrack } from "@/features/track/types";
import { type IUser } from "@/features/user/types";

export type PlaylistVisibility = "public" | "private" | "unlisted";
export type PlaylistType = "playlist" | "radio" | "mix";

export interface IPlaylist {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  coverImage: string;
  themeColor: string;

  // Quan hệ đã được Populate
  user: IUser;
  collaborators: IUser[];

  // Danh sách bài hát (Dạng phẳng hoặc dạng lồng tùy API của bạn)
  tracks: ITrack[];

  visibility: PlaylistVisibility;
  type: PlaylistType;
  tags: string[];

  isPublic: boolean; // Field ảo hoặc cũ (nếu BE vẫn trả về để tương thích ngược)
  isSystem: boolean;

  // Các con số thống kê để hiển thị UI
  totalTracks: number;
  totalDuration: number;
  followersCount: number;
  playCount: number;

  createdAt: string;
  updatedAt: string;
}
export interface PlaylistFormInput {
  title: string;
  slug: string;
  description?: string;
  coverImage: string;
  themeColor: string;

  // Quan hệ đã được Populate
  collaborators: IUser[];

  // Danh sách bài hát (Dạng phẳng hoặc dạng lồng tùy API của bạn)

  visibility: PlaylistVisibility;
  type: PlaylistType;
  tags: string[];

  isPublic: boolean; // Field ảo hoặc cũ (nếu BE vẫn trả về để tương thích ngược)
  isSystem: boolean;
}
export type CreatePlaylistInput = PlaylistFormInput;

export interface UpdatePlaylistInput extends Partial<PlaylistFormInput> {
  _id: string;
}
export interface PlaylistFilterParams {
  page?: number;
  limit?: number;
  keyword?: string;
  visibility?: PlaylistVisibility | "all";
  type?: PlaylistType | "all";
  isSystem?: boolean;
  sort?: "newest" | "oldest" | "popular" | "name";
}
export interface PlaylistDetailResponse extends IPlaylist {
  trackIds: string[];
}
