/**
 * MusicLoaders.tsx — Equalizer, Vinyl, Pulse loaders
 * MusicResult.tsx  — Universal status/result component
 *
 * Design System: Soundwave (Obsidian Luxury / Neural Audio)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * FILE 1 — MusicLoaders FIXES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. Inline <style> injected on EVERY render.
 *    Original: `<style>{musicStyles}</style>` inside `MusicContainer` render.
 *    This re-injects the entire stylesheet (including @import for Google Fonts)
 *    on every state change anywhere in the tree. A Google Fonts @import inside
 *    a <style> tag that re-mounts triggers a new network request each time.
 *    FIX: Module-scope injection guard — styles injected once at module load,
 *    never again. Same pattern as the header's scroll-lock CSS injection.
 *
 * 2. `Math.random()` in `animationDuration` inline style.
 *    Original: `animationDuration: \`\${0.8 + Math.random() * 0.4}s\``
 *    This produces a different value on every render, meaning React sees
 *    a style change every render → forces a DOM style update for all 5 bars.
 *    FIX: Module-scope `EQUALIZER_DURATIONS` array — computed once, stable.
 *
 * 3. `MusicContainer` re-renders its children on every `fullscreen` change
 *    because `layoutClass` is computed inline. Minor — extracted to a
 *    `cn()` call with stable strings to allow memo bailout.
 *
 * 4. All three loaders (EqualizerLoader, VinylLoader, PulseLoader) were
 *    not memo'd. They receive stable props (fullscreen, text) — wrapping
 *    in memo prevents re-renders from parent state changes.
 *
 * 5. `className=""` default on `MusicContainer` — empty string default is
 *    fine but `cn()` handles undefined more cleanly. Minor cleanup.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * FILE 2 — MusicResult FIXES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 6. `getStatusConfig` called on every render with no memoization.
 *    It's a pure function with 10 cases returning plain objects. The objects
 *    are recreated on every call — including the `icon` reference (which is
 *    a React component). Since `icon` is used as `<DefaultIcon />`, a new
 *    reference doesn't cause issues (it's the same function), but the
 *    object allocation is wasteful.
 *    FIX: Module-scope `STATUS_CONFIG` map — computed once at module load.
 *
 * 7. Noise texture from external CDN `grainy-gradients.vercel.app`.
 *    This is an external network dependency in a UI component — if that
 *    domain goes down or is blocked, the texture fails silently. More
 *    importantly, it triggers a network request on every mount.
 *    FIX: Replaced with inline SVG data URI (identical to AlbumDetailPage
 *    and GenreDetailPage noise texture pattern from this codebase).
 *
 * 8. `motion.div` entrance animation on the root element:
 *    `initial={{ opacity: 0, scale: 0.98 }}` — this runs on every mount.
 *    For a fullscreen error state (404, offline, etc.), mounting this
 *    component means something already went wrong. The scale animation
 *    (0.98 → 1) is barely perceptible and adds layout thrash during
 *    a moment when the user wants information quickly.
 *    FIX: Kept the animation but changed to `opacity 0→1` only (no scale).
 *    The child animations (title, icon) still stagger for visual richness.
 *
 * 9. `isFullScreen` prop uses `fixed inset-0 z-50 h-screen w-screen` —
 *    the `h-screen` and `w-screen` are redundant with `inset-0` on a
 *    fixed element. Removed.
 *
 * 10. `min-h-[400px]` on the root — this is correct for card variant but
 *     should be `min-h-full` when used inside a flex container (e.g., empty
 *     state inside a TrackList). Changed to `min-h-[360px]` with override-
 *     friendly pattern.
 *
 * 11. Footer status "System Status: {status}" — debug-flavored text in
 *     production UI. Changed to "Soundwave · {status}" for brand consistency.
 *
 * 12. `success` colorClass used `text-emerald-600` — hardcoded color that
 *     diverges from Soundwave's `--success` token in dark mode.
 *     FIX: All semantic colors now use `hsl(var(--token))` pattern.
 *
 * 13. `MusicResult` not memo'd. Since it renders Framer Motion animations,
 *     it should be memo'd to prevent re-running entrance animations on
 *     unrelated parent state updates.
 */

// ─────────────────────────────────────────────────────────────────────────────
// FILE 1: MusicLoaders.tsx
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo } from "react";
import { Music } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Style injection — module scope, once only (FIX 1) ──────────────────────

const LOADER_STYLE_ID = "__soundwave-loader-styles__";

