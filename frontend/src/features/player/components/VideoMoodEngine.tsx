import { useRef, useEffect, useState, useCallback, memo } from "react";
import { motion } from "framer-motion";

const STYLE_ID = "__video_mood_pro__";

const CSS = `
@keyframes kenburns-a {
  0%   { transform: scale(1)    translate(0, 0); }
  25%  { transform: scale(1.07) translate(-0.8%, 0.4%); }
  50%  { transform: scale(1.05) translate(0.6%, -0.6%); }
  75%  { transform: scale(1.08) translate(-0.4%, 0.8%); }
  100% { transform: scale(1)    translate(0, 0); }
}
@keyframes kenburns-b {
  0%   { transform: scale(1.05) translate(0.6%, -0.4%); }
  25%  { transform: scale(1.08) translate(-0.4%, 0.6%); }
  50%  { transform: scale(1)    translate(0, 0); }
  75%  { transform: scale(1.06) translate(0.8%, -0.8%); }
  100% { transform: scale(1.05) translate(0.6%, -0.4%); }
}
@keyframes grainShift {
  0%   { transform: translate(0, 0); }
  25%  { transform: translate(-2%, 2%); }
  50%  { transform: translate(2%, -2%); }
  75%  { transform: translate(-1%, 1%); }
  100% { transform: translate(0, 0); }
}
@keyframes colorBreath {
  0%,100% { opacity: 0.18; }
  50%     { opacity: 0.28; }
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

// ─── VIDEO LAYER — Ken Burns riêng từng slot ───────────────

const VideoLayer = memo(
  ({
    src,
    isPlaying,
    opacity,
    filter,
    kbAnimation, // "kenburns-a" | "kenburns-b"
    kbDelay, // animationDelay để lệch pha
    onReady,
  }: {
    src: string;
    isPlaying: boolean;
    opacity: number;
    filter: string;
    kbAnimation: string;
    kbDelay: string;
    onReady?: () => void;
  }) => {
    const ref = useRef<HTMLVideoElement>(null);

    useEffect(() => {
      const v = ref.current;
      if (!v) return;
      if (isPlaying) v.play().catch(() => {});
      else v.pause();
    }, [isPlaying]);

    return (
      <motion.div
        animate={{ opacity }}
        transition={{ duration: 1.6, ease: "easeInOut" }}
        style={{
          position: "absolute",
          inset: "-6%",
          width: "112%",
          height: "112%",
          filter,
        }}
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
            animation: `${kbAnimation} 32s ease-in-out infinite`,
            animationDelay: kbDelay,
            animationPlayState: isPlaying ? "running" : "paused",
            willChange: "transform",
          }}
        />
      </motion.div>
    );
  },
);
VideoLayer.displayName = "VideoLayer";

// ─── MAIN ENGINE ───────────────────────────────────────────

interface Props {
  src?: string;
  isPlaying: boolean;
  accentColor?: string;
  opacity?: number;
  blur?: number;
}

export const VideoMoodEngine = memo(
  ({
    src,

    isPlaying,

    opacity = 0.82,
    blur = 0,
  }: Props) => {
    // ✅ Side effect ra khỏi render
    useEffect(() => {
      injectStyles();
    }, []);

    const [slotA, setSlotA] = useState<string | undefined>(src);
    const [slotB, setSlotB] = useState<string | undefined>();
    const [active, setActive] = useState<"a" | "b">("a");
    const [aReady, setAReady] = useState(false);
    const [bReady, setBReady] = useState(false);

    const prevSrcRef = useRef<string | undefined>(src);

    useEffect(() => {
      if (!src || src === prevSrcRef.current) return;
      prevSrcRef.current = src;

      // Load vào slot không active, chờ ready rồi mới switch
      if (active === "a") {
        setBReady(false);
        setSlotB(src);
      } else {
        setAReady(false);
        setSlotA(src);
      }
    }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

    // ✅ Switch chỉ sau khi slot đích đã buffer xong
    useEffect(() => {
      if (bReady && active === "a") setActive("b");
    }, [bReady]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      if (aReady && active === "b") setActive("a");
    }, [aReady]);

    const onAReady = useCallback(() => setAReady(true), []);
    const onBReady = useCallback(() => setBReady(true), []);

    const videoFilter = `brightness(0.68) contrast(1.1) saturate(0.9)${
      blur ? ` blur(${blur}px)` : ""
    }`;
    const aOpacity = active === "a" ? opacity : 0;
    const bOpacity = active === "b" ? opacity : 0;
    if (!src) {
      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "transparent",
          }}
        >
          <Grain />
        </div>
      );
    }

    return (
      <>
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            background: "transparent",
          }}
        >
          {/* ✅ Ken Burns riêng từng slot, lệch pha 16s */}
          {slotA && (
            <VideoLayer
              src={slotA}
              isPlaying={isPlaying}
              opacity={aOpacity}
              filter={videoFilter}
              kbAnimation="kenburns-a"
              kbDelay="0s"
              onReady={onAReady}
            />
          )}

          {slotB && (
            <VideoLayer
              src={slotB}
              isPlaying={isPlaying}
              opacity={bOpacity}
              filter={videoFilter}
              kbAnimation="kenburns-b"
              kbDelay="-16s" // lệch pha để B không đồng bộ với A
              onReady={onBReady}
            />
          )}

          {/* Accent glow — color-dodge tự nhiên hơn trên nền tối */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              animation: "colorBreath 6s ease-in-out infinite",
              animationPlayState: isPlaying ? "running" : "paused",
              pointerEvents: "none",
              mixBlendMode: "color-dodge",
            }}
          />

          {/* Vignette */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "transparent",
              pointerEvents: "none",
            }}
          />

          <Grain />
        </div>
      </>
    );
  },
);
VideoMoodEngine.displayName = "VideoMoodEngine";
