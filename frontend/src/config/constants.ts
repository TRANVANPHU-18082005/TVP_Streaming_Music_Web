// src/config/constants.ts

export const STORAGE_KEYS = {
  ACCESS_TOKEN: "accessToken",
  REFRESH_TOKEN: "refreshToken",
  USER_INFO: "userInfo",
  THEME: "theme",
} as const;

export const APP_CONFIG = {
  PAGINATION_LIMIT: 4,
  UPLOAD_MAX_SIZE: 50 * 1024 * 1024, // 50MB
  API_TIMEOUT: 10000,
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

export interface AmbientTheme {
  id: ThemeId;
  name: string;
  sub: string;
  /** orbs in light mode */
  light: AmbientPalette;
  /** orbs in dark mode */
  dark: AmbientPalette;
}

export interface AmbientOrb {
  color: string;
  x: string | number;
  y: string | number;
  w: number;
  blur: number;
  op: number;
}

export interface AmbientPalette {
  /** page background fill */
  bg: string;
  orbs: AmbientOrb[];
  /** [from-color, mid-color] for aurora hero gradient */
  aurora: [string, string];
  /** bottom vignette color */
  vignette: string;
}
export const AMBIENT_THEMES: AmbientTheme[] = [
  // ── 1. Original — Electronic / Dark ──────────────────────────────────────
  {
    id: "obsidian",
    name: "Obsidian Void",
    sub: "Electronic · Original",
    light: {
      bg: "#f4f3ff",
      orbs: [
        { color: "#7c6fe0", x: "-10%", y: "-15%", w: 640, blur: 90, op: 0.22 },
        { color: "#c084fc", x: "72%", y: "-5%", w: 520, blur: 80, op: 0.16 },
        { color: "#38bdf8", x: "40%", y: "70%", w: 400, blur: 70, op: 0.12 },
        { color: "#f0abfc", x: "-5%", y: "65%", w: 280, blur: 60, op: 0.1 },
      ],
      aurora: ["hsl(255 80% 68% / 0.07)", "hsl(318 75% 65% / 0.04)"],
      vignette: "hsl(var(--background))",
    },
    dark: {
      bg: "hsl(228 32% 4%)",
      orbs: [
        { color: "#6d28d9", x: "-10%", y: "-15%", w: 640, blur: 120, op: 0.32 },
        { color: "#9333ea", x: "72%", y: "-5%", w: 520, blur: 100, op: 0.22 },
        { color: "#0891b2", x: "40%", y: "70%", w: 400, blur: 90, op: 0.18 },
        { color: "#d946ef", x: "-5%", y: "65%", w: 280, blur: 80, op: 0.15 },
      ],
      aurora: ["hsl(255 80% 68% / 0.14)", "hsl(318 75% 65% / 0.09)"],
      vignette: "hsl(228 32% 4%)",
    },
  },

  // ── 2. Tokyo — Japan / City Pop / Lo-fi ──────────────────────────────────
  {
    id: "tokyo",
    name: "Tokyo Neon",
    sub: "Japan · City Pop / Lo-fi",
    light: {
      bg: "#fff1f8",
      orbs: [
        { color: "#ec4899", x: "-8%", y: "-10%", w: 600, blur: 90, op: 0.2 },
        { color: "#f97316", x: "70%", y: "5%", w: 480, blur: 75, op: 0.15 },
        { color: "#a855f7", x: "38%", y: "68%", w: 380, blur: 70, op: 0.12 },
        { color: "#fbbf24", x: "-5%", y: "70%", w: 260, blur: 55, op: 0.1 },
      ],
      aurora: ["hsl(330 80% 65% / 0.08)", "hsl(25 90% 65% / 0.05)"],
      vignette: "#fff1f8",
    },
    dark: {
      bg: "#0a0510",
      orbs: [
        { color: "#be185d", x: "-8%", y: "-10%", w: 600, blur: 110, op: 0.35 },
        { color: "#c2410c", x: "70%", y: "5%", w: 480, blur: 95, op: 0.25 },
        { color: "#7e22ce", x: "38%", y: "68%", w: 380, blur: 85, op: 0.2 },
        { color: "#b45309", x: "-5%", y: "70%", w: 260, blur: 70, op: 0.14 },
      ],
      aurora: ["hsl(330 80% 55% / 0.20)", "hsl(25 90% 55% / 0.12)"],
      vignette: "#0a0510",
    },
  },

  // ── 3. Sahara — North Africa / Desert Blues ───────────────────────────────
  {
    id: "sahara",
    name: "Sahara Dusk",
    sub: "North Africa · Desert Blues",
    light: {
      bg: "#fdf6ec",
      orbs: [
        { color: "#f59e0b", x: "-5%", y: "-15%", w: 620, blur: 90, op: 0.22 },
        { color: "#ef4444", x: "68%", y: "-5%", w: 500, blur: 80, op: 0.16 },
        { color: "#d97706", x: "35%", y: "65%", w: 380, blur: 70, op: 0.13 },
        { color: "#dc2626", x: "-5%", y: "60%", w: 260, blur: 60, op: 0.1 },
      ],
      aurora: ["hsl(38 90% 60% / 0.08)", "hsl(0 80% 60% / 0.06)"],
      vignette: "#fdf6ec",
    },
    dark: {
      bg: "#0c0700",
      orbs: [
        { color: "#b45309", x: "-5%", y: "-15%", w: 620, blur: 120, op: 0.38 },
        { color: "#991b1b", x: "68%", y: "-5%", w: 500, blur: 100, op: 0.28 },
        { color: "#92400e", x: "35%", y: "65%", w: 380, blur: 90, op: 0.22 },
        { color: "#7f1d1d", x: "-5%", y: "60%", w: 260, blur: 75, op: 0.16 },
      ],
      aurora: ["hsl(38 90% 45% / 0.22)", "hsl(0 80% 40% / 0.14)"],
      vignette: "#0c0700",
    },
  },

  // ── 4. Amazon — Brasil / Tropical / Bossa Nova ───────────────────────────
  {
    id: "amazon",
    name: "Amazon Emerald",
    sub: "Brasil · Tropical / Bossa Nova",
    light: {
      bg: "#f0fdf4",
      orbs: [
        { color: "#16a34a", x: "-10%", y: "-10%", w: 600, blur: 90, op: 0.2 },
        { color: "#eab308", x: "70%", y: "-5%", w: 480, blur: 80, op: 0.15 },
        { color: "#0d9488", x: "38%", y: "68%", w: 370, blur: 70, op: 0.13 },
        { color: "#22c55e", x: "-5%", y: "65%", w: 260, blur: 60, op: 0.1 },
      ],
      aurora: ["hsl(140 70% 45% / 0.09)", "hsl(50 90% 55% / 0.06)"],
      vignette: "#f0fdf4",
    },
    dark: {
      bg: "#020a04",
      orbs: [
        { color: "#14532d", x: "-10%", y: "-10%", w: 600, blur: 120, op: 0.4 },
        { color: "#713f12", x: "70%", y: "-5%", w: 480, blur: 100, op: 0.28 },
        { color: "#134e4a", x: "38%", y: "68%", w: 370, blur: 88, op: 0.22 },
        { color: "#166534", x: "-5%", y: "65%", w: 260, blur: 72, op: 0.18 },
      ],
      aurora: ["hsl(140 70% 30% / 0.24)", "hsl(50 90% 40% / 0.14)"],
      vignette: "#020a04",
    },
  },

  // ── 5. Nordic — Scandinavia / Post-rock / Ambient ─────────────────────────
  {
    id: "nordic",
    name: "Nordic Aurora",
    sub: "Scandinavia · Post-rock / Ambient",
    light: {
      bg: "#f0f9ff",
      orbs: [
        { color: "#0284c7", x: "-8%", y: "-12%", w: 600, blur: 90, op: 0.2 },
        { color: "#06b6d4", x: "70%", y: "-5%", w: 480, blur: 80, op: 0.16 },
        { color: "#818cf8", x: "38%", y: "68%", w: 370, blur: 70, op: 0.12 },
        { color: "#67e8f9", x: "-5%", y: "65%", w: 260, blur: 60, op: 0.1 },
      ],
      aurora: ["hsl(200 90% 55% / 0.08)", "hsl(186 92% 52% / 0.06)"],
      vignette: "#f0f9ff",
    },
    dark: {
      bg: "#020810",
      orbs: [
        { color: "#075985", x: "-8%", y: "-12%", w: 600, blur: 120, op: 0.38 },
        { color: "#0e7490", x: "70%", y: "-5%", w: 480, blur: 100, op: 0.26 },
        { color: "#3730a3", x: "38%", y: "68%", w: 370, blur: 85, op: 0.2 },
        { color: "#164e63", x: "-5%", y: "65%", w: 260, blur: 72, op: 0.16 },
      ],
      aurora: ["hsl(200 90% 40% / 0.22)", "hsl(186 92% 38% / 0.13)"],
      vignette: "#020810",
    },
  },

  // ── 6. India — Classical / Bollywood ─────────────────────────────────────
  {
    id: "india",
    name: "Raga Twilight",
    sub: "India · Classical / Bollywood",
    light: {
      bg: "#fff7ed",
      orbs: [
        { color: "#ea580c", x: "-8%", y: "-12%", w: 600, blur: 88, op: 0.22 },
        { color: "#d97706", x: "68%", y: "-5%", w: 480, blur: 80, op: 0.18 },
        { color: "#dc2626", x: "35%", y: "68%", w: 370, blur: 70, op: 0.13 },
        { color: "#a16207", x: "-5%", y: "65%", w: 250, blur: 58, op: 0.1 },
      ],
      aurora: ["hsl(22 95% 55% / 0.09)", "hsl(38 92% 52% / 0.06)"],
      vignette: "#fff7ed",
    },
    dark: {
      bg: "#0e0500",
      orbs: [
        { color: "#9a3412", x: "-8%", y: "-12%", w: 600, blur: 115, op: 0.4 },
        { color: "#92400e", x: "68%", y: "-5%", w: 480, blur: 100, op: 0.3 },
        { color: "#991b1b", x: "35%", y: "68%", w: 370, blur: 88, op: 0.22 },
        { color: "#78350f", x: "-5%", y: "65%", w: 250, blur: 70, op: 0.16 },
      ],
      aurora: ["hsl(22 95% 40% / 0.24)", "hsl(38 92% 38% / 0.14)"],
      vignette: "#0e0500",
    },
  },

  // ── 7. Harlem — USA / Jazz / Soul / R&B ──────────────────────────────────
  {
    id: "harlem",
    name: "Harlem Midnight",
    sub: "USA · Jazz / Soul / R&B",
    light: {
      bg: "#fafaf9",
      orbs: [
        { color: "#78716c", x: "-8%", y: "-12%", w: 580, blur: 90, op: 0.18 },
        { color: "#d97706", x: "68%", y: "-5%", w: 460, blur: 78, op: 0.16 },
        { color: "#a16207", x: "35%", y: "68%", w: 360, blur: 68, op: 0.12 },
        { color: "#57534e", x: "-5%", y: "65%", w: 240, blur: 58, op: 0.09 },
      ],
      aurora: ["hsl(30 15% 55% / 0.07)", "hsl(38 90% 52% / 0.05)"],
      vignette: "#fafaf9",
    },
    dark: {
      bg: "#09090a",
      orbs: [
        { color: "#44403c", x: "-8%", y: "-12%", w: 580, blur: 115, op: 0.5 },
        { color: "#92400e", x: "68%", y: "-5%", w: 460, blur: 100, op: 0.32 },
        { color: "#78350f", x: "35%", y: "68%", w: 360, blur: 85, op: 0.22 },
        { color: "#292524", x: "-5%", y: "65%", w: 240, blur: 72, op: 0.3 },
      ],
      aurora: ["hsl(30 15% 30% / 0.28)", "hsl(38 90% 35% / 0.16)"],
      vignette: "#09090a",
    },
  },

  // ── 8. Seoul — Korea / K-pop / Synth ─────────────────────────────────────
  {
    id: "seoul",
    name: "Seoul Digital",
    sub: "Korea · K-pop / Synth",
    light: {
      bg: "#fdf4ff",
      orbs: [
        { color: "#a855f7", x: "-8%", y: "-10%", w: 600, blur: 88, op: 0.2 },
        { color: "#ec4899", x: "70%", y: "-5%", w: 480, blur: 78, op: 0.16 },
        { color: "#06b6d4", x: "38%", y: "68%", w: 370, blur: 68, op: 0.12 },
        { color: "#c026d3", x: "-5%", y: "65%", w: 250, blur: 58, op: 0.1 },
      ],
      aurora: ["hsl(270 80% 65% / 0.08)", "hsl(330 80% 65% / 0.06)"],
      vignette: "#fdf4ff",
    },
    dark: {
      bg: "#07030d",
      orbs: [
        { color: "#7e22ce", x: "-8%", y: "-10%", w: 600, blur: 115, op: 0.36 },
        { color: "#9d174d", x: "70%", y: "-5%", w: 480, blur: 98, op: 0.26 },
        { color: "#0e7490", x: "38%", y: "68%", w: 370, blur: 85, op: 0.2 },
        { color: "#86198f", x: "-5%", y: "65%", w: 250, blur: 72, op: 0.16 },
      ],
      aurora: ["hsl(270 80% 50% / 0.22)", "hsl(330 80% 45% / 0.13)"],
      vignette: "#07030d",
    },
  },

  // ── 9. Havana — Cuba / Latin / Salsa ─────────────────────────────────────
  {
    id: "havana",
    name: "Havana Heat",
    sub: "Cuba · Salsa / Reggaeton",
    light: {
      bg: "#fff9f0",
      orbs: [
        { color: "#f59e0b", x: "-8%", y: "-12%", w: 600, blur: 88, op: 0.2 },
        { color: "#16a34a", x: "70%", y: "-5%", w: 480, blur: 78, op: 0.15 },
        { color: "#ef4444", x: "38%", y: "68%", w: 370, blur: 68, op: 0.12 },
        { color: "#0d9488", x: "-5%", y: "65%", w: 250, blur: 58, op: 0.1 },
      ],
      aurora: ["hsl(38 92% 58% / 0.08)", "hsl(140 70% 45% / 0.06)"],
      vignette: "#fff9f0",
    },
    dark: {
      bg: "#0a0600",
      orbs: [
        { color: "#92400e", x: "-8%", y: "-12%", w: 600, blur: 115, op: 0.38 },
        { color: "#14532d", x: "70%", y: "-5%", w: 480, blur: 98, op: 0.26 },
        { color: "#991b1b", x: "38%", y: "68%", w: 370, blur: 85, op: 0.2 },
        { color: "#134e4a", x: "-5%", y: "65%", w: 250, blur: 72, op: 0.15 },
      ],
      aurora: ["hsl(38 92% 40% / 0.22)", "hsl(140 70% 30% / 0.14)"],
      vignette: "#0a0600",
    },
  },

  // ── 10. Arctic — UK / Iceland / Post-punk ────────────────────────────────
  {
    id: "arctic",
    name: "Arctic Monolith",
    sub: "UK / Iceland · Indie / Post-punk",
    light: {
      bg: "#f8f8f8",
      orbs: [
        { color: "#6b7280", x: "-8%", y: "-12%", w: 580, blur: 88, op: 0.18 },
        { color: "#4b5563", x: "70%", y: "-5%", w: 460, blur: 78, op: 0.14 },
        { color: "#374151", x: "38%", y: "68%", w: 360, blur: 68, op: 0.1 },
        { color: "#9ca3af", x: "-5%", y: "65%", w: 240, blur: 58, op: 0.09 },
      ],
      aurora: ["hsl(220 15% 55% / 0.07)", "hsl(220 15% 45% / 0.05)"],
      vignette: "#f8f8f8",
    },
    dark: {
      bg: "#0a0a0a",
      orbs: [
        { color: "#374151", x: "-8%", y: "-12%", w: 580, blur: 115, op: 0.55 },
        { color: "#1f2937", x: "70%", y: "-5%", w: 460, blur: 98, op: 0.45 },
        { color: "#111827", x: "38%", y: "68%", w: 360, blur: 85, op: 0.5 },
        { color: "#4b5563", x: "-5%", y: "65%", w: 240, blur: 72, op: 0.35 },
      ],
      aurora: ["hsl(220 15% 30% / 0.30)", "hsl(220 15% 20% / 0.20)"],
      vignette: "#0a0a0a",
    },
  },
];
