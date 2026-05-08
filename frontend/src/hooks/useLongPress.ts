import { useRef, useCallback } from "react";

export function useLongPress(callback: () => void, delay = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      // Bỏ qua right-click và multi-touch
      if ("button" in e && e.button !== 0) return;
      if ("touches" in e && e.touches.length > 1) return;
      timerRef.current = setTimeout(callback, delay);
    },
    [callback, delay],
  );

  const cancel = useCallback(() => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
    }
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchMove: cancel,
  };
}
