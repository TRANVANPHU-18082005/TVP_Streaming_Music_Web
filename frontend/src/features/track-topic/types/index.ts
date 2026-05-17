// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type TrackTab = "recommended" | "top_hot" | "top_favourite";

export interface TabConfig {
  id: TrackTab;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  wave: string;
  viewAllHref: string;
  viewAllLabel: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const EASE_EXPO = [0.22, 1, 0.36, 1] as const;

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

export const makeTabVariants = (direction: number) => ({
  initial: { opacity: 0, x: direction * 44 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.28, ease: EASE_EXPO },
  },
  exit: {
    opacity: 0,
    x: direction * -28,
    transition: { duration: 0.18, ease: EASE_EXPO },
  },
});
