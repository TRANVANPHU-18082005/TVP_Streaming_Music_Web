import React, { useRef } from "react";

export function useScrollY(
  ref: React.RefObject<HTMLElement | null>,
  enabled: boolean,
): number {
  const [scrollY, setScrollY] = React.useState(0);
  const rafId = useRef<number>(0);

  React.useEffect(() => {
    const refEl = ref.current;
    const target = (enabled ? null : refEl) ?? window;
    const handler = () => {
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        setScrollY(refEl && !enabled ? refEl.scrollTop : window.scrollY);
      });
    };
    target.addEventListener("scroll", handler, { passive: true });
    return () => {
      target.removeEventListener("scroll", handler);
      cancelAnimationFrame(rafId.current);
    };
  }, [enabled, ref]);

  return scrollY;
}
