// src/features/karaoke/types/index.ts

import { IUser } from "@/features/user";
import { ITrack } from "@/features/track/types";

export type KaraokeRecordingStatus =
  | "uploaded"
  | "pending_review"
  | "approved"
  | "rejected";

export interface IKaraokeRecording {
  _id: string;
  user: IUser;
  title: string;
  slug: string;

  // YouTube source
  youtubeVideoId: string;
  youtubeTitle: string;
  youtubeThumbnail: string;

  // Audio on cloud
  audioUrl: string;
  audioDuration: number;
  audioSize: number;

  // Metadata
  coverImage: string;
  description: string;
  tags: string[];

  // Status & Moderation
  status: KaraokeRecordingStatus;
  isPublic: boolean;
  reviewedBy?: IUser | string;
  reviewedAt?: string;
  rejectionReason?: string;
  reviewNote?: string;

  // Stats
  playCount: number;
  likeCount: number;
  likedBy?: string[];
  shareCount: number;

  createdAt: string;
  updatedAt: string;
}

export interface IKaraokePermission {
  _id: string;
  user: IUser;
  uploadEnabled: boolean;
  uploadLimit: number;
  uploadsUsed: number;
  uploadsRemaining: number;
  maxDuration: number;
  maxFileSize: number;
  grantedBy: IUser | string;
  grantedAt: string;
  revokedAt?: string;
  note?: string;
  hasPermission: boolean;
}

export interface KaraokeFilterParams {
  page?: number;
  limit?: number;
  keyword?: string;
  status?: KaraokeRecordingStatus;
  sort?: "newest" | "oldest" | "popular" | "most_liked";
  userId?: string;
}

export interface KaraokePermissionFilterParams {
  page?: number;
  limit?: number;
  keyword?: string;
  uploadEnabled?: boolean;
}

export interface UploadRecordingDto {
  audio: File | Blob;
  title: string;
  youtubeVideoId: string;
  youtubeTitle: string;
  youtubeThumbnail?: string;
  description?: string;
  tags?: string[];
  audioDuration: number;
}

export interface UpdateRecordingDto {
  title?: string;
  description?: string;
  tags?: string[];
}

export interface AdminReviewDto {
  action: "approve" | "reject";
  rejectionReason?: string;
  reviewNote?: string;
}

export interface GrantPermissionDto {
  uploadEnabled: boolean;
  uploadLimit?: number;
  maxDuration?: number;
  maxFileSize?: number;
  note?: string;
}
