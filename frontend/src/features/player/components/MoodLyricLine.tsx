"use client";

import {
  useRef,
  useEffect,
  useMemo,
  memo,
  useCallback,
  type CSSProperties,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const STYLE_ID = "__ml2-styles__";

const CSS = `
@keyframes ml-idle-pulse {
  0%,100% { opacity: 0.18; transform: scale(1); }
  50%     { opacity: 0.38; transform: scale(1.12); }
}
@keyframes ml-beat {
  0%   { transform: scale(1); }
  30%  { transform: scale(1.035); }
  65%  { transform: scale(0.998); }
  100% { transform: scale(1); }
}
.ml-idle-dot {
  animation: ml-idle-pulse 2.6s ease-in-out infinite;
}
.ml-line-beat {
  animation: ml-beat 0.32s cubic-bezier(.34,1.56,.64,1) both;
}

/* Karaoke word fill — mirrors LyricsView KWord */
.ml-word {
  position: relative;
  display: inline-block;
  margin-right: 0.28em;
}
.ml-word__base {
  display: block;
  color: rgba(255,255,255,0.22);
  white-space: pre;
  transition: color 0.14s ease, text-shadow 0.14s ease;
}
.ml-word__fill {
  position: absolute; top: 0; left: 0;
  display: block; white-space: pre;
  pointer-events: none;
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
  clip-path: inset(0 calc(100% - var(--ml-fill, 0%)) 0 0);
  will-change: clip-path;
  transition: clip-path 0.05s linear;
}
.ml-word--active .ml-word__base {
  color: rgba(255,255,255,0.52);
  text-shadow: 0 0 18px rgba(79,172,254,0.5);
}
.ml-word--done .ml-word__fill { clip-path: inset(0 0 0 0); }

/* Degraded: no fill */
.ml-degraded .ml-word__fill { display: none; }
.ml-degraded .ml-line-active .ml-word__base { color: #ffffff; }

/* Synced mode: whole-line highlight */
.ml-synced-text {
  transition: color 0.28s ease, text-shadow 0.28s ease;
}
.ml-synced-text--active {
  color: #ffffff;
  text-shadow: 0 0 28px rgba(79,172,254,0.45);
}
.ml-synced-text--inactive {
  color: rgba(255,255,255,0.22);
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

// ─────────────────────────────────────────────────────────────────────────────
// TYPES — mirror IKaraokeLine word shape
// ─────────────────────────────────────────────────────────────────────────────

export interface MoodWord {
  word: string;
  startTime: number; // ms
  endTime: number; // ms
}

// ─────────────────────────────────────────────────────────────────────────────
// KARAOKE WORD — GPU clip-path fill
// ─────────────────────────────────────────────────────────────────────────────

const MoodKWord = memo(
  ({
    word,
    startTime,
    endTime,
    rafMs,
    active,
    fontSize,
    accentColor,
  }: {
    word: string;
    startTime: number;
    endTime: number;
    rafMs: number;
    active: boolean;
    fontSize: string;
    accentColor: string;
  }) => {
    const fillRef = useRef<HTMLSpanElement>(null);

    const progress = useMemo(() => {
      if (!active) return rafMs >= endTime ? 1 : 0;
      const dur = endTime - startTime;
      if (dur <= 0) return rafMs >= startTime ? 1 : 0;
      return Math.max(0, Math.min(1, (rafMs - startTime) / dur));
    }, [active, rafMs, startTime, endTime]);

    // Direct DOM mutation — no React re-render per rAF frame
    useEffect(() => {
      fillRef.current?.style.setProperty(
        "--ml-fill",
        `${Math.round(progress * 100)}%`,
      );
    }, [progress]);

    const isDone = progress >= 1;
    const isActive = active && progress > 0 && !isDone;

    const fillGradient = `linear-gradient(90deg, ${accentColor} 0%, #00f2fe 50%, #ffffff 100%)`;

    return (
      <span
        className={`ml-word${isActive ? " ml-word--active" : ""}${isDone ? " ml-word--done" : ""}`}
      >
        <span className="ml-word__base" style={{ fontSize }}>
          {word}
        </span>
        <span
          ref={fillRef}
          className="ml-word__fill"
          style={{ fontSize, background: fillGradient }}
          aria-hidden="true"
        >
          {word}
        </span>
      </span>
    );
  },
);
MoodKWord.displayName = "MoodKWord";

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface MoodLyricLineProps {
  /** Text of current line (always required) */
  currentText: string;
  /** Word-level timing for karaoke fill (optional) */
  currentWords?: MoodWord[];
  /** rAF-driven ms from useRafTime (required for karaoke/synced sync) */
  rafMs: number;
  /** Current line index — drives AnimatePresence key */
  currentIndex: number;
  /** startTime of current line in ms — for seek */
  currentStartTimeMs?: number;
  /** Index of word currently sung (drives beat pulse) */
  beatKey?: number;
  /** Accent color for fill gradient */
  accentColor?: string;
  /** If true: hide fill, only highlight line */
  degraded?: boolean;
  /** Mode: "karaoke" = word fill, "synced" = line-level highlight */
  mode?: "karaoke" | "synced";
  onSeek?: (timeS: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const MoodLyricLine = memo(
  ({
    currentText,
    currentWords,
    rafMs,
    currentIndex,
    currentStartTimeMs,
    beatKey = -1,
    accentColor = "primary",
    degraded = false,
    mode = "synced",
    onSeek,
  }: MoodLyricLineProps) => {
    useEffect(() => {
      injectStyles();
    }, []);
    const lineRef = useRef<HTMLDivElement>(null);
    const prevBeat = useRef(-1);

    // Beat pulse on word boundary
    useEffect(() => {
      if (beatKey < 0 || beatKey === prevBeat.current) return;
      prevBeat.current = beatKey;
      const el = lineRef.current;
      if (!el) return;
      el.classList.remove("ml-line-beat");
      void el.offsetWidth;
      el.classList.add("ml-line-beat");
      const t = setTimeout(() => el.classList.remove("ml-line-beat"), 360);
      return () => clearTimeout(t);
    }, [beatKey]);

    const handleClick = useCallback(() => {
      if (onSeek && currentStartTimeMs !== undefined) {
        onSeek(currentStartTimeMs / 1000);
      }
    }, [onSeek, currentStartTimeMs]);

    // Adaptive font size
    const fontSize = useMemo(() => {
      const len = currentText.length;
      if (len <= 12) return "clamp(15px, 2.4vw, 19px)";
      if (len <= 22) return "clamp(13.5px, 2.1vw, 17px)";
      if (len <= 35) return "clamp(12px, 1.85vw, 15.5px)";
      return "clamp(11px, 1.65vw, 14px)";
    }, [currentText.length]);

    const wrapperStyle: CSSProperties = {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingBottom: 28,
      paddingTop: 72,
      background:
        "linear-gradient(to top, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.22) 55%, transparent 100%)",
      pointerEvents: "none",
      zIndex: 30,
      display: "flex",
      justifyContent: "center",
    };

    const innerStyle: CSSProperties = {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      width: "100%",
      maxWidth: 640,
      padding: "0 0.7rem",
      pointerEvents: onSeek ? "auto" : "none",
      cursor: onSeek ? "pointer" : "default",
      WebkitTapHighlightColor: "transparent",
    };

    const hasWords =
      mode === "karaoke" &&
      currentWords &&
      currentWords.length > 0 &&
      !degraded;

    return (
      <div style={wrapperStyle}>
        <div
          style={innerStyle}
          onClick={handleClick}
          role={onSeek ? "button" : undefined}
          tabIndex={onSeek ? 0 : undefined}
          aria-label={
            onSeek && currentText ? `Seek to: ${currentText}` : undefined
          }
          onKeyDown={(e) => {
            if (onSeek && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              handleClick();
            }
          }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {currentText ? (
              <motion.div
                key={`line-${currentIndex}`}
                initial={{ opacity: 0, y: 14, scale: 0.96 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
                }}
                exit={{
                  opacity: 0,
                  y: -10,
                  scale: 0.97,
                  transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
                }}
                style={{
                  display: "inline-block",
                  padding: "0.2em 0.7em",
                  borderRadius: "50px",
                  background: "rgba(0,0,0,0.28)",
                  backdropFilter: "blur(14px) saturate(1.35)",
                  WebkitBackdropFilter: "blur(14px) saturate(1.35)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  lineHeight: 1,
                  userSelect: "none",
                  textAlign: "center",
                }}
              >
                <div
                  ref={lineRef}
                  className={`ml-line-active${degraded ? " ml-degraded" : ""}`}
                  style={{ lineHeight: 1.42 }}
                >
                  {hasWords ? (
                    // KARAOKE MODE — word-level fill
                    <span>
                      {currentWords!.map((w, i) => (
                        <MoodKWord
                          key={i}
                          word={w.word}
                          startTime={w.startTime}
                          endTime={w.endTime}
                          rafMs={rafMs}
                          active={true}
                          fontSize={fontSize}
                          accentColor={accentColor}
                        />
                      ))}
                    </span>
                  ) : (
                    // SYNCED MODE — whole-line color transition
                    <span
                      className="ml-synced-text ml-synced-text--active"
                      style={{
                        fontSize,
                        fontWeight: 650,
                        letterSpacing: "0.012em",
                      }}
                    >
                      {currentText}
                    </span>
                  )}
                </div>
              </motion.div>
            ) : (
              // IDLE — 3 dots
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  height: 36,
                }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="ml-idle-dot bg-primary"
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: accentColor,
                      opacity: 0.5,
                      animationDelay: `${i * 0.38}s`,
                    }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  },
);

MoodLyricLine.displayName = "MoodLyricLine";
export default MoodLyricLine;
