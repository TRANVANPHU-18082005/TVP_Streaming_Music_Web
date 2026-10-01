export interface AnalyticsRankedTrack {
  _id: string;
  title: string;
  coverImage: string;
  artist?: { _id: string; name: string; avatar?: string } | null;
  score: number;
}

export interface GeoLocation {
  id: string;
  value: number;
  name?: string;
}

export interface RealtimeStats {
  activeUsers: number;
  activeGuests: number;
  listeningNow: number;
  playsThisHour: number;
  nowListening: AnalyticsRankedTrack[];
  trending: AnalyticsRankedTrack[];
  geoData: GeoLocation[];
  snapshotAt: string;
}

export interface AnalyticsResponse {
  success: true;
  data: RealtimeStats;
}
