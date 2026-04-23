/**
 * @file loaders.tsx
 * @description Production-grade Music Loader Components — Soundwave Design System v3
 *
 * Architecture:
 *   - Single <style> injection via useEffect + ref guard (no module-scope DOM side-effects)
 *   - Deterministic animation durations (no Math.random — stable across SSR/hydration)
 *   - Full dark/light mode via CSS custom properties (mirrors index.css :root / .dark)
 *   - Skin-aware: reads --primary, --wave-1/2/3, --brand-glow from active skin
 *   - WCAG-friendly: aria-live, role="status", prefers-reduced-motion support
 *   - Zero external deps beyond React + lucide-react
 *
 * Exports:
 *   EqualizerLoader  — EQ-style animated bars
 *   VinylLoader      — Spinning vinyl record with halo glow
 *   PulseLoader      — Concentric pulsing rings with music icon
 *   WaveformLoader   — Horizontal sine-wave cinematic bars
 *   RadioLoader      — Signal-broadcast rings (Connecting… state)
 *   SpinnerLoader    — Minimal arc spinner for inline/button states
 *   SkeletonLoader   — Track list / album card / banner skeletons
 *   ProgressBar      — Seekable playback progress bar
 *   MusicLoader      — Compound picker (single entry-point)
 *   LoaderShowcase   — Interactive dev/Storybook showcase
 */

import React, {
  memo,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useState,
  type FC,
  type ReactNode,
} from "react";
import { Music, Radio } from "lucide-react";

// ─────────────────────────────────────────────
// 1. STYLE INJECTION
// ─────────────────────────────────────────────

const STYLE_ID = "__sw-loaders-v3__";

/**
 * All keyframes + utility classes wired to Soundwave CSS custom properties.
 * Injected once into <head>; safe in SSR (guard on typeof document).
 *
 * Tokens consumed (from index.css :root / .dark):
 *   --primary, --primary-foreground
 *   --wave-1, --wave-2, --wave-3
 *   --brand-glow, --brand-500
 *   --muted, --muted-foreground
 *   --surface-3, --accent
 *   --card, --border
 *   --background
 *   --shadow-color
 *   --font-body
 *   --ease-snappy, --ease-spring, --ease-theme
 *   --duration-theme
 */
