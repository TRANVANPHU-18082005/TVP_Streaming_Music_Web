// src/config/env.ts

const NODE_ENV = (import.meta.env.MODE || import.meta.env.NODE_ENV || "production") as string;

export const env = {
  API_URL: (import.meta.env.VITE_API_URL as string) || "https://tvp-backend.fly.dev/api",
  APP_NAME: (import.meta.env.VITE_APP_NAME as string) || "Music App",
  NODE_ENV,
  SOCKET_URL: (import.meta.env.VITE_SOCKET_URL as string) || "https://tvp-backend.fly.dev",
  CDN_DOMAIN: (import.meta.env.VITE_CDN_DOMAIN as string) || "https://cdn.tvpmusic.site",
  // Cấu hình upload (nếu cần check size ở frontend)
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
};

export const isDev = () => NODE_ENV === "development";
export const isProd = () => NODE_ENV === "production";

export const getApiBase = () => env.API_URL;

// Usage:
// - During development `npm run dev` Vite will load `.env.development` and `import.meta.env.MODE` === 'development'.
// - For production build `npm run build` Vite loads `.env.production` and `import.meta.env.MODE` === 'production'.
// Swap modes by setting the NODE_ENV/MODE when running or by using the appropriate .env files.
