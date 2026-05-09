import React, { memo, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { Loader2, Pause, Play } from "lucide-react";
import { prefersReducedMotion } from "@/utils/playerLayout";

interface LazyImageProps {
  src: string;
  alt: string;
  isActive: boolean;
  isCurrentPlaying?: boolean;
  isLoading?: boolean;
  onClick: (e: React.MouseEvent) => void;
}

const LazyImage = memo(
  ({
    src,
    alt,
    isActive,
    isCurrentPlaying,
    isLoading,
    onClick,
  }: LazyImageProps) => {
    const [loaded, setLoaded] = useState(false);
    const [inView, setInView] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const el = wrapRef.current;
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        },
        { rootMargin: "200px", threshold: 0 },
      );
      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    return (
      <div
        ref={wrapRef}
        role="button"
        tabIndex={-1}
        aria-hidden="true"
        className="relative size-10 shrink-0 overflow-hidden rounded-md cursor-pointer select-none"
        style={{
          transition: prefersReducedMotion ? "none" : "box-shadow 0.2s ease",
          boxShadow: isActive
            ? "0 0 0 1.5px hsl(var(--primary) / 0.7), 0 0 12px hsl(var(--primary) / 0.15)"
            : "none",
          backgroundColor: "hsl(var(--muted))",
        }}
        onClick={onClick}
      >
        {inView && (
          <>
            <ImageWithFallback
              src={src}
              alt={alt}
              width={40}
              height={40}
              className="size-full object-cover"
              style={{
                opacity: loaded ? 1 : 0,
                transition: prefersReducedMotion
                  ? "none"
                  : "opacity 0.25s ease, transform 0.5s cubic-bezier(0.16,1,0.3,1)",
                transform: "scale(1)",
                willChange: "opacity",
              }}
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              onMouseEnter={(e) => {
                if (!prefersReducedMotion) {
                  (e.currentTarget as HTMLImageElement).style.transform =
                    "scale(1.08)";
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLImageElement).style.transform =
                  "scale(1)";
              }}
            />
            <motion.div
              className="absolute inset-0 flex items-center justify-center dark:bg-black/40 bg-black/30 backdrop-blur-[1px]"
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              animate={{
                opacity:
                  (isActive && isLoading) ||
                  (isActive && isCurrentPlaying && !isLoading)
                    ? 1
                    : 0,
              }}
            >
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <Loader2 className="size-4 text-white animate-spin" />
                ) : isCurrentPlaying ? (
                  <Pause className="size-4 text-white fill-white" />
                ) : (
                  <Play className="size-4 text-white fill-white ml-0.5" />
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </div>
    );
  },
);

LazyImage.displayName = "LazyImage";
export default LazyImage;
