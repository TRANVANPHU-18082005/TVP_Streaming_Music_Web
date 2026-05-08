import React, { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ListMusic, PenSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import type { IPlaylist } from "@/features/playlist/types";

type Palette = {
  hex: string;
  r: (opacity: number) => string;
  heroGradient: string;
  hslChannels: string;
  glowShadow: string;
};

export interface PlaylistCoverProps {
  playlist: IPlaylist;
  palette: Palette;
  isOwner: boolean;
  isPlaying?: boolean;
  size: "sm" | "lg";
  onEditCover: () => void;
}

export const PlaylistCover = memo<PlaylistCoverProps>(
  ({ playlist, palette, isOwner, isPlaying = false, size, onEditCover }) => {
    const isLg = size === "lg";
    const dim = isLg
      ? "size-[200px] sm:size-[240px] md:size-[290px]"
      : "size-[68px] sm:size-20";

    const { theme } = useTheme();
    const isDark = React.useMemo(() => {
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
            dim,
          )}
          style={
            isPlaying && isLg
              ? {
                  boxShadow: `0 0 0 3px ${palette.r(0.65)}, 0 24px 60px rgba(0,0,0,0.48)`,
                }
              : { boxShadow: "0 24px 60px rgba(0,0,0,0.45)" }
          }
        >
          {playlist.coverImage ? (
            <img
              src={playlist.coverImage}
              alt={playlist.title}
              className={cn(
                "size-full object-cover transition-[transform,filter] duration-700",
                isLg && "group-hover:scale-105",
                isPlaying && isLg && "saturate-[1.15] brightness-[0.88]",
              )}
              loading={isLg ? "eager" : "lazy"}
              fetchPriority={isLg ? "high" : "auto"}
              decoding="async"
            />
          ) : (
            <div
              className="size-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${palette.r(0.3)} 0%, ${palette.r(0.08)} 100%)`,
              }}
            >
              <ListMusic
                className={cn(
                  "text-muted-foreground/25",
                  isLg ? "size-14" : "size-6",
                )}
                aria-hidden="true"
              />
            </div>
          )}

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
            className="absolute inset-0 bg-gradient-to-tr from-black/15 to-transparent pointer-events-none ring-1 ring-inset ring-black/10 rounded-[inherit]"
          />

          {isLg && isOwner && (
            <button
              type="button"
              onClick={onEditCover}
              aria-label="Edit cover image"
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center gap-2",
                "bg-black/55 backdrop-blur-sm opacity-0 group-hover:opacity-100",
                "transition-opacity duration-250 cursor-pointer",
                "focus-visible:opacity-100 focus-visible:outline-none",
              )}
            >
              <PenSquare className="size-7 text-white" aria-hidden="true" />
              <span className="text-white text-[9px] font-black uppercase tracking-widest">
                Chỉnh sửa
              </span>
            </button>
          )}
        </div>
      </div>
    );
  },
);
PlaylistCover.displayName = "PlaylistCover";

export default PlaylistCover;
