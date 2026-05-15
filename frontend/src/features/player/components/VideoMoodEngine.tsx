import {
  useRef,
  useEffect,
  useMemo,
  useCallback,
  memo,
  useReducer,
  useState,
} from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CSS — synchronous inject
// ─────────────────────────────────────────────────────────────────────────────

const STYLE_ID = "__vme4-styles__";

const CSS_TEXT = `
@keyframes vme-kb-a {
  0%   { transform: scale3d(1.04,1.04,1) translate3d(0%,    0%,   0); }
  33%  { transform: scale3d(1.08,1.08,1) translate3d(-1.1%, 0.6%, 0); }
  66%  { transform: scale3d(1.06,1.06,1) translate3d(0.7%, -0.8%, 0); }
  100% { transform: scale3d(1.04,1.04,1) translate3d(0%,    0%,   0); }
}
@keyframes vme-kb-b {
  0%   { transform: scale3d(1.06,1.06,1) translate3d(0.7%, -0.5%, 0); }
  33%  { transform: scale3d(1.09,1.09,1) translate3d(-0.5%, 0.7%, 0); }
  66%  { transform: scale3d(1.04,1.04,1) translate3d(0%,    0%,   0); }
  100% { transform: scale3d(1.06,1.06,1) translate3d(0.7%, -0.5%, 0); }
}
@keyframes vme-grain {
  0%,100% { transform: translate3d(0,    0,    0); }
  20%     { transform: translate3d(-2%,  1.5%, 0); }
  40%     { transform: translate3d(1.5%,-2%,   0); }
  60%     { transform: translate3d(-0.5%,0.8%, 0); }
  80%     { transform: translate3d(2%,  -0.5%, 0); }
}
@keyframes vme-breath {
  0%,100% { opacity: 0.10; }
  50%     { opacity: 0.22; }
}
@keyframes vme-vig-pulse {
  0%,100% { opacity: 1; }
  50%     { opacity: 0.92; }
}

.vme-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--color-background);
  contain: layout style paint;
}

.vme-slot {
  position: absolute;
  inset: 0;
  pointer-events: none;
  transition: opacity 1.1s cubic-bezier(0.45, 0, 0.25, 1);
  will-change: opacity;
}
.vme-slot--hidden  { opacity: 0; }
.vme-slot--visible { opacity: 1; }

.vme-loading {
  position: absolute;
  inset: 0;
  background: var(--color-background);
  transition: opacity 0.55s ease;
  pointer-events: none;
  z-index: 8;
}
.vme-loading--out { opacity: 0; }

.vme-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  will-change: transform;
  transform-origin: center center;
}
.vme-video--kb-a { animation: vme-kb-a 38s ease-in-out infinite; }
.vme-video--kb-b { animation: vme-kb-b 38s ease-in-out infinite; animation-delay: -19s; }
.vme-video--paused { animation-play-state: paused !important; }

.vme-grain {
  position: absolute;
  inset: -60%;
  width: 220%;
  height: 220%;
  opacity: 0.028;
  mix-blend-mode: overlay;
  animation: vme-grain 0.65s steps(1) infinite;
  pointer-events: none;
  will-change: transform;
}

.vme-breath {
  position: absolute;
  inset: 0;
  mix-blend-mode: color-dodge;
  pointer-events: none;
  animation: vme-breath 8s ease-in-out infinite;
  z-index: 2;
}
.vme-breath--paused { animation-play-state: paused; }

.vme-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    ellipse 88% 88% at 50% 50%,
    transparent 32%,
    rgba(0,0,0,0.35) 68%,
    rgba(0,0,0,0.75) 100%
  );
  animation: vme-vig-pulse 9s ease-in-out infinite;
  z-index: 3;
}

.vme-scrim-top {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 200px;
  background: linear-gradient(to bottom, rgba(0,0,0,0.44) 0%, rgba(0,0,0,0.08) 65%, transparent 100%);
  pointer-events: none;
  z-index: 4;
}
.vme-scrim-bottom {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 380px;
  background: linear-gradient(to top, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.7) 35%, transparent 100%);
  pointer-events: none;
  z-index: 4;
}
`;

