// src/config/constants.ts

import { cn } from "@/components/ui/utils";

export const STORAGE_KEYS = {
  ACCESS_TOKEN: "accessToken",
  REFRESH_TOKEN: "refreshToken",
  USER_INFO: "userInfo",
  THEME: "theme",
} as const;

export const APP_CONFIG = {
  SELECTOR_LIMIT: 7,
  PAGINATION_LIMIT: 7,
  HOME_PAGE_LIMIT: 7,
  GRID_LIMIT: 6,
  UPLOAD_MAX_SIZE: 50 * 1024 * 1024, // 50MB
  API_TIMEOUT: 10000,
  VIRTUALIZER_LIMIT: 50,
} as const;

export const DEFAULT_GRID_META = {
  totalPages: 1,
  totalItems: 0,
  page: 1,
  pageSize: APP_CONFIG.GRID_LIMIT || 6,
} as const;
export const DEFAULT_PAGINATION_META = {
  totalPages: 1,
  totalItems: 0,
  page: 1,
  pageSize: APP_CONFIG.PAGINATION_LIMIT || 7,
} as const;
export const REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /(84|0[3|5|7|8|9])+([0-9]{8})\b/,
};
export const DEAFULT_APP = {
  IMG_URL:
    "https://res.cloudinary.com/dc5rfjnn5/image/upload/v1770807338/LOGO_o4n02n.png",
  COVER_URL:
    "https://res.cloudinary.com/dzcmadjl1/image/upload/v1700000000/default_cover.png",
  MOOD_VIDEO_DEFAULT_VALUES:
    "https://res.cloudinary.com/dc5rfjnn5/video/upload/v1776787911/mood_videos/mood-1776787906294.mp4",
};
export interface Country {
  label: string;
  value: string;
  flag: string;
}
// ─────────────────────────────────────────────────────────────────────────────
// SPRING PRESETS
// ─────────────────────────────────────────────────────────────────────────────

export const SP_GENTLE = {
  type: "spring",
  stiffness: 300,
  damping: 30,
} as const;
export const SP_SNAPPY = {
  type: "spring",
  stiffness: 440,
  damping: 28,
} as const;
export const SP_HERO = {
  type: "spring",
  stiffness: 260,
  damping: 26,
  mass: 0.9,
} as const;

// 🔥 Top quốc gia có nhiều nghệ sĩ nhất để ưu tiên hiển thị đầu danh sách
export const TOP_NATIONALITIES: Country[] = [
  { label: "Việt Nam", value: "VN", flag: "🇻🇳" },
  { label: "Hoa Kỳ", value: "US", flag: "🇺🇸" },
  { label: "Hàn Quốc", value: "KR", flag: "🇰🇷" },
  { label: "Anh Quốc", value: "UK", flag: "🇬🇧" },
  { label: "Nhật Bản", value: "JP", flag: "🇯🇵" },
];

export const ALL_NATIONALITIES: Country[] = [
  ...TOP_NATIONALITIES,
  { label: "Trung Quốc", value: "CN", flag: "🇨🇳" },
  { label: "Thái Lan", value: "TH", flag: "🇹🇭" },
  { label: "Pháp", value: "FR", flag: "🇫🇷" },
  { label: "Đức", value: "DE", flag: "🇩🇪" },
  { label: "Canada", value: "CA", flag: "🇨🇦" },
  { label: "Úc", value: "AU", flag: "🇦🇺" },
  { label: "Brazil", value: "BR", flag: "🇧🇷" },
  { label: "Tây Ban Nha", value: "ES", flag: "🇪🇸" },
  { label: "Na Uy", value: "NO", flag: "🇳🇴" },
  { label: "Thụy Điển", value: "SE", flag: "🇸🇪" },
];

//bac
export type ThemeId =
  | "obsidian"
  | "tokyo"
  | "sahara"
  | "amazon"
  | "nordic"
  | "india"
  | "harlem"
  | "seoul"
  | "havana"
  | "arctic";

// ─────────────────────────────────────────────────────────────────────────────
// ContextMenu
// ─────────────────────────────────────────────────────────────────────────────

export const MENU_ITEM_CLS =
  "flex items-center gap-3 px-3 py-[7px] rounded-lg text-[13px] font-medium cursor-pointer select-none " +
  "text-[hsl(var(--foreground)/0.85)] hover:text-[hsl(var(--foreground))] " +
  "hover:bg-[hsl(var(--muted)/0.7)] focus:bg-[hsl(var(--muted)/0.7)] " +
  "transition-colors duration-100 outline-none";

export const ICON_CLS = "size-4 shrink-0 text-[hsl(var(--muted-foreground))]";
/** Module-scoped grid constant — zero allocation per render */
// Cùng với hàm staggerDelay, đây là 2 hằng số được chia sẻ giữa nhiều trang có layout lưới (Albums, Artists, Genres) để đảm bảo nhất quán và tối ưu hiệu suất (zero allocation).
export const GRID_LAYOUT = cn(
  "grid",
  "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7",
  "gap-x-4 gap-y-8 sm:gap-x-5 sm:gap-y-10",
);
export const staggerDelay = (i: number) => Math.min(i * 45, 700);
