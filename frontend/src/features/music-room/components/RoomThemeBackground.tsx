// features/music-room/components/RoomThemeBackground.tsx
/**
 * Background động theo theme của phòng.
 * Sử dụng CSS animations thuần, không cần thư viện thêm.
 */

import React, { memo } from "react";
import type { RoomTheme } from "../types/room.types";
import { ROOM_THEMES } from "../types/room.types";

interface Props {
  theme: RoomTheme;
}

const PARTICLE_COUNT = 20;

const RoomThemeBackground = memo(({ theme }: Props) => {
  const config = ROOM_THEMES[theme];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Gradient nền */}
      <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-90`} />

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Glow orbs */}
      <div
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px] opacity-20 animate-pulse"
        style={{ backgroundColor: config.accent }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full blur-[80px] opacity-15 animate-pulse"
        style={{ backgroundColor: config.accent, animationDelay: "1.5s" }}
      />

      {/* Floating particles (chỉ cho bar và festival theme) */}
      {(theme === "festival" || theme === "hype") &&
        Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-0"
            style={{
              width: `${2 + Math.random() * 4}px`,
              height: `${2 + Math.random() * 4}px`,
              backgroundColor: config.accent,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float-particle ${3 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}

      {/* Scanlines overlay cho bar theme */}
      {theme === "bar" && (
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)",
          }}
        />
      )}

      {/* Wave animation cho chill theme */}
      {theme === "chill" && (
        <div className="absolute bottom-0 left-0 right-0 h-32 opacity-20">
          <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="w-full h-full">
            <path
              fill={config.accent}
              className="animate-[wave_6s_ease-in-out_infinite]"
              d="M0,40 C360,80 720,0 1080,40 C1260,60 1350,40 1440,40 L1440,80 L0,80 Z"
            />
          </svg>
        </div>
      )}

      <style>{`
        @keyframes float-particle {
          0%, 100% { opacity: 0; transform: translateY(0px) scale(0); }
          50% { opacity: 0.8; transform: translateY(-30px) scale(1); }
        }
        @keyframes wave {
          0%, 100% { d: path("M0,40 C360,80 720,0 1080,40 C1260,60 1350,40 1440,40 L1440,80 L0,80 Z"); }
          50% { d: path("M0,20 C360,0 720,60 1080,20 C1260,10 1350,30 1440,20 L1440,80 L0,80 Z"); }
        }
      `}</style>
    </div>
  );
});

RoomThemeBackground.displayName = "RoomThemeBackground";
export default RoomThemeBackground;
