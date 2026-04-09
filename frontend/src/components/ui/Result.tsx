import { memo } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Search,
  Lock,
  CreditCard,
  WifiOff,
  Music2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

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
  /**
   * Tailwind classes for icon container: text, bg, border.
   * All use hsl(var(--*)) tokens — skin-aware, light/dark adaptive.
   */
  colorClass: string;
  /** CSS var name for the ambient glow behind icon */
  glowVar: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS CONFIG — module scope map (FIX 6)
// All colorClass strings use Soundwave semantic tokens.
// glowVar is the raw CSS var name for inline style injection.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<MusicResultStatus, StatusConfig> = {
  success: {
    icon: CheckCircle2,
    colorClass: [
      "text-[hsl(var(--success))]",
      "bg-[hsl(var(--success)/0.10)]",
      "border-[hsl(var(--success)/0.22)]",
    ].join(" "),
    glowVar: "--success",
  },
  error: {
    icon: XCircle,
    colorClass: [
      "text-[hsl(var(--error))]",
      "bg-[hsl(var(--error)/0.10)]",
      "border-[hsl(var(--error)/0.22)]",
    ].join(" "),
    glowVar: "--error",
  },
  warning: {
    icon: AlertTriangle,
    colorClass: [
      "text-[hsl(var(--warning))]",
      "bg-[hsl(var(--warning)/0.10)]",
      "border-[hsl(var(--warning)/0.22)]",
    ].join(" "),
    glowVar: "--warning",
  },
  info: {
    icon: Info,
    colorClass: [
      "text-[hsl(var(--info))]",
      "bg-[hsl(var(--info)/0.10)]",
      "border-[hsl(var(--info)/0.22)]",
    ].join(" "),
    glowVar: "--info",
  },
  "404": {
    icon: Search,
    colorClass: ["text-primary", "bg-primary/10", "border-primary/22"].join(
      " ",
    ),
    glowVar: "--brand-glow",
  },
  empty: {
    icon: Search,
    colorClass: ["text-muted-foreground", "bg-muted/40", "border-border"].join(
      " ",
    ),
    glowVar: "--muted-foreground",
  },
  lock: {
    icon: Lock,
    colorClass: ["text-muted-foreground", "bg-muted/40", "border-border"].join(
      " ",
    ),
    glowVar: "--muted-foreground",
  },
  "403": {
    icon: Lock,
    colorClass: [
      "text-[hsl(var(--warning))]",
      "bg-[hsl(var(--warning)/0.10)]",
      "border-[hsl(var(--warning)/0.22)]",
    ].join(" "),
    glowVar: "--warning",
  },
  payment: {
    icon: CreditCard,
    colorClass: [
      "text-[hsl(var(--info))]",
      "bg-[hsl(var(--info)/0.10)]",
      "border-[hsl(var(--info)/0.22)]",
    ].join(" "),
    glowVar: "--info",
  },
  offline: {
    icon: WifiOff,
    colorClass: [
      "text-[hsl(var(--error))]",
      "bg-[hsl(var(--error)/0.10)]",
      "border-[hsl(var(--error)/0.22)]",
    ].join(" "),
    glowVar: "--error",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// FRAMER MOTION PRESETS — aligned with --ease-snappy timing
// ─────────────────────────────────────────────────────────────────────────────

const FADE_UP = {
  initial: { y: 14, opacity: 0, filter: "blur(3px)" },
  animate: { y: 0, opacity: 1, filter: "blur(0px)" },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// NOISE TEXTURE — inline SVG data URI, no external CDN (FIX 7)
// ─────────────────────────────────────────────────────────────────────────────

const NOISE_URI = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface MusicResultProps {
  status?: MusicResultStatus;
  isFullScreen?: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Override the default status icon */
  icon?: React.ReactNode;
  /** Show album art instead of status icon */
  image?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  children?: React.ReactNode;
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MUSIC RESULT — main component (FIX 13: memo)
// ─────────────────────────────────────────────────────────────────────────────

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
    // FIX 6: direct map lookup — no function call, no object allocation per render
    const { icon: DefaultIcon, colorClass, glowVar } = STATUS_CONFIG[status];

    return (
      <motion.div
        // FIX 8: opacity-only entrance — no scale thrash on error states
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "relative flex flex-col items-center justify-center",
          "p-8 sm:p-12 text-center overflow-hidden",
          isFullScreen
            ? // FIX 9: inset-0 on fixed is sufficient — no h-screen w-screen
              "fixed inset-0 z-50 bg-background"
            : // Card: .glass-frosted + .shadow-card — aligned with design system
              "w-full flex-1 glass-frosted shadow-card rounded-2xl min-h-[360px]",
          className,
        )}
      >
        {/* ── Background layer ── */}
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden"
          aria-hidden="true"
        >
          {/*
           * Fullscreen: .bg-mesh-brand for ambient depth
           * Card: subtle radial glow only
           */}
          {isFullScreen && (
            <div className="absolute inset-0 bg-mesh-brand opacity-60" />
          )}

          {/* Ambient glow behind icon — token-driven via inline style */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-48 rounded-full blur-[72px] opacity-[0.14] mix-blend-screen"
            style={{ background: `hsl(var(${glowVar}))` }}
          />

          {/* FIX 7: inline SVG noise — no external CDN dep */}
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage: NOISE_URI,
              backgroundSize: "160px 160px",
            }}
          />
        </div>

        {/* ── Content ── */}
        <div className="relative z-10 max-w-sm w-full flex flex-col items-center gap-6">
          {/* Visual: image or icon */}
          <motion.div
            {...FADE_UP}
            transition={{
              delay: 0.08,
              duration: 0.35,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {image ? (
              <div className="album-card size-40 sm:size-48 shadow-card-lg">
                <img
                  src={image}
                  alt=""
                  aria-hidden="true"
                  className="img-cover"
                />
                <div className="album-overlay" aria-hidden="true" />
              </div>
            ) : (
              <div className="relative">
                {/* Icon container — token colorClass */}
                <div
                  className={cn(
                    "p-6 rounded-full border-2 shadow-glow-md relative",
                    colorClass,
                  )}
                  aria-hidden="true"
                >
                  {customIcon ?? (
                    <DefaultIcon
                      className="size-12 sm:size-14"
                      strokeWidth={1.5}
                    />
                  )}
                </div>

                {/* Slow orbit ring — spin from @theme */}
                <div
                  className="absolute inset-0 rounded-full border border-current opacity-15 animate-[spin_12s_linear_infinite]"
                  aria-hidden="true"
                />
              </div>
            )}
          </motion.div>

          {/* Title + description */}
          <motion.div
            {...FADE_UP}
            transition={{
              delay: 0.16,
              duration: 0.35,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="space-y-2"
          >
            <h2 className="text-display-lg text-balance">{title}</h2>

            {description && (
              <p className="text-track-meta text-muted-foreground max-w-xs mx-auto leading-relaxed">
                {description}
              </p>
            )}
          </motion.div>

          {/* Custom slot */}
          {children && (
            <motion.div
              {...FADE_UP}
              transition={{
                delay: 0.24,
                duration: 0.32,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="w-full"
            >
              {children}
            </motion.div>
          )}

          {/* Actions */}
          {(primaryAction || secondaryAction) && (
            <motion.div
              {...FADE_UP}
              transition={{
                delay: 0.3,
                duration: 0.32,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="flex flex-col-reverse sm:flex-row items-center gap-3 w-full justify-center pt-1"
            >
              {secondaryAction && (
                <button
                  type="button"
                  onClick={secondaryAction.onClick}
                  className="btn-ghost btn-lg w-full sm:w-auto rounded-full"
                >
                  {secondaryAction.label}
                </button>
              )}
              {primaryAction && (
                <button
                  type="button"
                  onClick={primaryAction.onClick}
                  className="btn-primary btn-lg w-full sm:w-auto rounded-full gap-2.5"
                >
                  {primaryAction.icon}
                  {primaryAction.label}
                </button>
              )}
            </motion.div>
          )}
        </div>

        {/* FIX 11: branded footer — not debug text */}
        <div
          className="absolute bottom-3 flex items-center gap-1.5 pointer-events-none select-none"
          aria-hidden="true"
        >
          <Music2
            className="size-3 animate-[spin_8s_linear_infinite] opacity-20"
            style={{ color: "hsl(var(--primary))" }}
          />
          <span className="text-overline text-muted-foreground/20 text-[9px]">
            Soundwave · {status}
          </span>
        </div>
      </motion.div>
    );
  },
);

MusicResult.displayName = "MusicResult";
export default MusicResult;
