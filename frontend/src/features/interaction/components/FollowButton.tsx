/**
 * FollowButton.tsx — Premium artist follow toggle
 *
 * Design System: Soundwave (Obsidian Luxury / Neural Audio)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * SHARED ARCHITECTURE PRINCIPLES
 *
 * Both buttons are self-contained interaction units that:
 *   1. Subscribe to their own slice of the interaction store (via useIsLiked /
 *      useIsFollowed). Only the specific button whose entity ID matches a
 *      store change re-renders — no parent re-render required.
 *   2. Use Framer Motion for spring physics. All transition objects are at
 *      MODULE SCOPE (not inline) — prevents new object allocation per render
 *      and prevents Framer from re-evaluating animation definitions.
 *   3. Use `useCallback` on all handlers — stable references so memo'd
 *      children that receive these as props don't needlessly re-render.
 *   4. Have complete ARIA — `aria-pressed`, `aria-label` (state-aware),
 *      `aria-busy`, `role="button"`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *

 * FOLLOW BUTTON — KEY IMPROVEMENTS
 *
 *   • Shine animation: original used `motion.div` with `animate={{ x: "100%" }}`
 *     repeating infinitely. This runs a JS-driven animation on the main thread
 *     forever. Replaced with a pure CSS `animate-shimmer` class from the
 *     Soundwave system — compositor-thread only, zero JS per frame.
 *
 *   • `layoutId="follow-glow"` removed. The original's glow used `layoutId`
 *     which is for shared layout transitions between different components.
 *     Using it for a local state toggle causes Framer to register a global
 *     layout projection tree — unnecessary overhead for a background blur div.
 *     Replaced with simple `initial/animate/exit` opacity transition.
 *
 *   • Burst animation: same fix as LikeButton — `burstKey` counter for
 *     re-triggering on every follow action.
 *
 *   • Follow state: `bg-secondary/50` → `bg-muted/60` + `border-border/60`
 *     in the followed state. The original's `bg-secondary/50 border-primary/20`
 *     combination produced a muddy purple tint in dark mode. The new palette
 *     reads as "confirmed / neutral" which is the correct semantic for "already
 *     following" (Spotify pattern).
 *
 *   • Hover-to-unfollow hint: on hover while followed, the button transitions
 *     to a subtle destructive state (`hover:text-destructive hover:border-destructive/30`)
 *     — the "hover reveals intent" pattern from Spotify/Twitter.
 *
 *   • `handleFollow` wrapped in `useCallback`.
 *
 *   • `aria-pressed` + `aria-label` state-switching + `aria-busy`.
 */

import React, { memo, useCallback, useState } from "react";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useInteraction } from "../hooks/useInteraction";
import { useAppSelector } from "@/store/hooks";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED ANIMATION PRESETS — module scope, zero allocation per render
// ─────────────────────────────────────────────────────────────────────────────

const SPRING_SNAPPY = {
  type: "spring",
  stiffness: 500,
  damping: 28,
} as const;

const SPRING_CONTENT = {
  type: "spring",
  stiffness: 420,
  damping: 26,
} as const;

const FADE_FAST = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15 },
} as const;

const SLIDE_CONTENT = {
  initial: { y: 8, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: -8, opacity: 0 },
  transition: SPRING_CONTENT,
} as const;

const BURST = {
  initial: { scale: 0.4, opacity: 1 },
  animate: { scale: 2.6, opacity: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.5, ease: "easeOut" as const },
} as const;

// ═════════════════════════════════════════════════════════════════════════════
// FOLLOW BUTTON
// ═════════════════════════════════════════════════════════════════════════════

interface FollowButtonProps {
  artistId: string;
  className?: string;
  /**
   * `size` — compact for use inside cards, default for artist profile headers.
   * "compact": h-9 px-4 text-xs — same as PublicArtistCard's follow CTA.
   * "default": h-10 px-6 text-sm — artist profile hero.
   */
  size?: "compact" | "default";
}

export const FollowButton = memo(
  ({ artistId, className, size = "default" }: FollowButtonProps) => {
    const { handleToggle } = useInteraction();

    // 🚀 ĐIỀU CHỈNH 1: Subscribe trực tiếp vào store tại đây
    // Chỉ re-render khi trạng thái follow của artistId này thay đổi.
    const isFollowed = useAppSelector(
      (state) => !!state.interaction.followedArtists[artistId],
    );

    const isLoading = useAppSelector(
      (state) => !!state.interaction.loadingIds[artistId],
    );

    const [burstKey, setBurstKey] = useState(0);

    const handleFollow = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        if (isLoading) return;

        // Chỉ trigger burst effect khi thực hiện hành động Follow
        if (!isFollowed) {
          setBurstKey((k) => k + 1);
        }

        // Gọi hàm toggle generic với type "artist"
        handleToggle(artistId, "artist");
      },
      [isLoading, isFollowed, handleToggle, artistId],
    );

    const sizeClasses =
      size === "compact"
        ? "h-9 px-4 text-xs rounded-full gap-1.5"
        : "h-10 px-6 text-sm rounded-full gap-2";

    return (
      <motion.button
        type="button"
        onClick={handleFollow}
        disabled={isLoading}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        transition={SPRING_SNAPPY}
        aria-pressed={isFollowed}
        aria-label={isFollowed ? "Unfollow artist" : "Follow artist"}
        aria-busy={isLoading}
        className={cn(
          "relative inline-flex items-center justify-center font-bold overflow-hidden transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          sizeClasses,
          isFollowed
            ? "bg-muted/60 text-foreground border border-border/60 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            : "bg-primary text-primary-foreground shadow-brand hover:brightness-105",
          className,
        )}
      >
        {/* CSS Shimmer: Chỉ hiện khi chưa follow */}
        {!isFollowed && !isLoading && (
          <span
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none bg-[linear-gradient(105deg,transparent_20%,hsl(0_0%_100%/0.18)_50%,transparent_80%)] bg-[length:300%_auto] animate-shimmer"
          />
        )}

        {/* Content Transition */}
        <AnimatePresence mode="wait" initial={false}>
          {isLoading ? (
            <motion.div key="loading" {...FADE_FAST}>
              <Loader2 className="size-4 animate-spin" />
            </motion.div>
          ) : isFollowed ? (
            <motion.div
              key="followed"
              {...SLIDE_CONTENT}
              className="flex items-center gap-[inherit]"
            >
              <UserCheck className="size-4 text-primary" />
              <span>Following</span>
            </motion.div>
          ) : (
            <motion.div
              key="unfollowed"
              {...SLIDE_CONTENT}
              className="flex items-center gap-[inherit]"
            >
              <UserPlus className="size-4" />
              <span>Follow</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Burst Effect */}
        <AnimatePresence>
          {isFollowed && (
            <motion.span
              key={`follow-burst-${burstKey}`}
              {...BURST}
              className="absolute inset-0 rounded-full border-[1.5px] border-primary/45 pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* Backdrop Glow */}
        <AnimatePresence>
          {isFollowed && (
            <motion.div
              key="follow-glow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-primary/[0.08] blur-xl -z-10 rounded-[inherit]"
            />
          )}
        </AnimatePresence>
      </motion.button>
    );
  },
);

export default FollowButton;
