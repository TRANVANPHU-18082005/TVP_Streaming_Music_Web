// features/analytics/types/index.ts

// ── Track shapes ──────────────────────────────────────────────────────────────

export interface TrackShort {
  _id: string;
  title: string;
  coverImage: string;
  artist: {
    _id: string;
    name: string;
    avatar?: string;
  };
}

/**
 * Shape từ populateTracks() trong analytics.service.ts (flat object).
 * Không có wrapper { track, score } — artist + score đều ở top level.
 */
export interface RankedTrack {
  _id: string;
  title: string;
  coverImage: string;
  artist: {
    _id: string;
    name: string;
    avatar?: string;
  };
  score: number;
}

// ── Geo ───────────────────────────────────────────────────────────────────────

export interface GeoLocation {
  id: string; // "VN"
  value: number; // 150
}

// ── Root stats shape (matches buildLiveStats in socket.ts) ────────────────────

export interface RealtimeStats {
  // From analyticsService.getStats()
  activeUsers: number; // authenticated users online
  activeGuests: number; // guest_ users online (NEW)
  nowListening: RankedTrack[]; // top 5 tracks being listened RIGHT NOW
  trending: RankedTrack[]; // top 5 in current hour window
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
