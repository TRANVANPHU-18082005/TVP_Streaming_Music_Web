import { z } from "zod";
import {
  createTrackSchema,
  updateTrackSchema,
  getTracksSchema,
} from "../validations/track.validation";

// ==========================================
// INPUT DTOs (Data from Client)
// ==========================================
export type CreateTrackDTO = z.infer<typeof createTrackSchema>["body"];
export type UpdateTrackDTO = z.infer<typeof updateTrackSchema>["body"];
export type TrackFilterDTO = z.infer<typeof getTracksSchema>["query"];

// ==========================================
// SUB-INTERFACES
// ==========================================

export interface ILyricPreviewDTO {
  startTime: number;
  text: string;
}

// ==========================================
// RESPONSE DTO (Data sent to Client)
// ==========================================
export interface TrackResponseDTO {
  _id: string;
  title: string;
  slug: string;
  description?: string;

  // --- RELATIONS (Populated) ---
  artist: {
    _id: string;
    name: string;
    avatar: string;
    slug: string;
    totalFollowers?: number;
  };
  album?: {
    _id: string;
    title: string;
    coverImage: string;
    slug: string;
  } | null;

  genres: Array<{
    _id: string;
    name: string;
    slug: string;
  }>;

  // --- NEW: VISUAL CANVAS (MOOD VIDEO) ---
  // Dữ liệu video nền để Player hiển thị ngay lập tức
  moodVideo?: {
    _id: string;
    videoUrl: string;
    thumbnailUrl: string;
    title: string;
  } | null;

  // --- NEW: LYRICS & KARAOKE ---
  lyricType: "none" | "plain" | "synced" | "karaoke";
  lyricUrl?: string; // Link file .json đầy đủ trên B2 (dành cho Karaoke)
  lyricPreview?: ILyricPreviewDTO[]; // 5 câu đầu hiển thị nhanh
  plainLyrics?: string; // Dùng cho SEO hoặc hiển thị văn bản thô

  // --- RESOURCES ---
  coverImage: string;
  trackUrl: string; // Link file gốc (.mp3)
  hlsUrl?: string; // Link luồng stream (.m3u8)

  // --- SPECS & CONTEXT ---
  duration: number; // Giây
  bitrate: number; // kbps
  fileSize: number; // bytes
  isExplicit: boolean;
  tags: string[];

  releaseDate: Date | string;
  copyright?: string;
  isrc?: string;

  // --- STATS ---
  playCount: number;
  likeCount: number;
  isLiked?: boolean; // User hiện tại đã like chưa

  // --- STATUS ---
  status: "pending" | "processing" | "ready" | "failed";
  errorReason?: string; // Lý do nếu status là 'failed'

  createdAt: Date;
  updatedAt: Date;
}
