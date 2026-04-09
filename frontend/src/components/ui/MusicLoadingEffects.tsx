/**
 * @file loaders.tsx
 * @description Production-grade Music Loader Components
 * Built on the Soundwave design token system (index.css).
 *
 * Architecture:
 *   - Single <style> injection via useEffect + ref guard (no module-scope DOM side-effects)
 *   - Deterministic animation durations (no Math.random, stable across SSR/hydration)
 *   - Full dark/light mode via CSS custom properties
 *   - WCAG-friendly: aria-live, role="status", reduced-motion support
 *   - Zero external deps beyond React + lucide-react
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
import { VinylDisc } from "../MusicVisualizer";

// ─────────────────────────────────────────────
// 1. DESIGN TOKENS  (mirrors index.css :root)
// ─────────────────────────────────────────────

const STYLE_ID = "__sw-loaders__";

/**
 * All animation keyframes + utility classes wired to CSS custom properties.
 * Injected once; safe in SSR (guard on typeof document).
 */
const LOADER_CSS = `
  /* ── Keyframes ───────────────────────────── */
  @keyframes sw-bar {
    0%,100% { height:18%; opacity:.45; }
    50%     { height:100%; opacity:1;  }
  }
  @keyframes sw-vinyl {
    to { transform:rotate(360deg); }
  }
  @keyframes sw-pulse-ring {
    0%   { transform:scale(.88); opacity:.7; }
    50%  { transform:scale(1.08); opacity:.15; }
    100% { transform:scale(.88); opacity:.7; }
  }
  @keyframes sw-wave-dot {
    0%,80%,100% { transform:scaleY(.4); opacity:.35; }
    40%         { transform:scaleY(1);  opacity:1;   }
  }
  @keyframes sw-float-in {
    from { opacity:0; transform:translateY(12px); }
    to   { opacity:1; transform:translateY(0);    }
  }
  @keyframes sw-shimmer {
    from { background-position:-400% center; }
    to   { background-position: 400% center; }
  }
  @keyframes sw-glow-breathe {
    0%,100% { box-shadow:0 0 16px hsl(var(--brand-glow)/.18),0 0 32px hsl(var(--brand-glow)/.07); }
    50%     { box-shadow:0 0 32px hsl(var(--brand-glow)/.50),0 0 64px hsl(var(--brand-glow)/.18); }
  }
  @keyframes sw-halo {
    0%,100% { opacity:0; transform:scale(.96); }
    50%     { opacity:1; transform:scale(1.04); }
  }
  @keyframes sw-spin {
    to { transform:rotate(360deg); }
  }

  /* ── Reduced-motion overrides ─────────────── */
  @media (prefers-reduced-motion:reduce) {
    [class*="sw-animate-"] {
      animation-duration:.01ms!important;
      animation-iteration-count:1!important;
    }
  }

  /* ── Utility classes ──────────────────────── */
  .sw-animate-bar    { animation:sw-bar var(--_dur,1s) ease-in-out infinite var(--_delay,0s); }
  .sw-animate-vinyl  { animation:sw-vinyl 3.8s linear infinite; }
  .sw-animate-pulse  { animation:sw-pulse-ring 2s ease-in-out infinite; }
  .sw-animate-wave   { animation:sw-wave-dot 1.4s ease-in-out infinite; }
  .sw-animate-float  { animation:sw-float-in .5s var(--ease-snappy,cubic-bezier(.16,1,.3,1)) forwards; }
  .sw-animate-shimmer{
    background:linear-gradient(105deg,
      hsl(var(--muted,220 20% 93%)) 0%,
      hsl(var(--surface-3,220 22% 91%)) 40%,
      hsl(var(--accent,220 18% 90%))  50%,
      hsl(var(--surface-3,220 22% 91%)) 60%,
      hsl(var(--muted,220 20% 93%)) 100%
    );
    background-size:300% auto;
    animation:sw-shimmer 1.8s linear infinite;
  }
  .sw-animate-glow-breathe { animation:sw-glow-breathe 4s ease-in-out infinite; }
  .sw-animate-halo         { animation:sw-halo 3.5s ease-in-out infinite; }
  .sw-animate-spin         { animation:sw-spin .7s linear infinite; }

  /* ── Container ────────────────────────────── */
  .sw-loader-root {
    font-family:var(--font-body,'Inter',sans-serif);
    background:hsl(var(--background,222 30% 96.5%));
    color:hsl(var(--foreground,222 32% 8%));
    transition:
      background 380ms var(--ease-theme,cubic-bezier(.25,.46,.45,.94)),
      color       380ms var(--ease-theme,cubic-bezier(.25,.46,.45,.94));
  }
  .sw-loader-root.sw-fullscreen {
    position:fixed;inset:0;z-index:9999;
    display:flex;align-items:center;justify-content:center;
  }
  .sw-loader-root.sw-inline {
    position:relative;width:100%;height:100%;min-height:160px;
    display:flex;align-items:center;justify-content:center;
  }

  /* ── Glass card ───────────────────────────── */
  .sw-glass {
    background:hsl(var(--card,0 0% 100%)/.82);
    backdrop-filter:blur(20px) saturate(160%);
    -webkit-backdrop-filter:blur(20px) saturate(160%);
    border:1px solid hsl(var(--border,220 18% 90%)/.55);
    border-radius:24px;
    box-shadow:
      inset 0 1px 0 hsl(0 0% 100%/.10),
      0 4px 24px hsl(var(--shadow-color,222 30% 15%)/.09);
    transition:
      background 380ms var(--ease-theme,cubic-bezier(.25,.46,.45,.94)),
      border-color 380ms var(--ease-theme,cubic-bezier(.25,.46,.45,.94)),
      box-shadow   380ms var(--ease-theme,cubic-bezier(.25,.46,.45,.94));
  }
  .dark .sw-glass {
    background:hsl(var(--card,228 30% 6%)/.52);
    backdrop-filter:blur(28px) saturate(200%);
    -webkit-backdrop-filter:blur(28px) saturate(200%);
    border-color:hsl(var(--border,228 25% 11%)/.08);
    box-shadow:
      inset 0 1px 0 hsl(0 0% 100%/.06),
      0 0 0 1px hsl(var(--primary,258 80% 74%)/.04),
      0 8px 32px hsl(var(--shadow-color,228 40% 2%)/.38);
  }

  /* ── EQ bar ───────────────────────────────── */
  .sw-eq-bar {
    width:4px;
    border-radius:2px 2px 1px 1px;
    transform-origin:bottom center;
    background:hsl(var(--primary,258 90% 56%));
    will-change:height;
    transition:none;
  }
  .sw-eq-bar--gradient {
    background:linear-gradient(to top,
      hsl(var(--wave-1,258 88% 65%)),
      hsl(var(--wave-2,320 76% 62%)) 60%,
      hsl(var(--wave-3,188 90% 48%))
    );
  }

  /* ── Vinyl disc (token-driven) ────────────── */
  .sw-vinyl-disc {
    border-radius:50%;
    background:radial-gradient(circle at center,
      hsl(228 28% 14%) 0%,   hsl(228 28% 14%) 13.5%,
      hsl(228 25% 22%) 14%,  hsl(228 28% 14%) 14.5%,
      hsl(228 22% 18%) 28%,  hsl(228 28% 13%) 28.5%,
      hsl(228 20% 16%) 44%,  hsl(228 28% 11%) 44.5%,
      hsl(228 22% 14%) 62%,  hsl(228 28% 10%) 62.5%,
      hsl(228 20% 13%) 80%,  hsl(228 25%  9%) 100%
    );
    box-shadow:
      0 0 0 2px hsl(0 0% 0%/.45),
      0 4px 24px hsl(0 0% 0%/.40),
      inset 0 0 60px hsl(0 0% 0%/.28);
    transition:none;
  }

  /* ── Progress bar ─────────────────────────── */
  .sw-progress-track {
    position:relative;height:3px;
    border-radius:9999px;
    background:hsl(var(--muted,220 20% 93%));
    overflow:visible;cursor:pointer;
    transition:height 100ms var(--ease-snappy,cubic-bezier(.16,1,.3,1));
  }
  .sw-progress-track:hover { height:5px; }
  .sw-progress-fill {
    height:100%;border-radius:9999px;
    background:linear-gradient(90deg,
      hsl(var(--primary,258 90% 56%)),
      hsl(var(--wave-1,258 88% 65%)) 60%,
      hsl(var(--wave-2,320 76% 62%))
    );
    position:relative;will-change:width;
    transition:width .08s linear;
  }
  .sw-progress-fill::after {
    content:"";position:absolute;right:-6px;top:50%;
    transform:translateY(-50%) scale(0);
    width:12px;height:12px;border-radius:50%;
    background:hsl(0 0% 100%);
    box-shadow:0 0 0 2px hsl(var(--brand-500,258 90% 56%)),0 0 12px hsl(var(--brand-glow,258 100% 66%)/.50);
    transition:transform 180ms var(--ease-spring,cubic-bezier(.34,1.56,.64,1));
    z-index:10;
  }
  .sw-progress-track:hover .sw-progress-fill::after { transform:translateY(-50%) scale(1); }

  /* ── Label ────────────────────────────────── */
  .sw-label {
    font-size:.6875rem;font-weight:600;
    text-transform:uppercase;letter-spacing:.1em;
    color:hsl(var(--muted-foreground,220 14% 48%));
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
// 3. SHARED TYPES & CONSTANTS
// ─────────────────────────────────────────────

export type LoaderSize = "sm" | "md" | "lg";
export type LoaderVariant = "default" | "gradient" | "brand";

export interface LoaderProps {
  /** Render as fixed fullscreen overlay */
  fullscreen?: boolean;
  /** Label below the animation */
  text?: ReactNode;
  size?: LoaderSize;
  variant?: LoaderVariant;
  className?: string;
  /** Optionally wrap in the glass card */
  glass?: boolean;
  /** ARIA live region politeness (default: "polite") */
  ariaLive?: "polite" | "assertive" | "off";
}

/** Stable durations — deterministic, survives SSR hydration */
const BAR_DURATIONS = [0.82, 1.08, 0.7, 0.95, 0.78, 1.15, 0.88] as const;
const BAR_DELAYS = [0, 0.09, 0.18, 0.13, 0.04, 0.22, 0.31] as const;

/** Size-to-pixel maps */
const SIZE_MAP: Record<
  LoaderSize,
  {
    containerPx: number;
    barH: number;
    barW: number;
    vinylPx: number;
    iconPx: number;
    gap: number;
  }
> = {
  sm: { containerPx: 40, barH: 20, barW: 3, vinylPx: 64, iconPx: 16, gap: 8 },
  md: { containerPx: 64, barH: 32, barW: 4, vinylPx: 96, iconPx: 22, gap: 12 },
  lg: { containerPx: 96, barH: 48, barW: 5, vinylPx: 128, iconPx: 28, gap: 16 },
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
      <div style={{ padding: "1.5rem" }}>{children}</div>
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
    className="sw-label sw-animate-float"
    style={{ marginTop: 16, textAlign: "center", animationDelay: "0.2s" }}
  >
    {text}
  </p>
));
LoaderLabel.displayName = "LoaderLabel";

// ─────────────────────────────────────────────
// 6. EQUALIZER LOADER
// ─────────────────────────────────────────────

/**
 * EQ-style animated bars loader.
 * Uses deterministic durations (BAR_DURATIONS) — no hydration mismatch.
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
    const bars = size === "sm" ? 5 : size === "md" ? 7 : 7;

    const barClass =
      variant === "gradient"
        ? "sw-eq-bar sw-eq-bar--gradient sw-animate-bar"
        : "sw-eq-bar sw-animate-bar";

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
                className={barClass}
                style={
                  {
                    width: barW,
                    height: barH * 0.3,
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
 * Spinning vinyl record with optional glow halo (dark mode).
 */
export const VinylLoader: FC<LoaderProps> = memo(
  ({
    fullscreen,
    text = "Loading…",
    size = "md",
    glass = true,
    className,
    ariaLive,
  }) => {
    const { vinylPx } = SIZE_MAP[size];

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
          {/* Halo — dark-mode glow ring */}
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
            {/* Animated glow ring */}
            <div
              className="sw-animate-halo"
              style={{
                position: "absolute",
                inset: -8,
                borderRadius: "50%",
                background: "hsl(var(--brand-glow, 258 100% 66%) / 0.18)",
                filter: "blur(12px)",
                pointerEvents: "none",
              }}
            />

            {/* Vinyl itself */}
            <VinylDisc active />
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
 * Concentric pulsing rings around a brand-coloured icon.
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
            {/* Outer pulse ring */}
            <div
              className="sw-animate-pulse"
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: "hsl(var(--primary, 258 90% 56%) / .12)",
                border: "1px solid hsl(var(--primary, 258 90% 56%) / .20)",
              }}
            />
            {/* Mid pulse ring */}
            <div
              className="sw-animate-pulse"
              style={{
                position: "absolute",
                inset: (outer - mid) / 2,
                borderRadius: "50%",
                background: "hsl(var(--primary, 258 90% 56%) / .08)",
                border: "1px solid hsl(var(--primary, 258 90% 56%) / .14)",
                animationDelay: "0.45s",
              }}
            />
            {/* Icon core */}
            <div
              className="sw-animate-glow-breathe"
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
// 9. WAVEFORM LOADER (new)
// ─────────────────────────────────────────────

/**
 * Horizontal sine-wave bars — wider and more cinematic than EQ bars.
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
    const { barH, gap } = SIZE_MAP[size];
    const count = 14;

    // Heights simulate a static waveform envelope
    const heights = useMemo(
      () => [
        0.4, 0.65, 0.85, 0.95, 0.8, 0.6, 0.9, 0.7, 0.5, 0.88, 0.75, 0.55, 0.4,
        0.3,
      ],
      [],
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
              gap: gap / 2,
            }}
          >
            {heights.slice(0, count).map((h, i) => (
              <span
                key={i}
                className="sw-animate-wave"
                style={{
                  display: "block",
                  width: 3,
                  borderRadius: 9999,
                  background: `linear-gradient(to top, hsl(var(--wave-1,258 88% 65%)), hsl(var(--wave-2,320 76% 62%)))`,
                  height: barH * h,
                  transformOrigin: "center",
                  animationDelay: `${i * 0.1}s`,
                }}
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
// 10. RADIO LOADER (new)
// ─────────────────────────────────────────────

/**
 * Signal-broadcast rings — great for "Connecting…" / live radio states.
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
    const rings = [1.0, 1.5, 2.1];

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
              width: containerPx * rings[2],
              height: containerPx * rings[2],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {rings.map((scale, i) => (
              <div
                key={i}
                className="sw-animate-pulse"
                style={{
                  position: "absolute",
                  width: containerPx * scale,
                  height: containerPx * scale,
                  borderRadius: "50%",
                  border: `1px solid hsl(var(--primary, 258 90% 56%) / ${0.35 - i * 0.1})`,
                  animationDelay: `${i * 0.35}s`,
                }}
              />
            ))}
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
                  "0 4px 18px hsl(var(--brand-glow,258 100% 66%)/.4), inset 0 1px 0 hsl(0 0% 100%/.18)",
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
// 11. SPINNER LOADER (compact, inline)
// ─────────────────────────────────────────────

/**
 * Minimal arc spinner — use for inline states (buttons, tooltips).
 * glass=false by default to keep it lightweight.
 */
export const SpinnerLoader: FC<Omit<LoaderProps, "glass">> = memo(
  ({ fullscreen, text, size = "sm", className, ariaLive }) => {
    const px = SIZE_MAP[size].containerPx * 0.5;

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
            className="sw-animate-spin"
            style={{
              display: "block",
              width: px,
              height: px,
              borderRadius: "50%",
              border: `${size === "sm" ? 2 : 2.5}px solid hsl(var(--muted, 220 20% 93%))`,
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
// 12. SKELETON LOADER (track list / card grid)
// ─────────────────────────────────────────────

interface SkeletonProps {
  /** "track" = list row; "album" = square card */
  type?: "track" | "album" | "banner";
  count?: number;
  className?: string;
}

const SkeletonBlock: FC<{
  w?: string;
  h?: number;
  radius?: number;
  mb?: number;
}> = memo(({ w = "100%", h = 12, radius = 9999, mb = 0 }) => (
  <span
    className="sw-animate-shimmer"
    style={{
      display: "block",
      width: w,
      height: h,
      borderRadius: radius,
      marginBottom: mb,
      flexShrink: 0,
    }}
  />
));
SkeletonBlock.displayName = "SkeletonBlock";

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
            gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))",
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
                h={0}
                radius={14}
                w="100%"
                // aspect ratio trick
              />
              <span
                className="sw-animate-shimmer"
                style={{
                  display: "block",
                  aspectRatio: "1/1",
                  borderRadius: 14,
                }}
              />
              <SkeletonBlock w="72%" h={13} />
              <SkeletonBlock w="48%" h={11} />
            </div>
          ))}
        </div>
      );
    }

    if (type === "banner") {
      return (
        <div
          className={`sw-animate-shimmer ${className}`}
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
            <SkeletonBlock w="40px" h={40} radius={10} />
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
            <SkeletonBlock w="32px" h={11} />
          </div>
        ))}
      </div>
    );
  },
);
SkeletonLoader.displayName = "SkeletonLoader";

// ─────────────────────────────────────────────
// 13. PROGRESS BAR (standalone)
// ─────────────────────────────────────────────

interface ProgressBarProps {
  /** 0–100 */
  value: number;
  /** 0–100 */
  buffered?: number;
  onSeek?: (pct: number) => void;
  className?: string;
  style?: React.CSSProperties;
}

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
        if (e.key === "ArrowRight") onSeek(Math.min(100, value + 2));
        if (e.key === "ArrowLeft") onSeek(Math.max(0, value - 2));
      },
      [onSeek, value],
    );

    return (
      <div
        ref={trackRef}
        className={`sw-progress-track ${className}`}
        style={style}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
        aria-label="Playback position"
        tabIndex={onSeek ? 0 : -1}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {/* Buffered */}
        {buffered > 0 && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              width: `${buffered}%`,
              borderRadius: 9999,
              background: "hsl(var(--muted-foreground, 220 14% 48%) / .22)",
              pointerEvents: "none",
            }}
          />
        )}
        {/* Fill */}
        <div
          className="sw-progress-fill"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    );
  },
);
ProgressBar.displayName = "ProgressBar";

// ─────────────────────────────────────────────
// 14. COMPOUND: MUSIC LOADER PICKER
// ─────────────────────────────────────────────

export type LoaderKind =
  | "equalizer"
  | "vinyl"
  | "pulse"
  | "waveform"
  | "radio"
  | "spinner";

interface MusicLoaderProps extends LoaderProps {
  kind?: LoaderKind;
}

/**
 * Single entry-point — picks the correct loader by `kind`.
 * Default: "equalizer".
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
// 15. DEMO PAGE (remove in production)
// ─────────────────────────────────────────────

/**
 * Interactive showcase — demonstrates all loaders with live controls.
 * Import only in Storybook / dev routes; tree-shaken from production.
 */
export const LoaderShowcase: FC = () => {
  useLoaderStyles();

  const [dark, setDark] = useState(false);
  const [kind, setKind] = useState<LoaderKind>("equalizer");
  const [size, setSize] = useState<LoaderSize>("md");
  const [glass, setGlass] = useState(true);
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

  const root: React.CSSProperties = {
    minHeight: "100vh",
    background: dark ? "hsl(228 36% 3.5%)" : "hsl(222 30% 96.5%)",
    color: dark ? "hsl(215 30% 93%)" : "hsl(222 32% 8%)",
    fontFamily: "var(--font-body,'Inter',sans-serif)",
    transition: "background 380ms, color 380ms",
    padding: "2rem 1.5rem 6rem",
  };

  const card: React.CSSProperties = {
    background: dark ? "hsl(228 30% 6% / .82)" : "hsl(0 0% 100% / .82)",
    border: `1px solid ${dark ? "hsl(228 25% 11% / .55)" : "hsl(220 18% 90% / .55)"}`,
    backdropFilter: "blur(20px) saturate(160%)",
    borderRadius: 20,
    padding: "1.5rem",
    boxShadow: dark
      ? "0 8px 32px hsl(228 40% 2% / .38)"
      : "0 4px 24px hsl(222 30% 15% / .09)",
    transition: "background 380ms, border-color 380ms, box-shadow 380ms",
  };

  const pill = (active: boolean): React.CSSProperties => ({
    padding: "5px 14px",
    borderRadius: 9999,
    fontSize: "0.875rem",
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
    color: active
      ? dark
        ? "hsl(258 80% 74%)"
        : "hsl(258 90% 56%)"
      : dark
        ? "hsl(218 18% 48%)"
        : "hsl(220 14% 48%)",
    borderColor: active
      ? dark
        ? "hsl(258 80% 74% / .28)"
        : "hsl(258 90% 56% / .28)"
      : "transparent",
    transition: "all 200ms",
  });

  const label: React.CSSProperties = {
    fontSize: "0.6875rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: dark ? "hsl(218 18% 48%)" : "hsl(220 14% 48%)",
    marginBottom: 10,
  };

  return (
    <div style={root} className={dark ? "dark" : ""}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        {/* Header */}
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
                fontFamily: "'Space Grotesk',sans-serif",
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
                color: dark ? "hsl(218 18% 48%)" : "hsl(220 14% 48%)",
                margin: "4px 0 0",
              }}
            >
              Production-grade · Design-token aware · WCAG-ready
            </p>
          </div>
          <button
            onClick={() => setDark((d) => !d)}
            style={{ ...pill(false), padding: "8px 16px" }}
          >
            {dark ? "☀ Light" : "☾ Dark"}
          </button>
        </div>

        {/* Controls */}
        <div style={{ ...card, marginBottom: "1.5rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "1.5rem",
            }}
          >
            <div>
              <p style={label}>Loader type</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {kinds.map((k) => (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    style={pill(kind === k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p style={label}>Size</p>
              <div style={{ display: "flex", gap: 6 }}>
                {sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    style={pill(size === s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p style={label}>Glass card</p>
              <button onClick={() => setGlass((g) => !g)} style={pill(glass)}>
                {glass ? "On" : "Off"}
              </button>
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div
          style={{
            ...card,
            minHeight: 260,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1.5rem",
          }}
        >
          <MusicLoader
            kind={kind}
            size={size}
            glass={glass}
            text={`${kind.charAt(0).toUpperCase() + kind.slice(1)} — ${size}`}
          />
        </div>

        {/* All variants side-by-side */}
        <div style={{ ...card, marginBottom: "1.5rem" }}>
          <p style={{ ...label, marginBottom: 16 }}>
            All loaders — sm · no glass
          </p>
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

        {/* Skeleton loaders */}
        <div style={{ ...card, marginBottom: "1.5rem" }}>
          <p style={{ ...label, marginBottom: 14 }}>Skeleton loaders</p>
          <SkeletonLoader type="banner" />
          <div style={{ marginTop: 16 }}>
            <SkeletonLoader type="track" count={3} />
          </div>
          <div style={{ marginTop: 16 }}>
            <SkeletonLoader type="album" count={4} />
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ ...card }}>
          <p style={{ ...label, marginBottom: 14 }}>Progress bar</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "0.75rem",
                color: dark ? "hsl(218 18% 48%)" : "hsl(220 14% 48%)",
                minWidth: 36,
              }}
            >
              {Math.round((progress * 3.45) / 100)
                .toString()
                .padStart(1, "0")}
              :
              {Math.round(progress * 0.45)
                .toString()
                .padStart(2, "0")}
            </span>
            <ProgressBar
              value={progress}
              buffered={Math.min(100, progress + 20)}
              onSeek={setProgress}
              style={{ flex: 1 }}
            />
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "0.75rem",
                color: dark ? "hsl(218 18% 48%)" : "hsl(220 14% 48%)",
              }}
            >
              3:45
            </span>
          </div>
          <p
            style={{
              fontSize: "0.75rem",
              marginTop: 8,
              color: dark ? "hsl(218 18% 48%)" : "hsl(220 14% 48%)",
            }}
          >
            Click to seek · Arrow keys adjust by ±2%
          </p>
        </div>
      </div>
    </div>
  );
};
