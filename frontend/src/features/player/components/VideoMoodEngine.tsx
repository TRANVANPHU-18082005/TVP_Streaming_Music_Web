"use client";

import { useRef, useEffect, useState, useCallback, memo } from "react";
import { motion } from "framer-motion";

// ─────────────────────────────────────────────────────────
// 🎨 STYLE INJECTION
// ─────────────────────────────────────────────────────────

const STYLE_ID = "__video_mood_pro__";

const CSS = `
@keyframes kenburns {
  0%   { transform: scale(1)    translate(0, 0); }
  25%  { transform: scale(1.07) translate(-0.8%, 0.4%); }
  50%  { transform: scale(1.05) translate(0.6%, -0.6%); }
  75%  { transform: scale(1.08) translate(-0.4%, 0.8%); }
  100% { transform: scale(1)    translate(0, 0); }
}

@keyframes grainShift {
  0%   { transform: translate(0,    0); }
  25%  { transform: translate(-2%,  2%); }
  50%  { transform: translate( 2%, -2%); }
  75%  { transform: translate(-1%,  1%); }
  100% { transform: translate(0,    0); }
}

@keyframes colorBreath {
  0%,100% { opacity: 0.18; }
  50%     { opacity: 0.26; }
}
`;

function injectStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}

// ─────────────────────────────────────────────────────────
// 🎬 VIDEO LAYER — never remounts, just plays/pauses
// ─────────────────────────────────────────────────────────

const VideoLayer = memo(
  ({
    src,
    isPlaying,
    opacity,
    filter,
    onReady,
  }: {
    src: string;
    isPlaying: boolean;
    opacity: number;
    filter: string;
    onReady?: () => void;
  }) => {
    const ref = useRef<HTMLVideoElement>(null);

    // Preload once on mount / src change — never causes visual reset
    useEffect(() => {
      const v = ref.current;
      if (!v) return;
      v.preload = "auto";
      // Don't call v.load() if src hasn't changed — browser handles it
    }, [src]);

    // Play / pause without touching anything else
    useEffect(() => {
      const v = ref.current;
      if (!v) return;
      if (isPlaying) {
        // resume from wherever the video currently is — no seek, no reset
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    }, [isPlaying]);

    return (
      <motion.div
        animate={{ opacity }}
        transition={{ duration: 1.6, ease: "easeInOut" }}
        style={{ position: "absolute", inset: 0, filter }}
      >
        <video
          ref={ref}
          src={src}
          muted
          loop
          playsInline
          onCanPlayThrough={onReady}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            willChange: "transform",
          }}
        />
      </motion.div>
    );
  },
);
VideoLayer.displayName = "VideoLayer";

// ─────────────────────────────────────────────────────────
// 🌫️ GRAIN
// ─────────────────────────────────────────────────────────

const GRAIN = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E`;

const Grain = memo(() => (
  <div
    style={{
      position: "absolute",
      inset: "-50%",
      width: "200%",
      height: "200%",
      opacity: 0.032,
      mixBlendMode: "overlay",
      backgroundImage: `url(${GRAIN})`,
      animation: "grainShift 0.5s steps(1) infinite",
      pointerEvents: "none",
      willChange: "transform",
    }}
  />
));
Grain.displayName = "Grain";

// ─────────────────────────────────────────────────────────
// 🎯 MAIN ENGINE
// ─────────────────────────────────────────────────────────

interface Props {
  src?: string;
  isPlaying: boolean;
  accentColor?: string;
  opacity?: number;
  blur?: number;
  /** ⚠️ beatKey đã bị xoá khỏi interface — không dùng nữa */
}

export const VideoMoodEngine = memo(
  ({
    src,
    isPlaying,
    accentColor = "#7c3aed",
    opacity = 0.82,
    blur = 0,
  }: Props) => {
    injectStyles();

    // ─────────────────────────────────────────────────────
    // CROSSFADE SYSTEM — chỉ chạy khi src thật sự thay đổi
    //
    //  Slot A: video đang hiện
    //  Slot B: video kế — chờ canPlayThrough rồi mới fade in
    //  => Không bao giờ dính đến lyric / beatKey
    // ─────────────────────────────────────────────────────

    const [slotA, setSlotA] = useState<string | undefined>(src);
    const [slotB, setSlotB] = useState<string | undefined>();
    const [active, setActive] = useState<"a" | "b">("a");
    const [bReady, setBReady] = useState(false);

    // Chỉ trigger khi src prop thay đổi
    const prevSrcRef = useRef<string | undefined>(src);
    useEffect(() => {
      if (!src || src === prevSrcRef.current) return;
      prevSrcRef.current = src;

      if (active === "a") {
        setBReady(false);
        setSlotB(src);
        // Slot A stays on screen until B is ready
      } else {
        // B đang active → load vào A rồi switch
        setBReady(false);
        setSlotA(src);
        setActive("a"); // sẽ fade A in, B out
      }
    }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

    const onBReady = useCallback(() => setBReady(true), []);

    // Switch chỉ sau khi B đã buffer xong
    useEffect(() => {
      if (bReady && active === "a") {
        setActive("b");
      }
    }, [bReady]); // eslint-disable-line react-hooks/exhaustive-deps

    const videoFilter = `brightness(0.72) contrast(1.08)${blur ? ` blur(${blur}px)` : ""}`;
    const aOpacity = active === "a" ? opacity : 0;
    const bOpacity = active === "b" ? opacity : 0;

    // ─────────────────────────────────────────────────────
    // FALLBACK
    // ─────────────────────────────────────────────────────

    if (!src) {
      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `
              radial-gradient(circle at 40% 55%, ${accentColor}2e 0%, transparent 65%),
              linear-gradient(160deg, #0a0a0f 0%, #000 100%)
            `,
          }}
        >
          <Grain />
        </div>
      );
    }

    return (
      // ⚡ KHÔNG có key={beatKey} ở đây — component không bao giờ remount vì lyric
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          background: "#000",
        }}
      >
        {/* Ken Burns — chạy liên tục theo chu kỳ, độc lập hoàn toàn */}
        <div
          style={{
            position: "absolute",
            inset: "-6%",
            width: "112%",
            height: "112%",
            // animation luôn chạy khi có src, chỉ pause khi !isPlaying
            // dùng animationPlayState thay vì bật/tắt để không reset chu kỳ
            animation: "kenburns 32s ease-in-out infinite",
            animationPlayState: isPlaying ? "running" : "paused",
          }}
        >
          {/* SLOT A */}
          {slotA && (
            <VideoLayer
              src={slotA}
              isPlaying={isPlaying}
              opacity={aOpacity}
              filter={videoFilter}
            />
          )}

          {/* SLOT B */}
          {slotB && (
            <VideoLayer
              src={slotB}
              isPlaying={isPlaying}
              opacity={bOpacity}
              filter={videoFilter}
              onReady={onBReady}
            />
          )}
        </div>

        {/* Accent color breath — hòa màu với lyric accent, không giật */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse at 50% 80%, ${accentColor}22 0%, transparent 68%)`,
            animation: "colorBreath 6s ease-in-out infinite",
            animationPlayState: isPlaying ? "running" : "paused",
            pointerEvents: "none",
            mixBlendMode: "screen",
          }}
        />

        {/* Vignette — cố định, không animate */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 50% 45%, transparent 28%, rgba(0,0,0,0.72) 100%)",
            pointerEvents: "none",
          }}
        />

        <Grain />
      </div>
    );
  },
);
VideoMoodEngine.displayName = "VideoMoodEngine";