const LOADER_CSS = `
  /* ── Keyframes ─────────────────────────────────────────── */
  @keyframes sw-bar {
    0%,100% { height: 18%; opacity: .45; }
    50%      { height: 100%; opacity: 1;  }
  }
  @keyframes sw-vinyl {
    to { transform: rotate(360deg); }
  }
  @keyframes sw-pulse-ring {
    0%   { transform: scale(.88); opacity: .7; }
    50%  { transform: scale(1.08); opacity: .12; }
    100% { transform: scale(.88); opacity: .7; }
  }
  @keyframes sw-wave-bar {
    0%,100% { transform: scaleY(1);   opacity: 1;   }
    50%     { transform: scaleY(.28); opacity: .5;  }
  }
  @keyframes sw-float-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes sw-shimmer {
    from { background-position: -400% center; }
    to   { background-position:  400% center; }
  }
  @keyframes sw-glow-breathe {
    0%,100% {
      box-shadow:
        0 0 16px hsl(var(--brand-glow, 258 100% 66%) / .18),
        0 0 32px hsl(var(--brand-glow, 258 100% 66%) / .06);
    }
    50% {
      box-shadow:
        0 0 32px hsl(var(--brand-glow, 258 100% 66%) / .50),
        0 0 64px hsl(var(--brand-glow, 258 100% 66%) / .18);
    }
  }
  @keyframes sw-halo {
    0%,100% { opacity: 0; transform: scale(.96); }
    50%     { opacity: 1; transform: scale(1.04); }
  }
  @keyframes sw-spin {
    to { transform: rotate(360deg); }
  }

  /* ── Reduced-motion overrides ───────────────────────────── */
  @media (prefers-reduced-motion: reduce) {
    .sw-loader-root *,
    .sw-loader-root *::before,
    .sw-loader-root *::after {
      animation-duration:        .01ms !important;
      animation-iteration-count: 1     !important;
      transition-duration:       .01ms !important;
    }
  }

  /* ── Animation utility classes ──────────────────────────── */
  .sw-anim-bar {
    animation: sw-bar var(--_dur, 0.9s) ease-in-out infinite var(--_delay, 0s);
  }
  .sw-anim-vinyl {
    animation: sw-vinyl 3.8s linear infinite;
  }
  .sw-anim-vinyl.sw-paused,
  .sw-anim-vinyl[data-paused] {
    animation-play-state: paused;
  }
  .sw-anim-pulse {
    animation: sw-pulse-ring 2s ease-in-out infinite;
  }
  .sw-anim-wave {
    animation: sw-wave-bar var(--_dur, 1.2s) ease-in-out infinite var(--_delay, 0s);
  }
  .sw-anim-wave.sw-paused {
    animation-play-state: paused;
    transform: scaleY(.25);
  }
  .sw-anim-float-in {
    animation: sw-float-in .45s cubic-bezier(.16,1,.3,1) forwards;
  }
  .sw-anim-shimmer {
    background: linear-gradient(
      105deg,
      hsl(var(--muted, 220 20% 93%))      0%,
      hsl(var(--surface-3, 220 22% 91%)) 40%,
      hsl(var(--accent, 220 18% 90%))    50%,
      hsl(var(--surface-3, 220 22% 91%)) 60%,
      hsl(var(--muted, 220 20% 93%))    100%
    );
    background-size: 300% auto;
    animation: sw-shimmer 1.8s linear infinite;
  }
  .sw-anim-glow-breathe {
    animation: sw-glow-breathe 4s ease-in-out infinite;
  }
  .sw-anim-halo {
    animation: sw-halo 3.5s ease-in-out infinite;
  }
  .sw-anim-spin {
    animation: sw-spin .7s linear infinite;
  }

  /* ── Root wrapper ───────────────────────────────────────── */
  .sw-loader-root {
    font-family: var(--font-body, 'Inter', sans-serif);
    color: hsl(var(--foreground, 222 32% 8%));
    transition:
      background var(--duration-theme, 380ms) var(--ease-theme, cubic-bezier(.25,.46,.45,.94)),
      color       var(--duration-theme, 380ms) var(--ease-theme, cubic-bezier(.25,.46,.45,.94));
  }
  .sw-loader-root.sw-fullscreen {
    position: fixed; inset: 0; z-index: 9999;
    display: flex; align-items: center; justify-content: center;
    background: hsl(var(--background, 222 30% 96.5%));
  }
  .sw-loader-root.sw-inline {
    position: relative; width: 100%; height: 100%; min-height: 160px;
    display: flex; align-items: center; justify-content: center;
  }

  /* ── Glass card ─────────────────────────────────────────── */
  .sw-glass {
    background: hsl(var(--card, 0 0% 100%) / .82);
    backdrop-filter: blur(20px) saturate(160%);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    border: 1px solid hsl(var(--border, 220 18% 90%) / .55);
    border-radius: 24px;
    box-shadow:
      inset 0 1px 0 hsl(0 0% 100% / .10),
      0 4px 24px hsl(var(--shadow-color, 222 30% 15%) / .09);
    transition:
      background    var(--duration-theme, 380ms) var(--ease-theme, cubic-bezier(.25,.46,.45,.94)),
      border-color  var(--duration-theme, 380ms) var(--ease-theme, cubic-bezier(.25,.46,.45,.94)),
      box-shadow    var(--duration-theme, 380ms) var(--ease-theme, cubic-bezier(.25,.46,.45,.94));
  }
  .dark .sw-glass {
    background: hsl(var(--card, 228 30% 6%) / .52);
    backdrop-filter: blur(28px) saturate(200%);
    -webkit-backdrop-filter: blur(28px) saturate(200%);
    border-color: hsl(var(--border, 228 25% 11%) / .08);
    box-shadow:
      inset 0 1px 0 hsl(0 0% 100% / .06),
      0 0 0 1px hsl(var(--primary, 258 80% 74%) / .04),
      0 8px 32px hsl(var(--shadow-color, 228 40% 2%) / .38);
  }

  /* ── EQ bar ─────────────────────────────────────────────── */
  .sw-eq-bar {
    width: 4px;
    border-radius: 2px 2px 1px 1px;
    transform-origin: bottom center;
    will-change: height;
    transition: none; /* Override global theme transition */
  }
  .sw-eq-bar--solid    { background: hsl(var(--primary, 258 90% 56%)); }
  .sw-eq-bar--gradient {
    background: linear-gradient(
      to top,
      hsl(var(--wave-1, 258 88% 65%)),
      hsl(var(--wave-2, 320 76% 62%)) 60%,
      hsl(var(--wave-3, 188 90% 48%))
    );
  }

  /* ── Wave bar ───────────────────────────────────────────── */
  .sw-wave-bar {
    border-radius: 9999px;
    transform-origin: center;
    will-change: transform;
    transition: none;
    background: linear-gradient(
      to top,
      hsl(var(--wave-1, 258 88% 65%)),
      hsl(var(--wave-2, 320 76% 62%))
    );
  }

  /* ── Vinyl disc ─────────────────────────────────────────── */
  .sw-vinyl-disc {
    border-radius: 50%;
    background: radial-gradient(circle at center,
      hsl(228 28% 14%) 0%,    hsl(228 28% 14%) 13.5%,
      hsl(228 25% 22%) 14%,   hsl(228 28% 14%) 14.5%,
      hsl(228 22% 18%) 28%,   hsl(228 28% 13%) 28.5%,
      hsl(228 20% 16%) 44%,   hsl(228 28% 11%) 44.5%,
      hsl(228 22% 14%) 62%,   hsl(228 28% 10%) 62.5%,
      hsl(228 20% 13%) 80%,   hsl(228 25%  9%) 100%
    );
    box-shadow:
      0 0 0 2px hsl(0 0% 0% / .45),
      0 4px 24px hsl(0 0% 0% / .40),
      inset 0 0 60px hsl(0 0% 0% / .28);
    transition: none;
    position: relative;
  }
  /* Groove shimmer overlay */
  .sw-vinyl-disc::after {
    content: "";
    position: absolute; inset: 0;
    border-radius: 50%;
    background: conic-gradient(
      from 0deg,
      transparent 0deg,
      hsl(0 0% 100% / .04) 4deg,
      transparent 8deg,
      transparent 178deg,
      hsl(0 0% 100% / .03) 182deg,
      transparent 186deg
    );
    pointer-events: none;
  }

  /* ── Progress bar ───────────────────────────────────────── */
  .sw-progress-track {
    position: relative;
    height: 3px;
    border-radius: 9999px;
    background: hsl(var(--muted, 220 20% 93%));
    overflow: visible;
    cursor: pointer;
    transition: height 100ms var(--ease-snappy, cubic-bezier(.16,1,.3,1));
  }
  .sw-progress-track:hover { height: 5px; }
  /* Invisible hit area extension */
  .sw-progress-track::before {
    content: "";
    position: absolute;
    inset: -8px 0;
    border-radius: 9999px;
  }
  .sw-progress-fill {
    height: 100%;
    border-radius: 9999px;
    background: linear-gradient(
      90deg,
      hsl(var(--primary, 258 90% 56%)),
      hsl(var(--wave-1, 258 88% 65%)) 60%,
      hsl(var(--wave-2, 320 76% 62%))
    );
    position: relative;
    will-change: width;
    transition: width .08s linear;
  }
  .sw-progress-fill::after {
    content: "";
    position: absolute;
    right: -6px; top: 50%;
    transform: translateY(-50%) scale(0);
    width: 12px; height: 12px;
    border-radius: 50%;
    background: hsl(0 0% 100%);
    box-shadow:
      0 0 0 2px hsl(var(--brand-500, 258 90% 56%)),
      0 0 12px hsl(var(--brand-glow, 258 100% 66%) / .50);
    transition: transform 180ms var(--ease-spring, cubic-bezier(.34,1.56,.64,1));
    z-index: 10;
  }
  .sw-progress-track:hover .sw-progress-fill::after {
    transform: translateY(-50%) scale(1);
  }

  /* ── Loader label ───────────────────────────────────────── */
  .sw-loader-label {
    font-size: .6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .1em;
    color: hsl(var(--muted-foreground, 220 14% 48%));
    text-align: center;
    margin-top: 14px;
  }
`;

