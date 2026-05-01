// src/config/env.ts

export const env = {
  API_URL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
  APP_NAME: import.meta.env.VITE_APP_NAME || "Music App",
  NODE_ENV: import.meta.env.NODE_ENV || "development",
  CDN_DOMAIN: import.meta.env.CDN_DOMAIN || "https://cdn.tvpmusic.site",
  // Cấu hình upload (nếu cần check size ở frontend)
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
};
