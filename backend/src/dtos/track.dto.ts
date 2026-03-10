import { z } from "zod";
import {
  createTrackSchema,
  updateTrackSchema,
  getTracksSchema,
} from "../validations/track.validation";

// Input DTOs
export type CreateTrackDTO = z.infer<typeof createTrackSchema>["body"];
export type UpdateTrackDTO = z.infer<typeof updateTrackSchema>["body"];
export type TrackFilterDTO = z.infer<typeof getTracksSchema>["query"];

// Response DTO (Track hiển thị trên UI)
export interface TrackResponseDTO {
  _id: string;
  title: string;
  slug: string;
  description?: string;

  // Relations (đã populate)
  artist: {
    _id: string;
    name: string;
    avatar: string;
    slug: string;
  };
  album?: {
    _id: string;
    title: string;
    coverImage: string;
    slug: string;
  };

  coverImage: string;
  trackUrl: string; // Link file gốc
  hlsUrl?: string; // Link stream
  duration: number;

  playCount: number;
  likeCount: number;
  isLiked?: boolean; // Field tính toán runtime (User đã like chưa)

  createdAt: Date;
}
