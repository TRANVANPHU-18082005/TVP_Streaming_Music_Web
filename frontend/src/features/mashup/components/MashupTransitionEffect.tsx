import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TransitionType } from "../types";

interface MashupTransitionEffectProps {
  transitionState: "idle" | "transitioning";
  transitionType: TransitionType | null;
  nextTrackTitle?: string;
  nextTrackArtist?: string;
}

/**
 * Visual overlay effects for DJ mashup transitions.
 * Renders fullscreen overlays matching the audio transition effect.
 */
export const MashupTransitionEffect = ({
  transitionState,
  transitionType,
  nextTrackTitle,
  nextTrackArtist,
}: MashupTransitionEffectProps) => {
  const isActive = transitionState === "transitioning";

  return (
    <AnimatePresence>
      {isActive && (
        <>
          {/* ── Crossfade: soft white flash ──────────────────────────── */}
          {transitionType === "crossfade" && (
            <motion.div
              key="crossfade"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.15, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, times: [0, 0.3, 1] }}
              className="absolute inset-0 z-30 bg-white pointer-events-none"
            />
          )}

          {/* ── Hard Cut: sharp flash ─────────────────────────────────── */}
          {transitionType === "cut" && (
            <motion.div
              key="cut"
              initial={{ opacity: 0.8 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 z-30 bg-white pointer-events-none"
            />
          )}

          {/* ── Beat Match: ripple from center ───────────────────────── */}
          {transitionType === "beatmatch" && (
            <motion.div
              key="beatmatch"
              className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full border-2 border-primary"
                  initial={{ width: 0, height: 0, opacity: 0.8 }}
                  animate={{ width: "120vw", height: "120vw", opacity: 0 }}
                  transition={{ duration: 1.5, delay: i * 0.3, ease: "easeOut" }}
                />
              ))}
            </motion.div>
          )}

          {/* ── Echo Out: blur pulse ──────────────────────────────────── */}
          {transitionType === "echo-out" && (
            <motion.div
              key="echo-out"
              className="absolute inset-0 z-30 pointer-events-none"
              initial={{ backdropFilter: "blur(0px)", opacity: 0 }}
              animate={{
                backdropFilter: ["blur(0px)", "blur(8px)", "blur(0px)"],
                opacity: [0, 0.3, 0],
              }}
              transition={{ duration: 1.5, times: [0, 0.5, 1] }}
            />
          )}

          {/* ── Filter Sweep: dark overlay sweep from bottom ─────────── */}
          {transitionType === "filter-sweep" && (
            <motion.div
              key="filter-sweep"
              className="absolute inset-0 z-30 pointer-events-none overflow-hidden"
            >
              <motion.div
                className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent"
                initial={{ height: "0%" }}
                animate={{ height: ["0%", "100%", "0%"] }}
                transition={{ duration: 1.8, times: [0, 0.55, 1] }}
              />
            </motion.div>
          )}

          {/* ── Stutter: rapid opacity flash ─────────────────────────── */}
          {transitionType === "stutter" && (
            <motion.div
              key="stutter"
              className="absolute inset-0 z-30 bg-black pointer-events-none"
              animate={{
                opacity: [0, 0.9, 0, 0.9, 0, 0.9, 0, 0.7, 0],
              }}
              transition={{
                duration: 0.8,
                times: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1],
                ease: "linear",
              }}
            />
          )}

          {/* ── Build → Drop: dramatic darkening ─────────────────────── */}
          {transitionType === "build-drop" && (
            <motion.div
              key="build-drop"
              className="absolute inset-0 z-30 pointer-events-none"
            >
              {/* Dark buildup */}
              <motion.div
                className="absolute inset-0 bg-black"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.85, 0] }}
                transition={{ duration: 1.5, times: [0, 0.8, 1] }}
              />
              {/* Flash on drop */}
              <motion.div
                className="absolute inset-0 bg-primary/30"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0, 0.6, 0] }}
                transition={{ duration: 1.5, times: [0, 0.78, 0.85, 1] }}
              />
            </motion.div>
          )}

          {/* ── Vinyl Scratch: horizontal strobe lines ────────────────── */}
          {transitionType === "vinyl-scratch" && (
            <motion.div
              key="vinyl-scratch"
              className="absolute inset-0 z-30 pointer-events-none overflow-hidden"
            >
              {[20, 40, 55, 70, 85].map((top, i) => (
                <motion.div
                  key={i}
                  className="absolute h-px bg-white/80 left-0 right-0"
                  style={{ top: `${top}%` }}
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={{
                    scaleX: [0, 1, 0],
                    opacity: [0, 0.8, 0],
                  }}
                  transition={{ duration: 0.4, delay: i * 0.08, ease: "easeInOut" }}
                />
              ))}
              <motion.div
                className="absolute inset-0 bg-black/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.6, 0] }}
                transition={{ duration: 0.5 }}
              />
            </motion.div>
          )}

          {/* ── Next Track Announcement (all transitions) ─────────────── */}
          {nextTrackTitle && (
            <motion.div
              key="next-track-label"
              className="absolute top-1/2 left-0 right-0 -translate-y-1/2 z-40 flex justify-center pointer-events-none"
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -10], scale: [0.9, 1, 1, 0.95] }}
              transition={{ duration: 1.8, times: [0, 0.2, 0.7, 1] }}
            >
              <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-4 flex flex-col items-center gap-1 shadow-2xl">
                <span className="text-white/50 text-[10px] uppercase tracking-widest font-semibold">
                  ▶ Tiếp theo
                </span>
                <span className="text-white font-bold text-lg leading-tight text-center">
                  {nextTrackTitle}
                </span>
                {nextTrackArtist && (
                  <span className="text-white/60 text-sm">{nextTrackArtist}</span>
                )}
              </div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
};
