import { useRef, useCallback, useEffect } from "react";
import { useMotionValue, animate } from "framer-motion";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum px before confirming a swipe */
const SWIPE_THRESHOLD = 52;

/** Minimum velocity (px/ms) to count as a flick */
const SWIPE_VELOCITY = 0.38;

/** Minimum px for a fast flick override */
const FLICK_MIN_DISTANCE = 18;

/** Axis-lock ratio: absX/absY must exceed this to classify as horizontal */
const SWIPE_AXIS_LOCK = 1.5;

/** Pixel movement to commit axis lock */
const AXIS_COMMIT_PX = 7;

/** How much the panel follows the finger (0–1) */
const DRAG_FOLLOW = 0.52;

/** Rubber-band factor at first/last tab edge */
const RUBBER_BAND = 0.18;

/** Spring config for snap-back when swipe doesn't trigger */
const SNAP_SPRING = { type: "spring", stiffness: 520, damping: 38 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

interface UseTabSwipeOptions {
  onSwipe: (direction: 1 | -1) => void;
  enabled: boolean;
  /** true when the first tab is active (no swipe-right possible) */
  atStart: boolean;
  /** true when the last tab is active (no swipe-left possible) */
  atEnd: boolean;
}

/**
 * Provides touch-swipe navigation between tabs with:
 * - Native `touchmove` listener (`passive: false`) to call `preventDefault()`
 * - Early axis-lock after AXIS_COMMIT_PX to distinguish horizontal vs vertical
 * - Live drag visual via a `dragX` MotionValue with damped follow + rubber-band
 * - Velocity-based flick detection for short-but-fast gestures
 * - Spring snap-back when gesture doesn't qualify as a swipe
 */
export function useTabSwipe({
  onSwipe,
  enabled,
  atStart,
  atEnd,
}: UseTabSwipeOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragX = useMotionValue(0);

  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);

  /**
   * null  → not yet determined
   * true  → committed horizontal (we own this gesture)
   * false → committed vertical (scroll wins)
   */
  const isHorizontal = useRef<boolean | null>(null);
  const insideHScroll = useRef(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      startX.current = t.clientX;
      startY.current = t.clientY;
      startTime.current = performance.now();
      isHorizontal.current = null;

      insideHScroll.current = !!(e.target as Element).closest(
        ".scroll-overflow-mask",
      );

      dragX.stop();
      dragX.set(0);
    },
    [dragX],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    const onMove = (e: TouchEvent) => {
      if (insideHScroll.current) return;

      const t = e.touches[0];
      const dx = t.clientX - startX.current;
      const dy = t.clientY - startY.current;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (
        isHorizontal.current === null &&
        (absDx > AXIS_COMMIT_PX || absDy > AXIS_COMMIT_PX)
      ) {
        isHorizontal.current = absDx / Math.max(absDy, 1) >= SWIPE_AXIS_LOCK;
      }

      if (!isHorizontal.current) return;

      e.preventDefault();

      const goingRight = dx > 0;
      const goingLeft = dx < 0;

      let visualDx: number;
      if ((goingRight && atStart) || (goingLeft && atEnd)) {
        visualDx = dx * RUBBER_BAND;
      } else {
        visualDx = dx * DRAG_FOLLOW;
      }

      dragX.set(visualDx);
    };

    el.addEventListener("touchmove", onMove, { passive: false });
    return () => el.removeEventListener("touchmove", onMove);
  }, [enabled, dragX, atStart, atEnd]);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || insideHScroll.current || !isHorizontal.current) {
        dragX.set(0);
        return;
      }

      const t = e.changedTouches[0];
      const dx = t.clientX - startX.current;
      const elapsed = performance.now() - startTime.current;
      const absDx = Math.abs(dx);
      const velocity = absDx / Math.max(elapsed, 1);

      const isFarEnough = absDx >= SWIPE_THRESHOLD;
      const isFastFlick =
        velocity >= SWIPE_VELOCITY && absDx >= FLICK_MIN_DISTANCE;

      if (isFarEnough || isFastFlick) {
        animate(dragX, 0, { duration: 0.05 });
        onSwipe(dx < 0 ? 1 : -1);
      } else {
        animate(dragX, 0, SNAP_SPRING);
      }
    },
    [enabled, onSwipe, dragX],
  );

  return {
    containerRef,
    dragX,
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
  };
}
