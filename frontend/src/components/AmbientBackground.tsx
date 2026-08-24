import { memo } from "react";
import { ThemeId } from "@/config/constants";

/**
 * @file AmbientBackground.tsx — Minimal single-tone page background (v5.0)
 *
 * REDESIGN PHILOSOPHY:
 * Spotify, Zing MP3, YouTube Music, Apple Music đều dùng cùng một pattern:
 * ─ Nền base: một màu duy nhất (dark: #0f0f0f, light: #f8f8f8)
 * ─ Accent tint: một màu chủ đạo duy nhất, opacity rất thấp (<8%)
 *   chỉ xuất hiện ở vùng hero phía trên
 * ─ Không có floating orbs, không có nhiều màu loạn, không có aurora
 * ─ Transition smooth khi scroll: gradient fade từ accent → base
 *
 * Kết quả: giao diện trông premium, sạch, dễ nhìn, nội dung là trọng tâm.
 */

interface AmbientBackgroundProps {
  /** Accent color chủ đạo của trang — chỉ 1 màu duy nhất */
  accentColor?: string;
  /** Tắt hoàn toàn accent (nền thuần) */
  noAccent?: boolean;
  /** Chiều cao vùng accent gradient (default: 45vh) */
  accentHeight?: string;
  /** Override opacity của accent (default: 0.06) */
  accentOpacity?: number;
}

export const AmbientBackground = memo(
  ({
    accentColor,
    noAccent = false,
    accentHeight = "45vh",
    accentOpacity = 0.06,
  }: AmbientBackgroundProps) => {
    // Accent color resolve: dùng CSS token nếu không truyền vào
    const accent = accentColor ?? "hsl(var(--primary))";

    return (
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden="true"
      >
        {/* ── 1. BASE BACKGROUND ─────────────────────────────────────────
            Màu nền base từ CSS token --background
            Light mode: trắng/xám nhạt  |  Dark mode: đen/xám tối
        ──────────────────────────────────────────────────────────────── */}
        <div className="absolute inset-0 bg-background" />

        {/* ── 2. HERO ACCENT TINT ────────────────────────────────────────
            Dải màu accent nhẹ duy nhất ở phần trên cùng trang.
            Opacity rất thấp (4–8%) — chỉ đủ để phân biệt header area.
            Spotify dùng chính xác pattern này: extract màu từ album art,
            blend nhẹ vào top của page, fade về nền.
        ──────────────────────────────────────────────────────────────── */}
        {!noAccent && (
          <div
            className="absolute inset-x-0 top-0 pointer-events-none"
            style={{
              height: accentHeight,
              background: `linear-gradient(
                180deg,
                color-mix(in srgb, ${accent} ${Math.round(accentOpacity * 100)}%, transparent) 0%,
                color-mix(in srgb, ${accent} ${Math.round(accentOpacity * 50)}%, transparent) 40%,
                transparent 100%
              )`,
            }}
          />
        )}

        {/* ── 3. GRAIN TEXTURE ───────────────────────────────────────────
            Noise rất nhẹ — tạo cảm giác depth/chất liệu, tránh flat.
            Spotify, Apple Music đều dùng grain overlay mức 2–3%.
        ──────────────────────────────────────────────────────────────── */}
        <div
          className="absolute inset-0 mix-blend-overlay pointer-events-none"
          style={{
            opacity: 0.022,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* ── 4. BOTTOM VIGNETTE ─────────────────────────────────────────
            Fade nền tại vị trí player bar — giữ nội dung rõ ràng.
        ──────────────────────────────────────────────────────────────── */}
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-background to-transparent" />
      </div>
    );
  },
);
export const AnimatedBackground = () => (
  <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-[#07070a] via-[#0b1020] to-[#040405]">

    {/* Ánh sáng trung tâm */}
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08),transparent_65%)]" />

    {/* Blob trên phải */}
    <div className="absolute -top-20 -right-20 w-[60vw] h-[60vw] md:w-[32vw] md:h-[32vw] rounded-full bg-indigo-500/12 blur-[120px] animate-blob" />

    {/* Blob dưới trái */}
    <div className="absolute -bottom-20 -left-20 w-[60vw] h-[60vw] md:w-[32vw] md:h-[32vw] rounded-full bg-purple-500/10 blur-[120px] animate-blob animation-delay-2000" />

    {/* Blob nhỏ giữa */}
    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[35vw] h-[35vw] rounded-full bg-pink-400/6 blur-[140px] animate-pulse" />

    {/* Noise */}
    <div
      className="absolute inset-0 opacity-[0.03] pointer-events-none"
      style={{
        backgroundImage:
          "radial-gradient(rgba(255,255,255,0.15) 0.8px, transparent 0.8px)",
        backgroundSize: "8px 8px",
      }}
    />
    {/* Vignette tạo chiều sâu */}
    <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_45%,rgba(0,0,0,0.45)_100%)]" />
  </div>
);
AmbientBackground.displayName = "AmbientBackground";

// ─────────────────────────────────────────────────────────────────────────────
// THEMED VARIANT — giữ API cũ compatible với ThemeId
// Mỗi theme chỉ có 1 màu accent duy nhất (không còn multi-orb chaos)
// ─────────────────────────────────────────────────────────────────────────────

/** Map ThemeId → một màu accent duy nhất */
const THEME_ACCENT: Record<string, string> = {
  obsidian: "hsl(var(--primary))", // Violet — default brand
  tokyo: "hsl(340 85% 55%)", // Hot pink
  sahara: "hsl(30 90% 52%)", // Amber
  amazon: "hsl(152 65% 40%)", // Emerald
  nordic: "hsl(200 80% 52%)", // Ice blue
  india: "hsl(22 90% 52%)", // Deep orange
  harlem: "hsl(40 60% 48%)", // Warm gold
  seoul: "hsl(280 75% 60%)", // Purple
  havana: "hsl(45 88% 52%)", // Gold
  arctic: "hsl(220 15% 55%)", // Cool gray
};

interface ThemedAmbientBackgroundProps {
  themeId?: ThemeId;
  noAccent?: boolean;
}

/**
 * Wrapper giữ API cũ (themeId) nhưng dùng single-accent system mới.
 * Drop-in replacement cho component cũ — không cần đổi code ở caller.
 */
export const ThemedAmbientBackground = memo(
  ({ themeId = "obsidian", noAccent }: ThemedAmbientBackgroundProps) => {
    const accent = THEME_ACCENT[themeId] ?? THEME_ACCENT.obsidian;
    return (
      <AmbientBackground
        accentColor={accent}
        noAccent={noAccent}
        accentOpacity={0.07}
      />
    );
  },
);

ThemedAmbientBackground.displayName = "ThemedAmbientBackground";
