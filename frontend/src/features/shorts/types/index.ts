export interface ITrackShort {
  _id: string;
  track: any; // Mongoose populate
  moodVideo: any; // Mongoose populate
  
  startTime: number;
  endTime: number;
  duration: number;
  
  title?: string;
  caption?: string;
  
  suggestedByAi: boolean;
  aiConfidence?: number;
  
  isPublished: boolean;
  priority: number;
  
  viewCount: number;
  likeCount: number;
  shareCount: number;
  
  createdAt: string;
  updatedAt: string;
}

export interface ShortsResponse {
  success: boolean;
  data: ITrackShort;
}

export interface ShortsListResponse {
  success: boolean;
  data: {
    data: ITrackShort[];
    total: number;
  };
}

export interface ShortsFeedResponse {
  success: boolean;
  data: {
    feed: ITrackShort[];
    nextCursor: string | null;
  };
}
