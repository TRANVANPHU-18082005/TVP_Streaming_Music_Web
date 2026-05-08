import React, { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { Palette } from "@/utils/color";

export type ArtistAvatarProps = {
  src?: string;
  name: string;
  palette: Palette;
  isPlaying?: boolean;
  size?: "sm" | "lg";
};

export const ArtistAvatar = memo<ArtistAvatarProps>(
  ({ src, name, palette, isPlaying = false, size = "lg" }) => {
    const isLg = size === "lg";

    return (
      <div
        className={cn(
          "group/avatar relative shrink-0",
          isLg ? "self-center md:self-auto" : "",
        )}
      >
        {/* Glow halo */}
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full blur-[40px] pointer-events-none transition-opacity duration-700"
          style={{
            backgroundColor: palette.hex,
            opacity: isPlaying ? 0.55 : 0.35,
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
              className="absolute -inset-[5px] rounded-full pointer-events-none"
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

        <Avatar
          className={cn(
            "relative z-10 border-background bg-card transition-[transform,box-shadow] duration-500 group-hover/avatar:scale-[1.02]",
            isLg
              ? "size-[160px] sm:size-[210px] md:size-[260px] rounded-full border-[5px] sm:border-[7px] shadow-2xl"
              : "size-20 rounded-2xl border-2 shadow-xl",
          )}
          style={
            isPlaying && isLg
              ? {
                  boxShadow: `0 0 0 3px ${palette.r(0.65)}, 0 24px 60px rgba(0,0,0,0.48)`,
                }
              : undefined
          }
        >
          <AvatarImage
            src={src}
            className={cn(
              "object-cover transition-[filter] duration-700",
              isPlaying && isLg && "saturate-[1.12] brightness-[0.9]",
            )}
            fetchPriority={isLg ? "high" : undefined}
          />
          <AvatarFallback
            className={cn(
              "font-black bg-primary/20 text-primary",
              isLg ? "text-5xl rounded-full" : "text-2xl rounded-2xl",
            )}
          >
            {name[0]}
          </AvatarFallback>

          <AnimatePresence>
            {isPlaying && isLg && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="absolute inset-0 rounded-full flex flex-col items-center justify-end pb-5 gap-2"
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
        </Avatar>
      </div>
    );
  },
);
ArtistAvatar.displayName = "ArtistAvatar";

export default ArtistAvatar;
