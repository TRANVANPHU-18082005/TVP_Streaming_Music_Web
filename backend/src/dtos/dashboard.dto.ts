/**
 * dashboard.dto.ts (Extended)
 *
 * Thêm các field mới:
 *   - StorageBreakdown: tách audio/image bytes
 *   - StorageVelocity: tốc độ tăng trưởng & dự báo
 *   - RedisWorkerInfo: memory, connectedClients, hitRate
 *   - DashboardMeta: isStale (SWR indicator)
 */

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────────────────────────────────────
export interface StorageVelocity {
  avgBytesPerDay: number;
  avgReadablePerDay: string; // e.g. "42.3 MB"
  daysUntilFull: number | null;
  projectedFullDate: string | null; // "yyyy-MM-dd" hoặc null
}

export interface CloudinaryFormatted {
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
  velocity: StorageVelocity;
}

export interface StorageHealth {
  // 🆕 Tách biệt audio vs image
  audioBytes: number;
  audioReadable: string;
  imageBytes: number;
  imageReadable: string;
  totalBytes: number;
  totalReadable: string;
  // 🆕 Storage velocity
  velocity: StorageVelocity;
  // External
  b2Status: unknown | null;
  cloudinary: CloudinaryFormatted | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// REDIS
// ─────────────────────────────────────────────────────────────────────────────
export interface RedisWorkerInfo {
  memory: string; // e.g. "128.5M"
  connectedClients: number; // 🆕 Số worker đang kết nối
  uptimeSeconds: number;
  opsPerSecond: number; // 🆕 Throughput hiện tại
  hitRate: number | null; // 🆕 Cache hit rate (%)
}

export interface UpstashInfo {
  dailyRequests: number;
  monthlyRequests: number;
  dataSize: number;
  dataSizeReadable: string;
}

export interface RedisHealth {
  queueWorker: RedisWorkerInfo; // 🆕 Thay thế field "redis.memory" cũ
  upstash: UpstashInfo | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE
// ─────────────────────────────────────────────────────────────────────────────
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM HEALTH
// ─────────────────────────────────────────────────────────────────────────────
export interface SystemHealth {
  storage: StorageHealth;
  queue: QueueStats;
  trackStatus: Record<"ready" | "failed" | "pending" | "processing", number>;
  redis: RedisHealth;
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
export interface MetricWithGrowth {
  value: number;
  growth: number; // % so với period trước
}

export interface Overview {
  users: MetricWithGrowth;
  tracks: MetricWithGrowth;
  albums: MetricWithGrowth;
  plays: MetricWithGrowth;
  activeUsers24h: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHARTS
// ─────────────────────────────────────────────────────────────────────────────
export interface ChartPoint {
  _id: string; // "yyyy-MM-dd"
  count: number;
}

export interface Charts {
  userGrowth: ChartPoint[];
  trackGrowth: ChartPoint[];
}

// ─────────────────────────────────────────────────────────────────────────────
// TOP LISTS
// ─────────────────────────────────────────────────────────────────────────────
export interface TopTrack {
  _id: string;
  title: string;
  coverImage: string;
  playCount: number;
  artist: { name: string; avatar: string };
}

export interface TopArtist {
  _id: string;
  name: string;
  avatar: string;
  playCount: number;
}

export interface TopLists {
  topTracks: TopTrack[];
  topArtists: TopArtist[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT DTO
// ─────────────────────────────────────────────────────────────────────────────
export interface DashboardData {
  overview: Overview;
  systemHealth: SystemHealth;
  charts: Charts;
  topLists: TopLists;
}

/** Response shape từ getDashboardData (thêm _meta cho SWR) */
export interface DashboardResponse extends DashboardData {
  _meta: {
    isStale: boolean; // true = đang serve stale data, revalidation đang chạy ngầm
  };
}
export interface ChartData {
  _id: string; // Date "YYYY-MM-DD"
  count: number;
}
