// src/config/constants.ts

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
