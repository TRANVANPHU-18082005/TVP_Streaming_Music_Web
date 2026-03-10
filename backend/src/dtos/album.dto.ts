import { z } from "zod";
import {
  createAlbumSchema,
  updateAlbumSchema,
  getAlbumsSchema,
} from "../validations/album.validation";

// Input DTOs
export type CreateAlbumDTO = z.infer<typeof createAlbumSchema>["body"];
export type UpdateAlbumDTO = z.infer<typeof updateAlbumSchema>["body"];
export type AlbumFilterDTO = z.infer<typeof getAlbumsSchema>["query"];

// Response DTO
export interface AlbumResponseDTO {
  _id: string;
  title: string;
  slug: string;
  type: "album" | "single" | "ep";

  artist: {
    _id: string;
    name: string;
    avatar: string;
  };

  coverImage: string;
  releaseDate: Date;
  releaseYear: number;

  totalTracks: number;
  totalDuration: number;
}
