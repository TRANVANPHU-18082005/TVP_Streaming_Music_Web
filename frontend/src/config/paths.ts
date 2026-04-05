// src/config/paths.ts

import { Verified } from "lucide-react";

export const AUTH_PATHS = {
  LOGIN: "/login",
  REGISTER: "/register",
  LOGOUT: "/logout",
  VERIFY_OTP: "/verify-otp",
  FORGOT_PASSWORD: "/forgot-password",
  AUTH_GOOGLE: "/auth/google",
  FORCE_CHANGE_PASSWORD: "/force-change-password",
  RESET_PASSWORD: (token: string) => `/reset-password/${token}`,
} as const;
export const CLIENT_PATHS = {
  CLIENT: "/",
  HOME: "/",
  SONGS: "users",
  ARTISTS: "artists",
  ALBUMS: "albums",
  PLAYLISTS: "playlists",
  GENRES: "genres",
  GENRE_DETAIL: (slug: string) => `/genres/${slug}`, // Hàm tạo link động
  PLAYLIST_DETAIL: (slug: string) => `/playlists/${slug}`, // Hàm tạo link động
  ALBUM_DETAIL: (slug: string) => `/albums/${slug}`, // Hàm tạo link động
  ARTIST_DETAIL: (slug: string) => `/artists/${slug}`, // Hàm tạo link động
  BECOME_ARTIST: "become-artist",
  SEARCH: "search",
  BROWSE: "browse",
  SETTINGS: "settings",
  CLAIM_PROFILE: "claim-profile",
  CHART_TOP: "chart-top",
  // Track
  TRACK_DETAIL: (id: string) => `/tracks/${id}`, // Hàm tạo link động
  // User
  PROFILE: "/profile",
} as const;
export const ADMIN_PATHS = {
  ADMIN: "/admin",
  USERS: "users",
  SONGS: "songs",
  VERIFY_ARTIST: "verify-artist",
  ARTISTS: "artists",
  ALBUMS: "albums",
  PLAYLISTS: "playlists",
  ANALYTICS: "analytics",
  DASHBOARD: "/",
  GENRES: "genres",
  VIDEO_MOOD: "video-mood",
  SETTINGS: "settings",
  // Track
  UPLOAD: "upload",
} as const;
