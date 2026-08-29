import { ITrackShort } from "@/features/shorts/types";

// All supported DJ transition types
export type TransitionType =
  | 'crossfade'
  | 'cut'
  | 'beatmatch'
  | 'echo-out'
  | 'filter-sweep'
  | 'stutter'
  | 'build-drop'
  | 'vinyl-scratch';

export interface IMashupShort {
  short: ITrackShort;
  order: number;
  transitionType: TransitionType;
  transitionDuration: number; // ms
  volume?: number;       // 0-1, default 1
  trimStart?: number;    // override short.startTime (seconds)
  trimEnd?: number;      // override short.endTime (seconds)
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

// Time-based mashup limits
export const MASHUP_MIN_DURATION = 60;  // 1 minute in seconds
export const MASHUP_MAX_DURATION = 420; // 7 minutes in seconds

/** Returns total duration (seconds) of a mashup's shorts */
export function calcMashupDuration(shorts: IMashupShort[]): number {
  return shorts.reduce((acc, s) => {
    const start = s.trimStart ?? s.short.startTime ?? 0;
    const end   = s.trimEnd   ?? s.short.endTime   ?? 0;
    return acc + Math.max(0, end - start);
  }, 0);
}

/** User-friendly formatted duration string */
export function formatMashupDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Transition type metadata for UI display */
export const TRANSITION_META: Record<TransitionType, {
  label: string;
  icon: string;
  color: string;
  description: string;
}> = {
  crossfade:      { label: 'Crossfade',      icon: '⇌', color: '#6366f1', description: 'Fade mượt giữa 2 bài' },
  cut:            { label: 'Hard Cut',       icon: '✂', color: '#ef4444', description: 'Cắt thẳng, không hiệu ứng' },
  beatmatch:      { label: 'Beat Match',     icon: '♻', color: '#10b981', description: 'Sync nhịp beat' },
  'echo-out':     { label: 'Echo Out',       icon: '〜', color: '#f59e0b', description: 'Fade out với tiếng echo' },
  'filter-sweep': { label: 'Filter Sweep',   icon: '◌', color: '#8b5cf6', description: 'Low-pass filter sweep' },
  stutter:        { label: 'Stutter',        icon: '≈', color: '#ec4899', description: 'Hiệu ứng lặp nhanh' },
  'build-drop':   { label: 'Build → Drop',   icon: '⚡', color: '#f97316', description: 'Build-up rồi drop' },
  'vinyl-scratch': { label: 'Vinyl Scratch', icon: '◎', color: '#14b8a6', description: 'Vinyl scratch effect' },
};
