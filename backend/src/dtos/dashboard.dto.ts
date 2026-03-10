export interface GrowthData {
  value: number;
  growth: number; // Percentage (e.g., 15.5)
}

export interface ChartData {
  _id: string; // Date "YYYY-MM-DD"
  count: number;
}

// --- System Health Types ---
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

// ... Các interface cũ

export interface CloudinaryStats {
  plan: string;
  bandwidth: {
    usage: number;
    usageReadable: string; // 🔥 MỚI: "350 MB"
    limit: number;
    limitReadable: string; // 🔥 MỚI: "25 GB"
    percent: number; // 🔥 MỚI: 1.4%
  };
  storage: {
    usage: number;
    usageReadable: string; // 🔥 MỚI
    limit: number;
  };
}

export interface UpstashStats {
  dailyRequests: number;
  monthlyRequests: number;
  dataSize: number;
  dataSizeReadable: string; // 🔥 MỚI: "5 MB"
}

export interface B2Stats {
  status: "online" | "offline";
  bucketName: string;
  bucketType: string; // 'allPublic' | 'allPrivate'
}

export interface SystemHealthData {
  storage: {
    dbTotalBytes: number;
    dbReadable: string; // VD: "15.5 GB"
    b2Status: B2Stats | null;
    cloudinary: CloudinaryStats | null;
  };
  queue: QueueStats;
  trackStatus: {
    ready: number;
    failed: number;
    pending: number;
    processing: number;
  };
  redis: {
    memory: string; // Raw memory usage
    upstash: UpstashStats | null;
  };
}

// --- Main Response Type ---
export interface DashboardData {
  overview: {
    users: GrowthData;
    tracks: GrowthData;
    albums: GrowthData;
    plays: GrowthData;
    activeUsers24h: number;
  };
  systemHealth: SystemHealthData; // 🔥 New Field
  charts: {
    userGrowth: ChartData[];
    trackGrowth: ChartData[];
  };
  topLists: {
    topTracks: Array<{
      _id: string;
      title: string;
      coverImage: string;
      playCount: number;
      artist: { name: string; avatar: string };
    }>;
    topArtists: Array<{
      _id: string;
      name: string;
      avatar: string;
      totalPlays: number;
    }>;
  };
}
