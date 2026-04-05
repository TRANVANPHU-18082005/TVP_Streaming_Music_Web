import { useEffect, memo, useCallback, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";

const ML_STYLE_ID = "__ml-styles__";
const ML_CSS = `
  @keyframes ml-idle-pulse {
    0%,100% { opacity: 0.15; transform: scale(1); }
    50%      { opacity: 0.35; transform: scale(1.1); }
  }
  .ml-idle { animation: ml-idle-pulse 2.6s ease-in-out infinite; }
`;

function injectMLStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(ML_STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = ML_STYLE_ID;
  s.textContent = ML_CSS;
  document.head.appendChild(s);
}

// Chỉ crossfade đơn giản — không spring, không scale, không blur lag
const LINE_VARIANTS = {
  enter: { opacity: 0, y: 12 },
  center: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.24, ease: [0.4, 0, 1, 1] },
  },
};

export interface MoodLyricLineProps {
  currentText: string;
  accentColor?: string;
  onSeek?: (timeS: number) => void;
  currentStartTimeMs?: number;
  currentIndex: number;
}

export const MoodLyricLine = memo(
  ({
    currentText,
    accentColor = "#a78bfa",
    onSeek,
    currentStartTimeMs,
    currentIndex,
  }: MoodLyricLineProps) => {
    useEffect(() => {
      injectMLStyles();
    }, []);

    const handleClick = useCallback(() => {
      if (onSeek && currentStartTimeMs !== undefined) {
        onSeek(currentStartTimeMs / 1000);
      }
    }, [onSeek, currentStartTimeMs]);

    const glowStyle: CSSProperties = {
      textShadow: `
        0 0 24px ${accentColor}55,
        0 1px 3px rgba(0,0,0,1),
        0 3px 12px rgba(0,0,0,0.9)
      `,
    };

    // Wrapper fixed bottom — scrim chỉ ở vùng lyric
    const wrapperStyle: CSSProperties = {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingBottom: 32,
      paddingTop: 64,
      background:
        "linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 55%, transparent 100%)",
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
      maxWidth: 600,
      padding: "0 1rem",
      pointerEvents: onSeek ? "auto" : "none",
      cursor: onSeek ? "pointer" : "default",
      WebkitTapHighlightColor: "transparent",
    };

    return (
      <div style={wrapperStyle}>
        <div
          style={innerStyle}
          onClick={handleClick}
          role={onSeek ? "button" : undefined}
          aria-label={
            onSeek && currentText ? `Seek to: ${currentText}` : undefined
          }
        >
          {/* Chỉ 1 line duy nhất — AnimatePresence mode="wait" đảm bảo exit xong mới enter */}
          <AnimatePresence mode="wait" initial={false}>
            {currentText ? (
              <motion.p
                key={`line-${currentIndex}`}
                variants={LINE_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                style={{
                  fontSize: "clamp(12.4px, 2.0vw, 16.4px)",
                  fontWeight: 600,
                  color: "#ffffff",
                  letterSpacing: "0.015em",
                  lineHeight: 1.4,
                  margin: 0,
                  userSelect: "none",
                  textAlign: "center",
                  // Pill backdrop mỏng
                  display: "inline-block",
                  padding: "0.2em 0.85em",
                  borderRadius: "77px",
                  background: "rgba(0,0,0,0.3)",
                  backdropFilter: "blur(12px) saturate(1.3)",
                  WebkitBackdropFilter: "blur(12px) saturate(1.3)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  ...glowStyle,
                }}
              >
                {currentText}
              </motion.p>
            ) : (
              // Empty state — 3 dots nhẹ nhàng
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                style={{
                  display: "flex",
                  gap: 7,
                  alignItems: "center",
                  height: 34,
                }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="ml-idle"
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: accentColor,
                      animationDelay: `${i * 0.36}s`,
                      boxShadow: `0 0 8px ${accentColor}99`,
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
