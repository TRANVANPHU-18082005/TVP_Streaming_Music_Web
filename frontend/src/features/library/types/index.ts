// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type LibraryTab = "tracks" | "albums" | "playlists";

export interface TabConfig {
  id: LibraryTab;
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

export const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.42, ease: EASE_EXPO },
  },
};

export const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.065, delayChildren: 0.08 } },
};

export const mobileCardVariants = {
  hidden: { opacity: 0, x: 16 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.065, duration: 0.38, ease: EASE_EXPO },
  }),
};
