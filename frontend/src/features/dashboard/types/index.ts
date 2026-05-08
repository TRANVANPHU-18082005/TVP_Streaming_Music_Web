// features/dashboard/types/index.ts

// ── Primitives ──────────────────────────────────────────────────────────────

export interface StatItem {
  value: number;
  growth: number;
}

export interface ChartDashbordDataPoint {
  _id: string; // "yyyy-MM-dd"
  count: number;
}

// ── Storage Velocity ─────────────────────────────────────────────────────────

export interface StorageVelocity {
  avgBytesPerDay: number;
  avgReadablePerDay: string; // e.g. "42.3 MB"
  daysUntilFull: number | null;
  projectedFullDate: string | null; // "yyyy-MM-dd" or null
}

// ── External Services ────────────────────────────────────────────────────────

export interface CloudinaryStats {
  plan: string;
  bandwidth: {
    usage: number;
    usageReadable: string;
    limit: number;
    limitReadable: string;
    percent: number;
  };
  storage: {
    usage: number;
    usageReadable: string;
    limit: number;
    limitReadable: string;
    percent: number;
  };
  velocity: StorageVelocity; // NEW: storage growth forecast
}

export interface B2Stats {
  status: "online" | "offline";
  bucketName: string;
  bucketType: string;
  error?: string;
}

export interface UpstashStats {
  dailyRequests: number;
  monthlyRequests: number;
  dataSize: number;
  dataSizeReadable: string;
}

// ── Redis Worker ──────────────────────────────────────────────────────────────

export interface RedisWorkerInfo {
  memory: string;
  connectedClients: number; // NEW: live worker count
  uptimeSeconds: number;
  opsPerSecond: number; // NEW: throughput
  hitRate: number | null; // NEW: cache hit rate %
}

// ── System Health ─────────────────────────────────────────────────────────────

export interface StorageHealth {
  // NEW: split by media type
  audioBytes: number;
  audioReadable: string;
  imageBytes: number;
  imageReadable: string;
  totalBytes: number;
  totalReadable: string;
  velocity: StorageVelocity; // NEW: overall storage growth forecast
  b2Status: B2Stats | null;
  cloudinary: CloudinaryStats | null;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface TrackStatus {
  ready: number;
  failed: number;
  pending: number;
  processing: number;
}

export interface SystemHealthData {
  storage: StorageHealth;
  queue: QueueStats;
  trackStatus: TrackStatus;
  redis: {
    queueWorker: RedisWorkerInfo; // NEW: replaces old `memory` string
    upstash: UpstashStats | null;
  };
}

// ── Top Lists ─────────────────────────────────────────────────────────────────

export interface TopTrack {
  _id: string;
  title: string;
  coverImage: string;
  playCount: number;
  artist: {
    _id: string;
    name: string;
    avatar?: string;
  };
}

export interface TopArtist {
  _id: string;
  name: string;
  avatar: string;
  playCount: number;
}

// ── Root DTO ──────────────────────────────────────────────────────────────────

export interface DashboardData {
  overview: {
    users: StatItem;
    tracks: StatItem;
    albums: StatItem;
    plays: StatItem;
    activeUsers24h: number;
  };
  systemHealth: SystemHealthData;
  charts: {
    userGrowth: ChartDashbordDataPoint[];
    trackGrowth: ChartDashbordDataPoint[];
  };
  topLists: {
    topTracks: TopTrack[];
    topArtists: TopArtist[];
  };
}

// NEW: _meta carries SWR state from backend
export interface DashboardMeta {
  isStale: boolean;
}

export interface DashboardData {
  overview: {
    users: StatItem;
    tracks: StatItem;
    albums: StatItem;
    plays: StatItem;
    activeUsers24h: number;
  };
  systemHealth: SystemHealthData;
  charts: {
    userGrowth: ChartDashbordDataPoint[];
    trackGrowth: ChartDashbordDataPoint[];
  };
  topLists: {
    topTracks: TopTrack[];
    topArtists: TopArtist[];
  };
  _meta: DashboardMeta; // NEW: SWR staleness flag
}

// API wrapper (JSend)
export interface DashboardResponse {
  status: string;
  data: DashboardData;
}

// Compatibility re-exports
export type { DashboardRange } from "../schemas/dashboard.schema";