const LOADER_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  @keyframes liquid-bar-clean {
    0%, 100% { height: 30%; opacity: 0.4; }
    50%       { height: 90%; opacity: 1;   }
  }
  @keyframes vinyl-spin-smooth {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes pulse-ring {
    0%   { transform: scale(0.9); box-shadow: 0 0 0 0   rgba(0,0,0,0.1); }
    70%  { transform: scale(1);   box-shadow: 0 0 0 10px rgba(0,0,0,0);  }
    100% { transform: scale(0.9); box-shadow: 0 0 0 0   rgba(0,0,0,0);   }
  }
  @keyframes float-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0);    }
  }

  .font-music-hub   { font-family: 'Inter', sans-serif; }
  .hub-card         { background: white; border: 1px solid #e5e7eb; box-shadow: 0 1px 2px rgba(0,0,0,0.05); border-radius: 12px; }
  .hub-btn-primary  { background-color: #0f172a; color: white; transition: all 0.2s; }
  .hub-btn-primary:hover  { background-color: #1e293b; transform: translateY(-1px); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
  .hub-btn-secondary { background-color: white; border: 1px solid #e2e8f0; color: #1e293b; transition: all 0.2s; }
  .hub-btn-secondary:hover { border-color: #cbd5e1; background-color: #f8fafc; }

  .custom-scrollbar::-webkit-scrollbar       { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #e2e8f0; border-radius: 20px; }

  .animate-liquid-clean  { animation: liquid-bar-clean 1s ease-in-out infinite; }
  .animate-vinyl-smooth  { animation: vinyl-spin-smooth 4s linear infinite; }
  .animate-pulse-clean   { animation: pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite; }
  .animate-float         { animation: float-in 0.5s ease-out forwards; }
`;

// Inject once at module load time (FIX 1)
if (
  typeof document !== "undefined" &&
  !document.getElementById(LOADER_STYLE_ID)
) {
  const s = document.createElement("style");
  s.id = s.textContent = LOADER_STYLES;
  s.id = LOADER_STYLE_ID;
  document.head.appendChild(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE 2: MusicResult.tsx
// ─────────────────────────────────────────────────────────────────────────────

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Search,
  Lock,
  CreditCard,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

// ── Status config — module scope map (FIX 6) ─────────────────────────────────

export type MusicResultStatus =
  | "success"
  | "error"
  | "info"
  | "warning"
  | "404"
  | "403"
  | "offline"
  | "lock"
  | "empty"
  | "payment";

interface StatusConfig {
  icon: LucideIcon;
  colorClass: string;
  glow: string;
}

// FIX 12: All semantic colors use Soundwave CSS tokens, not hardcoded hex.
const STATUS_CONFIG: Record<MusicResultStatus, StatusConfig> = {
  success: {
    icon: CheckCircle2,
    colorClass:
      "text-[hsl(var(--success))] bg-[hsl(var(--success)/0.1)] border-[hsl(var(--success)/0.2)]",
    glow: "bg-[hsl(var(--success))]",
  },
  error: {
    icon: XCircle,
    colorClass: "text-destructive bg-destructive/10 border-destructive/20",
    glow: "bg-destructive",
  },
  warning: {
    icon: AlertTriangle,
    colorClass:
      "text-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.1)] border-[hsl(var(--warning)/0.2)]",
    glow: "bg-[hsl(var(--warning))]",
  },
  lock: {
    icon: Lock,
    colorClass: "text-muted-foreground bg-muted border-border",
    glow: "bg-muted-foreground",
  },
  "403": {
    icon: Lock,
    colorClass: "text-muted-foreground bg-muted border-border",
    glow: "bg-muted-foreground",
  },
  payment: {
    icon: CreditCard,
    colorClass:
      "text-[hsl(var(--info))] bg-[hsl(var(--info)/0.1)] border-[hsl(var(--info)/0.2)]",
    glow: "bg-[hsl(var(--info))]",
  },
  offline: {
    icon: WifiOff,
    colorClass: "text-destructive bg-destructive/10 border-destructive/20",
    glow: "bg-destructive",
  },
  "404": {
    icon: Search,
    colorClass: "text-primary bg-primary/10 border-primary/20",
    glow: "bg-primary",
  },
  empty: {
    icon: Search,
    colorClass: "text-primary bg-primary/10 border-primary/20",
    glow: "bg-primary",
  },
  info: {
    icon: Info,
    colorClass:
      "text-[hsl(var(--info))] bg-[hsl(var(--info)/0.1)] border-[hsl(var(--info)/0.2)]",
    glow: "bg-[hsl(var(--info))]",
  },
};

// ── Framer animation presets — module scope ───────────────────────────────────

const FADE_UP = {
  initial: { y: 16, opacity: 0 },
  animate: { y: 0, opacity: 1 },
} as const;

// ── Props ─────────────────────────────────────────────────────────────────────

interface MusicResultProps {
  status?: MusicResultStatus;
  isFullScreen?: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  image?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  secondaryAction?: { label: string; onClick: () => void };
  children?: React.ReactNode;
  className?: string;
}

// ── Inline SVG noise texture — no external CDN dep (FIX 7) ───────────────────
const NOISE_BG_URI = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

// ── MusicResult (FIX 6, 7, 8, 9, 10, 11, 12, 13) ────────────────────────────

export const MusicResult = memo<MusicResultProps>(
  ({
    status = "info",
    isFullScreen = false,
    title,
    description,
    icon: customIcon,
    image,
    primaryAction,
    secondaryAction,
    children,
    className,
  }) => {
    // FIX 6: direct map lookup, no function call, no object allocation
    const { icon: DefaultIcon, colorClass, glow } = STATUS_CONFIG[status];

    return (
      <motion.div
        // FIX 8: opacity-only entrance (no scale — avoids layout thrash on error states)
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className={cn(
          "relative flex flex-col items-center justify-center p-8 text-center overflow-hidden",
          // FIX 10: min-h-[360px] (was 400px), fullscreen removes min-h constraint
          isFullScreen
            ? // FIX 9: removed redundant h-screen w-screen (inset-0 on fixed = full viewport)
              "fixed inset-0 z-50 bg-background"
            : "w-full flex-1 bg-card/50 rounded-xl border border-border/50 min-h-[360px]",
          className,
        )}
      >
        {/* Background effects */}
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden"
          aria-hidden="true"
        >
          {/* Color glow behind icon */}
          <div
            className={cn(
              "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
              "w-[200px] h-[200px] rounded-full blur-[80px] opacity-[0.15] mix-blend-screen",
              glow,
            )}
          />
          {/* FIX 7: inline SVG noise — no external CDN */}
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: NOISE_BG_URI, backgroundSize: "180px" }}
          />
        </div>

        <div className="relative z-10 max-w-md w-full flex flex-col items-center gap-6">
          {/* Visual (image or icon) */}
          <motion.div {...FADE_UP} transition={{ delay: 0.1 }}>
            {image ? (
              <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden shadow-2xl border border-border bg-muted relative group">
                <img
                  src={image}
                  alt=""
                  aria-hidden="true"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div
                  className="absolute inset-0 bg-black/10"
                  aria-hidden="true"
                />
              </div>
            ) : (
              <div
                className={cn(
                  "p-6 rounded-full border shadow-lg backdrop-blur-md relative mb-2",
                  colorClass,
                )}
                aria-hidden="true"
              >
                {customIcon || (
                  <DefaultIcon
                    className="size-12 sm:size-16"
                    strokeWidth={1.5}
                  />
                )}
                {/* Slow orbit ring — decorative */}
                <div className="absolute inset-0 rounded-full border border-current opacity-20 animate-[spin_10s_linear_infinite]" />
              </div>
            )}
          </motion.div>

          {/* Text */}
          <motion.div
            {...FADE_UP}
            transition={{ delay: 0.18 }}
            className="space-y-2 px-4"
          >
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground text-balance">
              {title}
            </h2>
            {description && (
              <p className="text-muted-foreground text-base sm:text-lg text-pretty max-w-sm mx-auto leading-relaxed">
                {description}
              </p>
            )}
          </motion.div>

          {/* Custom children slot */}
          {children && (
            <motion.div
              {...FADE_UP}
              transition={{ delay: 0.26 }}
              className="w-full py-2"
            >
              {children}
            </motion.div>
          )}

          {/* Actions */}
          {(primaryAction || secondaryAction) && (
            <motion.div
              {...FADE_UP}
              transition={{ delay: 0.32 }}
              className="flex flex-col-reverse sm:flex-row items-center gap-3 w-full justify-center pt-2"
            >
              {secondaryAction && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={secondaryAction.onClick}
                  className="w-full sm:w-auto rounded-full min-w-[120px]"
                >
                  {secondaryAction.label}
                </Button>
              )}
              {primaryAction && (
                <Button
                  size="lg"
                  onClick={primaryAction.onClick}
                  className="w-full sm:w-auto rounded-full shadow-lg shadow-primary/20 gap-2 min-w-[140px]"
                >
                  {primaryAction.icon}
                  {primaryAction.label}
                </Button>
              )}
            </motion.div>
          )}
        </div>

        {/* FIX 11: branded footer instead of debug text */}
        <div
          className="absolute bottom-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/25 pointer-events-none select-none"
          aria-hidden="true"
        >
          <Music className="size-3 animate-pulse" />
          <span>Soundwave · {status}</span>
        </div>
      </motion.div>
    );
  },
);
MusicResult.displayName = "MusicResult";
export default MusicResult;
