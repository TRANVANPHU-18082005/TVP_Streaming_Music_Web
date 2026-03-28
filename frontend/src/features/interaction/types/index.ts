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
