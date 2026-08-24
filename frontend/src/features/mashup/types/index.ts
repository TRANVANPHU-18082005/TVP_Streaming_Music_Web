import { ITrackShort } from "@/features/shorts/types";

export interface IMashupShort {
  short: ITrackShort;
  order: number;
  transitionType: 'crossfade' | 'cut' | 'beatmatch';
  transitionDuration: number; // ms
}

export interface IMashup {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  coverImage?: string;
  
  createdBy?: any;
  creationType: 'auto' | 'manual' | 'ai';
  
  shorts: IMashupShort[];
  
  compatibilityScore: number;
  avgTempo: number;
  avgEnergy: number;
  dominantMoods: string[];
  dominantGenres: any[];
  keySignature?: string;
  totalDuration: number;
  
  energyCurve: 'build-up' | 'chill' | 'peak' | 'wave' | 'custom';
  
  playCount: number;
  likeCount: number;
  shareCount: number;
  
  isPublished: boolean;
  status: 'draft' | 'generating' | 'ready' | 'failed';
  
  mashupAudioUrl?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface MashupResponse {
  success: boolean;
  data: IMashup;
}

export interface MashupFeedResponse {
  success: boolean;
  data: {
    feed: IMashup[];
    nextCursor?: string | null;
  };
}

export interface MashupSuggestResponse {
  success: boolean;
  data: ITrackShort[];
}
