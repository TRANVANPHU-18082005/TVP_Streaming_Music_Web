// src/features/profile/types/index.ts

import { IAlbum } from "@/features/album";
import { IPlaylist } from "@/features/playlist";
import { ITrack } from "@/features/track/types"; // Đảm bảo đúng path

export interface AnalyticsData {
  date: string;
  count: number;
}
export interface recentlyPlayedData {
  _id: string;
  listenedAt: Date;
  title: string;
  slug: string;
  coverImage: string;
  duration: "$trackDetails.duration";
  artist: {
    _id: string;
    name: string;
    slug: string;
  };
}

export interface UserLibrary {
  tracks: ITrack[];
  albums: IAlbum[];
  playlists: IPlaylist[];
  topTracks: {
    data: ITrack[];
    meta: {
      totalItems: number;
      totalPages: number;
      currentPage: number;
      itemsPerPage: number;
    };
  }; // Thêm trường topTracks vào dashboard
}
export interface ProfileDashboard {
  analytics: AnalyticsData[];
  recentlyPlayed: ITrack[];
  library: UserLibrary;
}

export interface LikedContentParams {
  type: "track" | "album" | "playlist";
  page?: number;
  limit?: number;
}

export interface UpdateProfileInput {
  name?: string;
  bio?: string;
  avatar?: string | File;
}