// ─────────────────────────────────────────────
// 2. STYLE INJECTION HOOK
// ─────────────────────────────────────────────

function useLoaderStyles(): void {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = LOADER_CSS;
    document.head.appendChild(el);
    // Never remove — other loader instances rely on it.
  }, []);
}

// ─────────────────────────────────────────────
// 3. SHARED TYPES & SIZE MAP
// ─────────────────────────────────────────────

export type LoaderSize = "sm" | "md" | "lg";
export type LoaderVariant = "default" | "gradient" | "brand";
export type LoaderKind =
  | "equalizer"
  | "vinyl"
  | "pulse"
  | "waveform"
  | "radio"
  | "spinner";

export interface LoaderProps {
  /** Render as fixed fullscreen overlay */
  fullscreen?: boolean;
  /** Label below the animation */
  text?: ReactNode;
  size?: LoaderSize;
  variant?: LoaderVariant;
  className?: string;
  /** Wrap in glass card (default: true) */
  glass?: boolean;
  /** ARIA live region politeness (default: "polite") */
  ariaLive?: "polite" | "assertive" | "off";
}

/**
 * Deterministic animation durations — no Math.random.
 * Stable across SSR/hydration, matches index.css --animate-bar-* values.
 */
const BAR_DURATIONS = [0.82, 1.08, 0.7, 0.95, 0.78, 1.15, 0.88] as const;
const BAR_DELAYS = [0, 0.09, 0.18, 0.13, 0.04, 0.22, 0.31] as const;

/**
 * Waveform envelope — bell curve shape for cinematic look.
 * Heights are normalised (0–1). Pre-computed, no random values.
 */
const WAVE_HEIGHTS = [
  0.4, 0.65, 0.85, 0.95, 0.8, 0.6, 0.9, 0.7, 0.5, 0.88, 0.75, 0.55, 0.4, 0.3,
  0.45, 0.72, 0.88, 0.6,
] as const;

const SIZE_MAP: Record<
  LoaderSize,
  {
    containerPx: number;
    barH: number;
    barW: number;
    waveBars: number;
    vinylPx: number;
    iconPx: number;
    gap: number;
    spinBorder: number;
  }
> = {
  sm: {
    containerPx: 40,
    barH: 22,
    barW: 3,
    waveBars: 10,
    vinylPx: 64,
    iconPx: 16,
    gap: 4,
    spinBorder: 2,
  },
  md: {
    containerPx: 64,
    barH: 36,
    barW: 4,
    waveBars: 14,
    vinylPx: 96,
    iconPx: 22,
    gap: 8,
    spinBorder: 2.5,
  },
  lg: {
    containerPx: 96,
    barH: 52,
    barW: 5,
    waveBars: 18,
    vinylPx: 128,
    iconPx: 28,
    gap: 12,
    spinBorder: 3,
  },
};

// ─────────────────────────────────────────────
// 4. BASE WRAPPER
// ─────────────────────────────────────────────

interface BaseProps extends LoaderProps {
  children: ReactNode;
}

const LoaderBase: FC<BaseProps> = memo(
  ({
    fullscreen,
    children,
    className = "",
    glass = true,
    ariaLive = "polite",
  }) => {
    useLoaderStyles();

    const inner = glass ? (
      <div className="sw-glass" style={{ padding: "2rem 2.5rem" }}>
        {children}
      </div>
    ) : (
      <div style={{ padding: "1.25rem" }}>{children}</div>
    );

    return (
      <div
        role="status"
        aria-live={ariaLive}
        className={`sw-loader-root ${fullscreen ? "sw-fullscreen" : "sw-inline"} ${className}`}
      >
        {inner}
      </div>
    );
  },
);
LoaderBase.displayName = "LoaderBase";

// ─────────────────────────────────────────────
// 5. SHARED LABEL
// ─────────────────────────────────────────────

const LoaderLabel: FC<{ text: ReactNode }> = memo(({ text }) => (
  <p
    className="sw-loader-label sw-anim-float-in"
    style={{ animationDelay: "0.18s" }}
  >
    {text}
  </p>
));
LoaderLabel.displayName = "LoaderLabel";

// ─────────────────────────────────────────────
// 6. EQUALIZER LOADER
// ─────────────────────────────────────────────

/**
 * EQ-style animated bars — classic music player loading state.
 *
 * - Deterministic durations (no hydration mismatch)
 * - gradient variant reads --wave-1/2/3 (skin-aware)
 * - transform-origin: bottom so bars grow upward
 */
