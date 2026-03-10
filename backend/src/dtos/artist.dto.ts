import { z } from "zod";
import {
  createArtistSchema,
  updateArtistSchema,
  getArtistsSchema,
} from "../validations/artist.validation";

// Input DTOs
export type CreateArtistDTO = z.infer<typeof createArtistSchema>["body"];
export type UpdateArtistDTO = z.infer<typeof updateArtistSchema>["body"];
export type ArtistFilterDTO = z.infer<typeof getArtistsSchema>["query"];

// Response DTO
export interface ArtistResponseDTO {
  _id: string;
  name: string;
  slug: string;
  avatar: string;
  coverImage: string;
  bio?: string;

  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    website?: string;
  };

  // Stats (Counter Cache)
  totalTracks: number;
  totalAlbums: number;
  followerCount: number;

  isVerified: boolean;
}
