// src/features/interaction/types/index.ts
export interface LikeResponse {
  isLiked: boolean;
}

export interface FollowResponse {
  isFollowed: boolean;
}

export interface BatchCheckResponse {
  checkedIds: string[];
  interactedIds: string[];
}
// src/types/interaction.ts

export type InteractionType =
  | "track"
  | "album"
  | "playlist"
  | "artist"
  | "genre";

export interface PlayInteraction {
  /** ID của mục tiêu (trackId, albumId,...) */
  targetId: string;

  /** Loại nội dung được phát */
  targetType: InteractionType;

  /** ID người dùng (optional nếu là khách vãng lai) */
  userId?: string;

  /** Metadata bổ sung (tùy chọn để mở rộng sau này) */
  metadata?: {
    source?: string; // ví dụ: "search", "homepage", "recommendation"
    deviceId?: string;
  };
}
