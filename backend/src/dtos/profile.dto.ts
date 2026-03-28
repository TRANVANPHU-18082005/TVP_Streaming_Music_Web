// src/modules/profile/profile.dto.ts

export interface AnalyticsDTO {
  date: string; // Định dạng YYYY-MM-DD
  count: number;
}

export interface LikedContentDTO {
  id: string;
  title: string;
  slug: string;
  coverImage: string;
  artistName?: string;
  type: "track" | "album" | "playlist";
}

export interface ProfileDashboardDTO {
  analytics: AnalyticsDTO[];
  playlists: any[]; // Có thể dùng PlaylistDTO nếu Phú đã có
  library: {
    tracks: LikedContentDTO[];
    albums: LikedContentDTO[];
  };
}
