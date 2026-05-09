import { z } from "zod";
import {
  createPlaylistSchema,
  updatePlaylistSchema,
  addTracksToPlaylistSchema,
} from "../validations/playlist.validation";

// Input DTOs
export type CreatePlaylistDTO = z.infer<typeof createPlaylistSchema>["body"];
export type UpdatePlaylistDTO = z.infer<typeof updatePlaylistSchema>["body"];
export type AddTracksDTO = z.infer<typeof addTracksToPlaylistSchema>["body"];

// Response DTO
export interface PlaylistResponseDTO {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  coverImage: string;

  user: {
    _id: string;
    fullName: string;
    avatar: string;
  };

  // Stats
  totalTracks: number;
  totalDuration: number;

  isPublic: boolean;
  isSystem: boolean;

  createdAt: Date;
}
