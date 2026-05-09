export const playerLayout = {
  mobile: {
    showQueue: false,
    showVolume: false,
  },
  desktop: {
    showQueue: true,
    showVolume: true,
  },
};
export const prefersReducedMotion =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
export const LONG_PRESS_MS = 500;