export const EqualizerLoader: FC<LoaderProps> = memo(
  ({
    fullscreen,
    text = "Loading…",
    size = "md",
    variant = "gradient",
    glass = true,
    className,
    ariaLive,
  }) => {
    const { barH, barW, gap } = SIZE_MAP[size];
    const bars = size === "sm" ? 5 : 7;
    const barMod =
      variant === "gradient" ? "sw-eq-bar--gradient" : "sw-eq-bar--solid";

    return (
      <LoaderBase
        fullscreen={fullscreen}
        glass={glass}
        className={className}
        ariaLive={ariaLive}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              height: barH,
              gap: gap / 2,
            }}
          >
            {BAR_DURATIONS.slice(0, bars).map((dur, i) => (
              <span
                key={i}
                className={`sw-eq-bar ${barMod} sw-anim-bar`}
                style={
                  {
                    width: barW,
                    height: barH * 0.28,
                    "--_dur": `${dur}s`,
                    "--_delay": `${BAR_DELAYS[i]}s`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
          {text && <LoaderLabel text={text} />}
        </div>
      </LoaderBase>
    );
  },
);
EqualizerLoader.displayName = "EqualizerLoader";

// ─────────────────────────────────────────────
// 7. VINYL LOADER
// ─────────────────────────────────────────────

/**
 * Spinning vinyl record.
 *
 * - sw-anim-halo creates the outer breathing glow ring
 * - sw-anim-vinyl drives the rotation at 3.8 s/rev
 * - Dark mode enhances glow via .dark .sw-glass
 */
export const VinylLoader: FC<LoaderProps> = memo(
  ({
    fullscreen,
    text = "Playing…",
    size = "md",
    glass = true,
    className,
    ariaLive,
  }) => {
    const { vinylPx } = SIZE_MAP[size];
    const centerRatio = 0.32;
    const dotRatio = 0.08;

    return (
      <LoaderBase
        fullscreen={fullscreen}
        glass={glass}
        className={className}
        ariaLive={ariaLive}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "relative",
              width: vinylPx,
              height: vinylPx,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Breathing glow halo */}
            <div
              className="sw-anim-halo"
              style={{
                position: "absolute",
                inset: -10,
                borderRadius: "50%",
                background: "hsl(var(--brand-glow, 258 100% 66%) / .20)",
                filter: "blur(14px)",
                pointerEvents: "none",
              }}
            />

            {/* Vinyl disc */}
            <div
              className="sw-vinyl-disc sw-anim-vinyl"
              style={{ width: vinylPx, height: vinylPx }}
            >
              {/* Label area */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: vinylPx * centerRatio * 2,
                  height: vinylPx * centerRatio * 2,
                  borderRadius: "50%",
                  background: "hsl(var(--primary, 258 90% 56%) / .18)",
                  border: "1px solid hsl(0 0% 100% / .10)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* Spindle dot */}
                <div
                  style={{
                    width: vinylPx * dotRatio * 2,
                    height: vinylPx * dotRatio * 2,
                    borderRadius: "50%",
                    background: "hsl(0 0% 100% / .80)",
                    boxShadow: "0 0 6px hsl(0 0% 100% / .60)",
                  }}
                />
              </div>
            </div>
          </div>

          {text && <LoaderLabel text={text} />}
        </div>
      </LoaderBase>
    );
  },
);
VinylLoader.displayName = "VinylLoader";

// ─────────────────────────────────────────────
// 8. PULSE LOADER
// ─────────────────────────────────────────────

/**
 * Concentric pulsing rings around a branded music icon.
 *
 * - Outer + mid rings use sw-anim-pulse (scale + opacity)
 * - Core button uses sw-anim-glow-breathe
 * - All colors token-driven: --primary, --brand-glow
 */
export const PulseLoader: FC<LoaderProps> = memo(
  ({
    fullscreen,
    text = "Please wait…",
    size = "md",
    glass = true,
    className,
    ariaLive,
  }) => {
    const { iconPx, containerPx } = SIZE_MAP[size];
    const outer = containerPx * 1.5;
    const mid = containerPx * 1.1;

    return (
      <LoaderBase
        fullscreen={fullscreen}
        glass={glass}
        className={className}
        ariaLive={ariaLive}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "relative",
              width: outer,
              height: outer,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Outer ring */}
            <div
              className="sw-anim-pulse"
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: "hsl(var(--primary, 258 90% 56%) / .10)",
                border: "1px solid hsl(var(--primary, 258 90% 56%) / .18)",
              }}
            />
            {/* Mid ring */}
            <div
              className="sw-anim-pulse"
              style={{
                position: "absolute",
                inset: (outer - mid) / 2,
                borderRadius: "50%",
                background: "hsl(var(--primary, 258 90% 56%) / .08)",
                border: "1px solid hsl(var(--primary, 258 90% 56%) / .12)",
                animationDelay: "0.45s",
              }}
            />
            {/* Core */}
            <div
              className="sw-anim-glow-breathe"
              style={{
                position: "relative",
                zIndex: 2,
                width: containerPx,
                height: containerPx,
                borderRadius: "50%",
                background: "hsl(var(--primary, 258 90% 56%))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "inset 0 1px 0 hsl(0 0% 100% / .18)",
              }}
            >
              <Music
                size={iconPx}
                color="hsl(var(--primary-foreground, 0 0% 100%))"
                fill="hsl(var(--primary-foreground, 0 0% 100%))"
              />
            </div>
          </div>

          {text && <LoaderLabel text={text} />}
        </div>
      </LoaderBase>
    );
  },
);
PulseLoader.displayName = "PulseLoader";

// ─────────────────────────────────────────────
// 9. WAVEFORM LOADER
// ─────────────────────────────────────────────

/**
 * Horizontal sine-wave bars — cinematic, wider than EQ bars.
 * Uses a pre-computed bell-curve envelope (WAVE_HEIGHTS).
 * Each bar animates scaleY from centre (transformOrigin: center).
 */