if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = CSS_TEXT;
  document.head.appendChild(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAIN
// ─────────────────────────────────────────────────────────────────────────────

const GRAIN_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E`;

const GrainLayer = memo(() => (
  <div
    className="vme-grain"
    style={{ backgroundImage: `url(${GRAIN_SVG})` }}
    aria-hidden="true"
  />
));
GrainLayer.displayName = "GrainLayer";

// ─────────────────────────────────────────────────────────────────────────────
// SLOT STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────────

interface SlotState {
  a: string | undefined;
  b: string | undefined;
  active: "a" | "b";
  aReady: boolean;
  bReady: boolean;
}

type SlotAction =
  | { type: "SET_SRC"; src: string }
  | { type: "READY"; slot: "a" | "b" };

function slotReducer(state: SlotState, action: SlotAction): SlotState {
  switch (action.type) {
    case "SET_SRC":
      return state.active === "a"
        ? { ...state, b: action.src, bReady: false }
        : { ...state, a: action.src, aReady: false };
    case "READY": {
      const next = {
        ...state,
        aReady: action.slot === "a" ? true : state.aReady,
        bReady: action.slot === "b" ? true : state.bReady,
      };
      // Switch active only when inactive slot becomes ready
      if (action.slot === "b" && state.active === "a" && !state.bReady)
        next.active = "b";
      if (action.slot === "a" && state.active === "b" && !state.aReady)
        next.active = "a";
      return next;
    }
    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO SLOT
// ─────────────────────────────────────────────────────────────────────────────

interface VideoSlotProps {
  src: string;
  isPlaying: boolean;
  visible: boolean;
  kbClass: "vme-video--kb-a" | "vme-video--kb-b";
  videoFilter: string;
  onReady: () => void;
}

const VideoSlot = memo(
  ({
    src,
    isPlaying,
    visible,
    kbClass,
    videoFilter,
    onReady,
  }: VideoSlotProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const prevPlaying = useRef(isPlaying);
    const readyFired = useRef(false);

    const handleReady = useCallback(() => {
      if (readyFired.current) return;
      readyFired.current = true;
      onReady();
    }, [onReady]);

    // Mount: check readyState first (Safari has video buffered but won't fire events)
    useEffect(() => {
      const v = videoRef.current;
      if (!v) return;
      // readyState 3 = HAVE_FUTURE_DATA, 4 = HAVE_ENOUGH_DATA
      if (v.readyState >= 3) handleReady();
      if (isPlaying)
        v.play().catch(() => setTimeout(() => v.play().catch(() => {}), 80));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Play/pause guard
    useEffect(() => {
      const v = videoRef.current;
      if (!v || isPlaying === prevPlaying.current) return;
      prevPlaying.current = isPlaying;
      if (isPlaying) {
        v.play().catch(() => {
          const t = setTimeout(() => v.play().catch(() => {}), 80);
          return () => clearTimeout(t);
        });
      } else {
        v.pause();
      }
    }, [isPlaying]);

    return (
      <div
        className={`vme-slot ${visible ? "vme-slot--visible" : "vme-slot--hidden"}`}
        aria-hidden="true"
      >
        <video
          ref={videoRef}
          src={src}
          muted
          loop
          playsInline
          preload="auto"
          onCanPlay={handleReady}
          onCanPlayThrough={handleReady}
          style={{ filter: videoFilter }}
          className={`vme-video ${kbClass}${isPlaying ? "" : " vme-video--paused"}`}
        />
      </div>
    );
  },
  (prev, next) =>
    prev.src === next.src &&
    prev.isPlaying === next.isPlaying &&
    prev.visible === next.visible &&
    prev.kbClass === next.kbClass &&
    prev.videoFilter === next.videoFilter,
);
VideoSlot.displayName = "VideoSlot";

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface VideoMoodEngineProps {
  src?: string;
  isPlaying: boolean;
  accentColor?: string;
  opacity?: number;
  blur?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export const VideoMoodEngine = memo(
  ({
    src,
    isPlaying,
    accentColor = "primary",
    blur = 0,
  }: VideoMoodEngineProps) => {
    const [slots, dispatch] = useReducer(slotReducer, {
      a: src,
      b: undefined,
      active: "a",
      aReady: false,
      bReady: false,
    });
    const [firstReady, setFirstReady] = useState(false);
    const prevSrc = useRef(src);

    useEffect(() => {
      if (!src || src === prevSrc.current) return;
      prevSrc.current = src;
      dispatch({ type: "SET_SRC", src });
    }, [src]);

    const onAReady = useCallback(() => {
      dispatch({ type: "READY", slot: "a" });
      setFirstReady(true);
    }, []);
    const onBReady = useCallback(() => {
      dispatch({ type: "READY", slot: "b" });
      setFirstReady(true);
    }, []);

    const videoFilter = useMemo(() => {
      const p = ["brightness(0.58)", "contrast(1.14)", "saturate(0.82)"];
      if (blur) p.push(`blur(${blur}px)`);
      return p.join(" ");
    }, [blur]);

    const breathStyle = useMemo(
      () => ({
        background: `radial-gradient(ellipse 65% 52% at 50% 65%, ${accentColor}2a, transparent 75%)`,
        filter: "blur(24px)",
      }),
      [accentColor],
    );

    return (
      <div className="vme-container">
        {slots.a && (
          <VideoSlot
            src={slots.a}
            isPlaying={isPlaying}
            visible={slots.active === "a" && slots.aReady}
            kbClass="vme-video--kb-a"
            videoFilter={videoFilter}
            onReady={onAReady}
          />
        )}
        {slots.b && (
          <VideoSlot
            src={slots.b}
            isPlaying={isPlaying}
            visible={slots.active === "b" && slots.bReady}
            kbClass="vme-video--kb-b"
            videoFilter={videoFilter}
            onReady={onBReady}
          />
        )}

        {/* Loading overlay — prevents black flash */}
        <div
          className={`vme-loading${firstReady ? " vme-loading--out" : ""}`}
          aria-hidden="true"
        />

        <div
          className={`vme-breath${isPlaying ? "" : " vme-breath--paused"}`}
          style={breathStyle}
        />
        <div className="vme-vignette" />
        <div className="vme-scrim-top" />
        <div className="vme-scrim-bottom" />
        <GrainLayer />
      </div>
    );
  },
);

VideoMoodEngine.displayName = "VideoMoodEngine";
export default VideoMoodEngine;
