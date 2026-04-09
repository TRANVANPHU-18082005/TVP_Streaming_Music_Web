import { memo } from "react";
import { motion } from "framer-motion";

interface PlayerBackgroundProps {
  coverImage?: string;
  dominantColor?: string; // e.g. "hsl(260 70% 40%)"
  focusMode: boolean;
  isPlaying: boolean;
}

const PLAYER_BG_CSS = `
  @keyframes fp-bg-orb-a {
    0%,100% { transform: translate3d(0,0,0) scale(1); }
    33%      { transform: translate3d(42px,-28px,0) scale(1.08); }
    66%      { transform: translate3d(-18px,36px,0) scale(0.95); }
  }
  @keyframes fp-bg-orb-b {
    0%,100% { transform: translate3d(0,0,0) scale(1); }
    40%      { transform: translate3d(-38px,22px,0) scale(1.06); }
    75%      { transform: translate3d(26px,-18px,0) scale(0.97); }
  }
  @keyframes fp-bg-orb-c {
    0%,100% { transform: translate3d(0,0,0) scale(1); }
    50%      { transform: translate3d(20px,30px,0) scale(1.04); }
  }
  @keyframes fp-bg-grain {
    0%,100% { transform: translate(0,0); }
    25%      { transform: translate(-1px,1px); }
    50%      { transform: translate(1px,-1px); }
    75%      { transform: translate(-1px,-1px); }
  }
  .fp-bg-orb-a { animation: fp-bg-orb-a 22s ease-in-out infinite; }
  .fp-bg-orb-b { animation: fp-bg-orb-b 30s ease-in-out infinite; }
  .fp-bg-orb-c { animation: fp-bg-orb-c 18s ease-in-out infinite; }
  .fp-bg-grain { animation: fp-bg-grain 0.22s steps(1) infinite; }
  @media (prefers-reduced-motion: reduce) {
    .fp-bg-orb-a, .fp-bg-orb-b, .fp-bg-orb-c, .fp-bg-grain {
      animation: none !important;
    }
  }
`;

export const PlayerBackground = memo(
  ({
    coverImage,
    dominantColor = "hsl(258 70% 40%)",
    focusMode,
  }: PlayerBackgroundProps) => {
    return (
      <>
        <style>{PLAYER_BG_CSS}</style>

        {/* ─── ABSOLUTE BACKGROUND STACK ─────────────────────────── */}
        <div
          className="absolute inset-0 -z-10 overflow-hidden pointer-events-none"
          aria-hidden="true"
        >
          {/* ── L1: BLURRED ARTWORK ── */}
          {coverImage && (
            <motion.div
              key={coverImage}
              className="absolute inset-[-12%] bg-cover bg-center"
              style={{
                backgroundImage: `url(${coverImage})`,
                filter: focusMode
                  ? "blur(80px) saturate(0.55) brightness(0.6)"
                  : "blur(52px) saturate(1.1) brightness(0.9)",
                transform: "scale(1.12)",
                willChange: "transform, filter",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: focusMode ? 0.16 : 0.26 }}
              transition={{ duration: 1.4, ease: "easeInOut" }}
            />
          )}

          {/* ── L2: GRADIENT OVERLAY ── */}
          <div
            className="absolute inset-0"
            style={{
              background: `
              linear-gradient(to bottom,
                rgba(0,0,0,0.48) 0%,
                rgba(0,0,0,0.08) 28%,
                rgba(0,0,0,0.08) 52%,
                rgba(0,0,0,0.88) 100%
              ),
              linear-gradient(to right,
                rgba(0,0,0,0.28) 0%,
                transparent 30%,
                transparent 70%,
                rgba(0,0,0,0.28) 100%
              )
            `,
            }}
          />

          {/* ── L3: AMBIENT CENTER GLOW ── */}
          <motion.div
            className="absolute"
            style={{
              top: "10%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "65%",
              height: "50%",
              borderRadius: "50%",
              background: dominantColor,
              filter: "blur(90px)",
            }}
            animate={{ opacity: focusMode ? 0.05 : 0.11 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          />

          {/* ── L4: FLOATING ORBS ── */}
          <motion.div
            animate={{ opacity: focusMode ? 0.025 : 0.07 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0"
          >
            {/* Orb A — top-left, primary color */}
            <div
              className="fp-bg-orb-a absolute rounded-full"
              style={{
                width: "55%",
                height: "60%",
                top: "-15%",
                left: "-10%",
                background: dominantColor,
                filter: "blur(90px)",
              }}
            />
            {/* Orb B — bottom-right, shifted hue */}
            <div
              className="fp-bg-orb-b absolute rounded-full"
              style={{
                width: "50%",
                height: "55%",
                bottom: "-20%",
                right: "-12%",
                background: dominantColor,
                filter: "blur(110px)",
                opacity: 0.8,
              }}
            />
            {/* Orb C — center, deep fill */}
            <div
              className="fp-bg-orb-c absolute rounded-full"
              style={{
                width: "40%",
                height: "40%",
                top: "28%",
                left: "30%",
                background: dominantColor,
                filter: "blur(120px)",
                opacity: 0.4,
              }}
            />
          </motion.div>

          {/* ── L5: GRAIN TEXTURE ── */}
          <svg
            className="fp-bg-grain absolute pointer-events-none"
            style={{
              inset: "-100px",
              opacity: 0.022,
              width: "calc(100% + 200px)",
              height: "calc(100% + 200px)",
            }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <filter id="fp-grain-filter">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.78"
                numOctaves="4"
                stitchTiles="stitch"
              />
            </filter>
            <rect
              width="100%"
              height="100%"
              filter="url(#fp-grain-filter)"
              fill="white"
            />
          </svg>

          {/* ── L6: FOCUS VIGNETTE ── */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 50% 55% at 50% 48%, transparent 30%, rgba(0,0,0,0.78) 100%)",
            }}
            animate={{ opacity: focusMode ? 1 : 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          />
        </div>
      </>
    );
  },
);
PlayerBackground.displayName = "PlayerBackground";