export const WaveformLoader: FC<LoaderProps> = memo(
  ({
    fullscreen,
    text = "Buffering…",
    size = "md",
    glass = true,
    className,
    ariaLive,
  }) => {
    const { barH, waveBars } = SIZE_MAP[size];
    const heights = useMemo(
      () => Array.from(WAVE_HEIGHTS).slice(0, waveBars),
      [waveBars],
    );

    return (
      <LoaderBase
        fullscreen={fullscreen}
        glass={glass}
        className={className}
        ariaLive={ariaLive}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              display: "flex",
              alignItems: "center",
              height: barH,
              gap: 2,
            }}
          >
            {heights.map((h, i) => (
              <span
                key={i}
                className="sw-wave-bar sw-anim-wave"
                style={
                  {
                    width: 3,
                    height: Math.round(barH * h),
                    "--_dur": `${0.8 + i * 0.04}s`,
                    "--_delay": `${i * 0.1}s`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
          {text && <LoaderLabel text={text} />}
        </div>
      </LoaderBase>
    );
  },
);
WaveformLoader.displayName = "WaveformLoader";

// ─────────────────────────────────────────────
// 10. RADIO LOADER
// ─────────────────────────────────────────────

/**
 * Signal-broadcast rings — ideal for "Connecting…" / live radio states.
 * Three staggered rings expand outward; core button uses brand colour.
 */
export const RadioLoader: FC<LoaderProps> = memo(
  ({
    fullscreen,
    text = "Connecting…",
    size = "md",
    glass = true,
    className,
    ariaLive,
  }) => {
    const { iconPx, containerPx } = SIZE_MAP[size];
    const rings: [number, number][] = [
      [containerPx * 1.0, 0.35],
      [containerPx * 1.5, 0.22],
      [containerPx * 2.1, 0.12],
    ];

    return (
      <LoaderBase
        fullscreen={fullscreen}
        glass={glass}
        className={className}
        ariaLive={ariaLive}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "relative",
              width: containerPx * 2.1,
              height: containerPx * 2.1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {rings.map(([diameter, opacity], i) => (
              <div
                key={i}
                className="sw-anim-pulse"
                style={{
                  position: "absolute",
                  width: diameter,
                  height: diameter,
                  borderRadius: "50%",
                  border: `1px solid hsl(var(--primary, 258 90% 56%) / ${opacity})`,
                  animationDelay: `${i * 0.35}s`,
                }}
              />
            ))}
            {/* Core */}
            <div
              style={{
                width: containerPx,
                height: containerPx,
                borderRadius: "50%",
                background: "hsl(var(--primary, 258 90% 56%))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow:
                  "0 4px 18px hsl(var(--brand-glow, 258 100% 66%) / .40), inset 0 1px 0 hsl(0 0% 100% / .18)",
                position: "relative",
                zIndex: 2,
              }}
            >
              <Radio
                size={iconPx}
                color="hsl(var(--primary-foreground, 0 0% 100%))"
              />
            </div>
          </div>

          {text && <LoaderLabel text={text} />}
        </div>
      </LoaderBase>
    );
  },
);
RadioLoader.displayName = "RadioLoader";

// ─────────────────────────────────────────────
// 11. SPINNER LOADER
// ─────────────────────────────────────────────

/**
 * Minimal arc spinner — for inline states (buttons, tooltips).
 * glass=false by default to keep it lightweight.
 * borderTopColor reads --primary (skin-aware).
 */
export const SpinnerLoader: FC<Omit<LoaderProps, "glass">> = memo(
  ({ fullscreen, text, size = "sm", className, ariaLive }) => {
    const { containerPx, spinBorder } = SIZE_MAP[size];
    const px = Math.round(containerPx * 0.5);

    return (
      <LoaderBase
        fullscreen={fullscreen}
        glass={false}
        className={className}
        ariaLive={ariaLive}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            aria-hidden="true"
            className="sw-anim-spin"
            style={{
              display: "block",
              width: px,
              height: px,
              borderRadius: "50%",
              border: `${spinBorder}px solid hsl(var(--muted, 220 20% 93%))`,
              borderTopColor: "hsl(var(--primary, 258 90% 56%))",
            }}
          />
          {text && <LoaderLabel text={text} />}
        </div>
      </LoaderBase>
    );
  },
);
SpinnerLoader.displayName = "SpinnerLoader";

// ─────────────────────────────────────────────
// 12. SKELETON LOADER
// ─────────────────────────────────────────────

interface SkeletonProps {
  /** "track" = list row · "album" = square card · "banner" = wide strip */
  type?: "track" | "album" | "banner";
  count?: number;
  className?: string;
}

/**
 * Reusable shimmer block. Width/height/radius passed as props.
 */
const SkeletonBlock: FC<{
  w?: string | number;
  h?: number;
  radius?: number;
  style?: React.CSSProperties;
}> = memo(({ w = "100%", h = 12, radius = 9999, style }) => (
  <span
    className="sw-anim-shimmer"
    style={{
      display: "block",
      width: w,
      height: h,
      borderRadius: radius,
      flexShrink: 0,
      ...style,
    }}
  />
));
SkeletonBlock.displayName = "SkeletonBlock";

/**
 * Skeleton loader — three variants:
 *  "track"  — horizontal list rows (track number, title, artist, duration)
 *  "album"  — square card grid (cover art + text)
 *  "banner" — full-width hero strip
 */
export const SkeletonLoader: FC<SkeletonProps> = memo(
  ({ type = "track", count = 4, className = "" }) => {
    useLoaderStyles();

    const items = useMemo(
      () => Array.from({ length: count }, (_, i) => i),
      [count],
    );

    if (type === "album") {
      return (
        <div
          className={className}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 16,
          }}
          aria-busy="true"
        >
          {items.map((i) => (
            <div
              key={i}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <SkeletonBlock
                w="100%"
                h={0}
                radius={14}
                style={{ aspectRatio: "1 / 1", height: undefined }}
              />
              <SkeletonBlock w={`${60 + (i % 3) * 14}%`} h={13} />
              <SkeletonBlock w={`${40 + (i % 4) * 8}%`} h={11} />
            </div>
          ))}
        </div>
      );
    }

    if (type === "banner") {
      return (
        <div
          className={`sw-anim-shimmer ${className}`}
          style={{ borderRadius: 24, height: 220, width: "100%" }}
          aria-busy="true"
        />
      );
    }

    // "track" rows
    return (
      <div
        className={className}
        style={{ display: "flex", flexDirection: "column", gap: 6 }}
        aria-busy="true"
      >
        {items.map((i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "8px 12px",
            }}
          >
            <SkeletonBlock w={40} h={40} radius={10} />
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <SkeletonBlock w={`${55 + (i % 3) * 15}%`} h={13} />
              <SkeletonBlock w={`${35 + (i % 4) * 10}%`} h={11} />
            </div>
            <SkeletonBlock w={32} h={11} />
          </div>
        ))}
      </div>
    );
  },
);
SkeletonLoader.displayName = "SkeletonLoader";

