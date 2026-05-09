import React, { memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { Palette } from "@/utils/color";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";

export type AlbumHeroCoverProps = {
  src: string;
  alt: string;
  palette: Palette;
  isPlaying?: boolean;
  size?: "sm" | "lg";
};

export const AlbumHeroCover = memo<AlbumHeroCoverProps>(
  ({ src, alt, palette, isPlaying = false, size = "lg" }) => {
    const isLg = size === "lg";
    const { theme } = useTheme();
    const isDark = useMemo(() => {
      if (typeof window === "undefined") return true;
      if (theme === "dark") return true;
      if (theme === "light") return false;
      return (
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
    }, [theme]);

    const haloOpacity = isPlaying
      ? isDark
        ? 0.48
        : 0.12
      : isDark
        ? 0.2
        : 0.06;

    return (
      <div
        className={cn(
          "group relative shrink-0",
          isLg ? "self-center md:self-auto" : "",
        )}
      >
        <div
          aria-hidden="true"
          className="absolute -inset-3 rounded-2xl blur-3xl pointer-events-none transition-opacity duration-700"
          style={{
            backgroundColor: palette.hex,
            opacity: haloOpacity,
            mixBlendMode: isDark ? "screen" : "normal",
          }}
        />

        <AnimatePresence>
          {isPlaying && isLg && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4 }}
              aria-hidden="true"
              className="absolute -inset-[5px] rounded-2xl pointer-events-none"
              style={{
                background: `conic-gradient(
                ${palette.r(0.9)} 0deg,
                ${palette.r(0.1)} 120deg,
                ${palette.r(0.7)} 240deg,
                ${palette.r(0.9)} 360deg
              )`,
                animation: "album-ring-spin 4s linear infinite",
              }}
            />
          )}
        </AnimatePresence>

        <div
          className={cn(
            "relative rounded-2xl overflow-hidden border border-white/10 bg-muted",
            "transition-[transform,box-shadow] duration-500 group-hover:scale-[1.012]",
            isLg
              ? "size-[200px] sm:size-[240px] md:size-[280px] lg:size-[320px]"
              : "size-20",
          )}
          style={
            isPlaying && isLg
              ? {
                  boxShadow: `0 0 0 3px ${palette.r(0.65)}, 0 24px 60px rgba(0,0,0,0.48)`,
                }
              : { boxShadow: "0 24px 60px rgba(0,0,0,0.45)" }
          }
        >
          <ImageWithFallback
            src={src || "/images/default-album.png"}
            alt={alt}
            className={cn(
              "size-full object-cover",
              "transition-[transform,filter] duration-700",
              "group-hover:scale-105",
              isPlaying &&
                isLg &&
                (isDark
                  ? "saturate-[1.15] brightness-[0.88]"
                  : "saturate-[1.08] brightness-[1]"),
            )}
            loading={isLg ? "eager" : "lazy"}
            fetchPriority={isLg ? "high" : "auto"}
            decoding="async"
          />

          <AnimatePresence>
            {isPlaying && isLg && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="absolute inset-0 flex flex-col items-center justify-end pb-5 gap-2"
                style={{
                  background: `linear-gradient(to top, ${palette.r(0.82)} 0%, ${palette.r(0.18)} 55%, transparent 100%)`,
                }}
                aria-hidden="true"
              >
                <div className="eq-bars h-7">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="eq-bar"
                      style={{ background: "rgba(255,255,255,0.88)" }}
                    />
                  ))}
                </div>
                <span className="text-[9px] font-black text-white/72 uppercase tracking-[0.22em]">
                  Đang phát
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/20 pointer-events-none"
          />
        </div>
      </div>
    );
  },
);

AlbumHeroCover.displayName = "AlbumHeroCover";

export default AlbumHeroCover;
