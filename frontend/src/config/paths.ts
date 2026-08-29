// src/config/paths.ts

export const AUTH_PATHS = {
  LOGIN: "/login",
  REGISTER: "/register",
  LOGOUT: "/logout",
  VERIFY_OTP: "/verify-otp",
  FORGOT_PASSWORD: "/forgot-password",
  AUTH_GOOGLE: "/auth/google/callback",
  AUTH_FACEBOOK: "/auth/facebook/callback",
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
  TRACK_HISTORY: "/tracks/history",
  // Track
  TRACK_DETAIL: (id: string) => `/tracks/${id}`, // Hàm tạo link động
  // User
  PROFILE: "/profile",
  FOR_ME: "for-me",
  SHORTS: "shorts",
  MASHUPS_FEED: "mashups/feed",
  MASHUPS_CREATE: "mashups/create",
  MASHUPS_DETAIL: (id: string) => `mashups/${id}`,
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
  SHORTS: "shorts",
  MASHUPS: "mashups",
} as const;