// ─────────────────────────────────────────────
// 13. PROGRESS BAR
// ─────────────────────────────────────────────

interface ProgressBarProps {
  /** 0–100 */
  value: number;
  /** 0–100 — buffered / loaded ahead of playhead */
  buffered?: number;
  onSeek?: (pct: number) => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Seekable playback progress bar.
 *
 * Features:
 * - Gradient fill reads --primary / --wave-1 / --wave-2 (skin-aware)
 * - Buffered track layer at 22% muted opacity
 * - Thumb appears on hover with spring scale animation
 * - Keyboard: ArrowLeft / ArrowRight ±2%
 * - ARIA: role="slider" with aria-valuenow
 */
export const ProgressBar: FC<ProgressBarProps> = memo(
  ({ value, buffered = 0, onSeek, className = "", style }) => {
    useLoaderStyles();

    const trackRef = useRef<HTMLDivElement>(null);

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!trackRef.current || !onSeek) return;
        const rect = trackRef.current.getBoundingClientRect();
        onSeek(
          Math.min(
            100,
            Math.max(0, ((e.clientX - rect.left) / rect.width) * 100),
          ),
        );
      },
      [onSeek],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!onSeek) return;
        if (e.key === "ArrowRight") {
          e.preventDefault();
          onSeek(Math.min(100, value + 2));
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onSeek(Math.max(0, value - 2));
        }
        if (e.key === "Home") {
          e.preventDefault();
          onSeek(0);
        }
        if (e.key === "End") {
          e.preventDefault();
          onSeek(100);
        }
      },
      [onSeek, value],
    );

    const clamped = Math.min(100, Math.max(0, value));

    return (
      <div
        ref={trackRef}
        className={`sw-progress-track ${className}`}
        style={style}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
        aria-label="Playback position"
        tabIndex={onSeek ? 0 : -1}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {/* Buffered layer */}
        {buffered > 0 && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              width: `${Math.min(100, buffered)}%`,
              borderRadius: 9999,
              background: "hsl(var(--muted-foreground, 220 14% 48%) / .22)",
              pointerEvents: "none",
            }}
          />
        )}
        {/* Playhead fill */}
        <div className="sw-progress-fill" style={{ width: `${clamped}%` }}>
          <div className="sw-progress-thumb" />
        </div>
      </div>
    );
  },
);
ProgressBar.displayName = "ProgressBar";

// ─────────────────────────────────────────────
// 14. COMPOUND: MUSIC LOADER PICKER
// ─────────────────────────────────────────────

interface MusicLoaderProps extends LoaderProps {
  kind?: LoaderKind;
}

/**
 * Single entry-point — selects the correct loader by `kind`.
 *
 * @example
 * <MusicLoader kind="vinyl" size="lg" text="Loading track…" />
 *
 * Default: "equalizer"
 */
export const MusicLoader: FC<MusicLoaderProps> = memo(
  ({ kind = "equalizer", ...rest }) => {
    switch (kind) {
      case "vinyl":
        return <VinylLoader {...rest} />;
      case "pulse":
        return <PulseLoader {...rest} />;
      case "waveform":
        return <WaveformLoader {...rest} />;
      case "radio":
        return <RadioLoader {...rest} />;
      case "spinner":
        return <SpinnerLoader {...rest} />;
      default:
        return <EqualizerLoader {...rest} />;
    }
  },
);
MusicLoader.displayName = "MusicLoader";

// ─────────────────────────────────────────────
// 15. LOADER SHOWCASE  (remove in production)
// ─────────────────────────────────────────────

/**
 * Interactive showcase — demonstrates all loaders with live controls.
 * Import only in Storybook / dev routes; tree-shaken from production builds.
 *
 * Features demonstrated:
 * - All 6 loader kinds
 * - sm / md / lg sizes
 * - Glass on/off
 * - Dark/light theme toggle
 * - 6 skins (Default, Tokyo, Sahara, Nordic, Amazon, Crimson)
 * - Skeleton loader (banner + track + album)
 * - Seekable progress bar
 */

type ShowcaseSkin =
  | "default"
  | "tokyo"
  | "sahara"
  | "nordic"
  | "amazon"
  | "crimson";

const SKINS: Record<
  ShowcaseSkin,
  {
    label: string;
    dot: string;
    light: {
      primary: string;
      wave1: string;
      wave2: string;
      wave3: string;
      glow: string;
    };
    dark: {
      primary: string;
      wave1: string;
      wave2: string;
      wave3: string;
      glow: string;
    };
  }
