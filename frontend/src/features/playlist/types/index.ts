import { type IUser } from "@/features/user/types";
import { PlaylistType, PlaylistVisibility } from "../schemas/playlist.schema";

export interface IPlaylist {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  coverImage: string;
  themeColor: string;

  user: IUser;
  collaborators: IUser[];

  tracks: string[]; // Mảng track IDs

  visibility: PlaylistVisibility;
  type: PlaylistType;
  tags: string[];

  isPublic: boolean; // Field ảo hoặc cũ (nếu BE vẫn trả về để tương thích ngược)
  isSystem: boolean;

  totalTracks: number;
  totalDuration: number;
  playCount: number;
  isDeleted: boolean; // Trạng thái đã xóa (Soft Delete)
  createdAt: string;
  updatedAt: string;
}

export interface IPlaylistDetail extends IPlaylist {
  trackIds: string[];
}
