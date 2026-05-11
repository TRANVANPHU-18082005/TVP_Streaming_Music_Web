// features/analytics/types/index.ts

import { ChartTrack } from "@/features/track/types";


// ── Track shapes ──────────────────────────────────────────────────────────────

// Ranked track used in realtime/top lists
export interface AnalyticsRankedTrack {
  _id: string;
  title: string;
  coverImage: string;
  artist?: { _id: string; name: string } | null;
  score: number;
}

/**
 * Shape từ populateTracks() trong analytics.service.ts (flat object).
 * Không có wrapper { track, score } — artist + score đều ở top level.
 */

// ── Geo ───────────────────────────────────────────────────────────────────────

export interface GeoLocation {
  id: string; // "VN"
  value: number; // 150
  name?: string;
}

// ── Root stats shape (matches buildLiveStats in socket.ts) ────────────────────

export interface RealtimeStats {
  // From analyticsService.getStats()
  activeUsers: number; // authenticated users online
  activeGuests: number; // guest_ users online (NEW)
  nowListening: ChartTrack[]; // top 5 tracks being listened RIGHT NOW
  trending: ChartTrack[]; // top 5 in current hour window
  geoData: GeoLocation[];

  // Socket-level (appended by buildLiveStats)
  activeNow: number; // total socket connections
  listeningNow: number; // sockets in any track: room
}

// ── API wrapper ───────────────────────────────────────────────────────────────

export interface AnalyticsResponse {
  success: true;
  data: RealtimeStats;
}