> = {
  default: {
    label: "Default",
    dot: "linear-gradient(135deg, #5b3fd4, #d44fa8)",
    light: {
      primary: "258 90% 56%",
      wave1: "258 88% 65%",
      wave2: "320 76% 62%",
      wave3: "188 90% 48%",
      glow: "258 100% 66%",
    },
    dark: {
      primary: "258 80% 74%",
      wave1: "258 84% 76%",
      wave2: "320 78% 70%",
      wave3: "188 92% 60%",
      glow: "258 100% 80%",
    },
  },
  tokyo: {
    label: "Tokyo",
    dot: "linear-gradient(135deg, #c0205a, #7a28e0)",
    light: {
      primary: "340 75% 50%",
      wave1: "340 70% 55%",
      wave2: "280 60% 55%",
      wave3: "195 80% 50%",
      glow: "340 80% 60%",
    },
    dark: {
      primary: "340 90% 68%",
      wave1: "340 85% 72%",
      wave2: "280 75% 70%",
      wave3: "195 90% 64%",
      glow: "340 100% 75%",
    },
  },
  sahara: {
    label: "Sahara",
    dot: "linear-gradient(135deg, #b36a0a, #e0a030)",
    light: {
      primary: "36 85% 42%",
      wave1: "36 80% 48%",
      wave2: "22 75% 45%",
      wave3: "48 85% 55%",
      glow: "36 90% 52%",
    },
    dark: {
      primary: "36 95% 56%",
      wave1: "36 90% 62%",
      wave2: "22 86% 60%",
      wave3: "48 92% 65%",
      glow: "36 100% 66%",
    },
  },
  nordic: {
    label: "Nordic",
    dot: "linear-gradient(135deg, #185fa5, #0fc4d8)",
    light: {
      primary: "210 85% 45%",
      wave1: "210 80% 55%",
      wave2: "225 65% 50%",
      wave3: "185 75% 55%",
      glow: "210 90% 55%",
    },
    dark: {
      primary: "199 92% 66%",
      wave1: "200 88% 70%",
      wave2: "225 80% 68%",
      wave3: "185 88% 68%",
      glow: "199 100% 76%",
    },
  },
  amazon: {
    label: "Amazon",
    dot: "linear-gradient(135deg, #0f6e56, #3b6d11)",
    light: {
      primary: "162 75% 32%",
      wave1: "162 65% 38%",
      wave2: "140 60% 35%",
      wave3: "180 65% 45%",
      glow: "162 70% 42%",
    },
    dark: {
      primary: "152 68% 56%",
      wave1: "152 65% 60%",
      wave2: "140 68% 55%",
      wave3: "180 70% 62%",
      glow: "152 82% 64%",
    },
  },
  crimson: {
    label: "Crimson",
    dot: "linear-gradient(135deg, #c0362a, #c86010)",
    light: {
      primary: "0 80% 48%",
      wave1: "0 75% 50%",
      wave2: "340 70% 45%",
      wave3: "18 85% 55%",
      glow: "0 85% 58%",
    },
    dark: {
      primary: "356 88% 56%",
      wave1: "356 84% 62%",
      wave2: "340 80% 60%",
      wave3: "18 88% 65%",
      glow: "356 100% 65%",
    },
  },
};

