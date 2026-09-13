// features/music-room/types/room.types.ts

export type RoomTheme = "bar" | "lounge" | "festival" | "chill" | "hype";
export type MessageType = "text" | "reaction" | "system";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK (minimal view trong context room)
// ─────────────────────────────────────────────────────────────────────────────

export interface RoomTrackMini {
  _id: string;
  title: string;
  coverImage: string;
  duration: number;
  artist?: { _id: string; name: string };
  hlsUrl?: string;
  trackUrl?: string;
  moodVideo?: { _id: string; videoUrl: string; };
}

export interface RoomMoodVideoMini {
  _id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRACK REQUEST
// ─────────────────────────────────────────────────────────────────────────────

export interface TrackRequest {
  trackId: string;
  trackTitle: string;
  coverImage?: string;
  artistName?: string;
  count: number;
  requestedBy: string[];
  lastRequestedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE
// ─────────────────────────────────────────────────────────────────────────────

export interface QueueItem {
  _id: string;
  track: RoomTrackMini;
  addedBy: string;
  addedAt: string;
  votes: number;
  voters: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOM
// ─────────────────────────────────────────────────────────────────────────────

export interface RoomHost {
  _id: string;
  fullName: string;
  username: string;
  avatar: string;
}

export interface MusicRoom {
  _id: string;
  roomCode: string;
  name: string;
  description?: string;
  coverImage?: string;
  theme: RoomTheme;
  host: RoomHost;
  isPublic: boolean;
  maxMembers: number;
  isActive: boolean;
  memberCount: number;
  currentTrack?: RoomTrackMini;
  currentMoodVideo?: RoomMoodVideoMini;
  queue: QueueItem[];
  startedAt?: string;
  isPaused: boolean;
  pausedAt?: number;
  lastActivityAt: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYBACK STATE (từ Redis/Server)
// ─────────────────────────────────────────────────────────────────────────────

export interface PlaybackState {
  currentTrackId: string | null;
  startedAt: number | null;   // Unix timestamp ms
  isPaused: boolean;
  pausedAt: number;           // Giây
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT
// ─────────────────────────────────────────────────────────────────────────────

export interface RoomMessage {
  _id: string;
  room: string;
  sender?: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  type: MessageType;
  reaction?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET EVENTS (Client ← Server)
// ─────────────────────────────────────────────────────────────────────────────

export interface RoomState {
  room: Pick<MusicRoom, "roomCode" | "name" | "theme" | "host" | "isPublic" | "memberCount" | "queue">;
  playbackState: PlaybackState;
  isHost: boolean;
}

export interface RoomMemberEvent {
  userId: string;
  memberCount: number;
}

export interface RoomReactionEvent {
  userId: string;
  emoji: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOATING REACTION (UI animation)
// ─────────────────────────────────────────────────────────────────────────────

export interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;   // % từ trái
}

// ─────────────────────────────────────────────────────────────────────────────
// THEME CONFIG
// ─────────────────────────────────────────────────────────────────────────────

export const ROOM_THEMES: Record<RoomTheme, {
  label: string;
  gradient: string;
  accent: string;
  glow: string;
  fallbackVideo: string;
}> = {
  bar: {
    label: "🍺 Bar Lounge",
    gradient: "from-amber-100 via-orange-100 to-yellow-50 dark:from-amber-950 dark:via-red-950 dark:to-zinc-950",
    accent: "#f59e0b",
    glow: "rgba(245,158,11,0.3)",
    fallbackVideo: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  lounge: {
    label: "🌙 Lounge",
    gradient: "from-violet-100 via-purple-100 to-fuchsia-50 dark:from-violet-950 dark:via-purple-950 dark:to-zinc-950",
    accent: "#8b5cf6",
    glow: "rgba(139,92,246,0.3)",
    fallbackVideo: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  festival: {
    label: "🎪 Festival",
    gradient: "from-pink-100 via-rose-100 to-orange-50 dark:from-pink-950 dark:via-orange-950 dark:to-yellow-950",
    accent: "#ec4899",
    glow: "rgba(236,72,153,0.3)",
    fallbackVideo: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  chill: {
    label: "🌊 Chill Waves",
    gradient: "from-teal-100 via-cyan-100 to-sky-50 dark:from-teal-950 dark:via-cyan-950 dark:to-slate-950",
    accent: "#14b8a6",
    glow: "rgba(20,184,166,0.3)",
    fallbackVideo: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  hype: {
    label: "⚡ Hype",
    gradient: "from-yellow-100 via-amber-100 to-orange-50 dark:from-yellow-950 dark:via-orange-950 dark:to-red-950",
    accent: "#eab308",
    glow: "rgba(234,179,8,0.3)",
    fallbackVideo: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
};

export const ALLOWED_REACTIONS = ["❤️", "🔥", "🎵", "🙌", "😍", "💯", "⚡", "🎉"];