export const LoaderShowcase: FC = () => {
  useLoaderStyles();

  const [dark, setDark] = useState(false);
  const [kind, setKind] = useState<LoaderKind>("equalizer");
  const [size, setSize] = useState<LoaderSize>("md");
  const [glass, setGlass] = useState(true);
  const [skin, setSkin] = useState<ShowcaseSkin>("default");
  const [progress, setProgress] = useState(38);

  const kinds: LoaderKind[] = [
    "equalizer",
    "vinyl",
    "pulse",
    "waveform",
    "radio",
    "spinner",
  ];
  const sizes: LoaderSize[] = ["sm", "md", "lg"];

  // Derive CSS variable values from active skin + mode
  const activeSkin = SKINS[skin];
  const skinTokens = dark ? activeSkin.dark : activeSkin.light;

  // Inline CSS vars applied to root div override the global theme during showcase
  const skinVars = {
    "--primary": `hsl(${skinTokens.primary})`,
    "--wave-1": `hsl(${skinTokens.wave1})`,
    "--wave-2": `hsl(${skinTokens.wave2})`,
    "--wave-3": `hsl(${skinTokens.wave3})`,
    "--brand-glow": `hsl(${skinTokens.glow})`,
    "--brand-500": `hsl(${skinTokens.primary})`,
    "--primary-foreground": "hsl(0 0% 100%)",
  } as React.CSSProperties;

  // ── Theming helpers ──────────────────────────────────────────────────
  const bg = dark ? "hsl(228 36% 3.5%)" : "hsl(222 30% 96.5%)";
  const fg = dark ? "hsl(215 30% 93%)" : "hsl(222 32% 8%)";
  const cardBg = dark ? "hsl(228 30% 6% / .82)" : "hsl(0 0% 100% / .82)";
  const border = dark ? "hsl(228 25% 11% / .45)" : "hsl(220 18% 90% / .55)";
  const shadow = dark
    ? "0 8px 32px hsl(228 40% 2% / .38)"
    : "0 4px 24px hsl(222 30% 15% / .09)";
  const mutedFg = dark ? "hsl(218 18% 48%)" : "hsl(220 14% 48%)";

  const card: React.CSSProperties = {
    background: cardBg,
    border: `0.5px solid ${border}`,
    backdropFilter: "blur(20px) saturate(160%)",
    WebkitBackdropFilter: "blur(20px) saturate(160%)",
    borderRadius: 20,
    padding: "1.5rem",
    boxShadow: shadow,
    transition: "background 380ms, border-color 380ms, box-shadow 380ms",
  };

  const chip = (active: boolean): React.CSSProperties => ({
    padding: "5px 14px",
    borderRadius: 9999,
    fontSize: "0.8125rem",
    fontWeight: 500,
    cursor: "pointer",
    border: "1px solid transparent",
    background: active
      ? dark
        ? "hsl(258 80% 74% / .18)"
        : "hsl(258 90% 56% / .10)"
      : dark
        ? "hsl(228 22% 11%)"
        : "hsl(220 20% 93%)",
    color: active ? `hsl(${skinTokens.primary})` : mutedFg,
    borderColor: active ? `hsl(${skinTokens.primary} / .28)` : "transparent",
    transition: "all 180ms",
  });

  const label: React.CSSProperties = {
    fontSize: "0.6875rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: mutedFg,
    marginBottom: 10,
  };

  const sectionTitle: React.CSSProperties = {
    ...label,
    marginBottom: 14,
    marginTop: 0,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: bg,
        color: fg,
        fontFamily: "var(--font-body, 'Inter', sans-serif)",
        transition: "background 380ms, color 380ms",
        padding: "2rem 1.5rem 6rem",
        ...skinVars,
      }}
      className={dark ? "dark" : ""}
    >
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        {/* ── Header ─────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "2.5rem",
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "1.5rem",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                margin: 0,
              }}
            >
              Music Loaders
            </h1>
            <p
              style={{
                fontSize: "0.875rem",
                color: mutedFg,
                margin: "4px 0 0",
              }}
            >
              Soundwave Design System v3 · Skin-aware · WCAG-ready
            </p>
          </div>
          <button
            onClick={() => setDark((d) => !d)}
            style={{ ...chip(false), padding: "8px 16px" }}
          >
            {dark ? "☀ Light" : "☾ Dark"}
          </button>
        </div>

        {/* ── Controls ───────────────────────────────────── */}
        <div style={{ ...card, marginBottom: "1.5rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "1.5rem",
            }}
          >
            {/* Kind picker */}
            <div>
              <p style={label}>Loader type</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {kinds.map((k) => (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    style={chip(kind === k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            {/* Size picker */}
            <div>
              <p style={label}>Size</p>
              <div style={{ display: "flex", gap: 6 }}>
                {sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    style={chip(size === s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Glass toggle */}
            <div>
              <p style={label}>Glass card</p>
              <button onClick={() => setGlass((g) => !g)} style={chip(glass)}>
                {glass ? "On" : "Off"}
              </button>
            </div>
          </div>

          {/* Skin row */}
          <div
            style={{
              marginTop: "1.25rem",
              borderTop: `1px solid ${border}`,
              paddingTop: "1.25rem",
            }}
          >
            <p style={label}>Skin</p>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {(
                Object.entries(SKINS) as [
                  ShowcaseSkin,
                  (typeof SKINS)[ShowcaseSkin],
                ][]
              ).map(([key, s]) => (
                <button
                  key={key}
                  title={s.label}
                  onClick={() => setSkin(key)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: s.dot,
                    border:
                      skin === key
                        ? `3px solid ${fg}`
                        : "3px solid transparent",
                    cursor: "pointer",
                    transform: skin === key ? "scale(1.18)" : "scale(1)",
                    transition: "transform 180ms, border-color 180ms",
                    flexShrink: 0,
                  }}
                />
              ))}
              <span
                style={{ marginLeft: 4, fontSize: "0.8125rem", color: mutedFg }}
              >
                {activeSkin.label}
              </span>
            </div>
          </div>
        </div>

        {/* ── Live preview ────────────────────────────────── */}
        <div
          style={{
            ...card,
            minHeight: 260,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1.5rem",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Ambient orbs */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              width: 200,
              height: 200,
              borderRadius: "50%",
              background: `hsl(${skinTokens.wave1} / .12)`,
              filter: "blur(60px)",
              top: -60,
              right: -40,
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              width: 160,
              height: 160,
              borderRadius: "50%",
              background: `hsl(${skinTokens.wave2} / .10)`,
              filter: "blur(50px)",
              bottom: -50,
              left: -30,
              pointerEvents: "none",
            }}
          />

          <MusicLoader
            kind={kind}
            size={size}
            glass={glass}
            text={`${kind.charAt(0).toUpperCase() + kind.slice(1)} — ${size}`}
          />
        </div>

        {/* ── All variants side-by-side ────────────────────── */}
        <div style={{ ...card, marginBottom: "1.5rem" }}>
          <p style={sectionTitle}>All loaders — sm · no glass</p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1.5rem",
              justifyContent: "center",
            }}
          >
            {kinds.map((k) => (
              <MusicLoader key={k} kind={k} size="sm" glass={false} text={k} />
            ))}
          </div>
        </div>

        {/* ── Skeleton loaders ─────────────────────────────── */}
        <div style={{ ...card, marginBottom: "1.5rem" }}>
          <p style={sectionTitle}>Skeleton loaders</p>
          <SkeletonLoader type="banner" />
          <div style={{ marginTop: 16 }}>
            <SkeletonLoader type="track" count={3} />
          </div>
          <div style={{ marginTop: 16 }}>
            <SkeletonLoader type="album" count={4} />
          </div>
        </div>

        {/* ── Progress bar ─────────────────────────────────── */}
        <div style={card}>
          <p style={sectionTitle}>Progress bar</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Elapsed time display */}
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "0.75rem",
                color: mutedFg,
                minWidth: 32,
              }}
            >
              {Math.floor(((progress / 100) * 225) / 60)}:
              {String(Math.round((progress / 100) * 225) % 60).padStart(2, "0")}
            </span>

            <ProgressBar
              value={progress}
              buffered={Math.min(100, progress + 18)}
              onSeek={setProgress}
              style={{ flex: 1 }}
            />

            <span
              style={{
                fontFamily: "monospace",
                fontSize: "0.75rem",
                color: mutedFg,
              }}
            >
              3:45
            </span>
          </div>
          <p style={{ fontSize: "0.75rem", marginTop: 10, color: mutedFg }}>
            Click to seek · Arrow keys ±2% · Home/End to jump
          </p>
        </div>
      </div>
    </div>
  );
};
