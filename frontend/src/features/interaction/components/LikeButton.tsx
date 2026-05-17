/**
 * LikeButton variants — Soundwave Design System
 *
 * TrackLikeButton   → inline trong TrackList row, compact, ghost style
 * AlbumLikeButton   → card overlay (size sm) + hero detail (size lg)
 * PlaylistLikeButton→ card overlay (size sm) + detail header (size lg)
 *
 * Tất cả đều dùng design tokens từ index.css:
 *   --error, --primary, --brand-glow, --wave-*, --muted, --foreground
 *   glass-frosted, shadow-brand, animate-pop-in, like-btn, control-btn
 */

import { memo, useCallback, useState } from "react";
import { Heart, Loader2, BookHeart, Disc3 } from "lucide-react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { cn } from "@/lib/utils";
import { useInteraction } from "../hooks/useInteraction";
import { useAppSelector } from "@/store/hooks";
import { selectIsInteracted } from "../slice/interactionSlice";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED
// ─────────────────────────────────────────────────────────────────────────────

const SPRING_SNAPPY = { type: "spring", stiffness: 500, damping: 28 } as const;
const SPRING_SOFT = { type: "spring", stiffness: 340, damping: 26 } as const;
const SPRING_BOUNCY = { type: "spring", stiffness: 560, damping: 22 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// 1. TRACK LIKE BUTTON
//    Dùng trong TrackList row — inline, compact, tối giản
//    Không có nền, chỉ icon + ripple nhỏ + count (optional)
//    Hover: icon scale + màu --error
//    Active/liked: fill + glow nhỏ + pop animation
// ─────────────────────────────────────────────────────────────────────────────

interface TrackLikeButtonProps {
  id: string;
  /** Hiện số lượt like */
  likeCount?: number;
  /** Hiện/ẩn số đếm */
  showCount?: boolean;
  className?: string;
}

export const TrackLikeButton = memo(
  ({ id, likeCount, showCount = false, className }: TrackLikeButtonProps) => {
    const { handleToggle } = useInteraction();
    // 1. Lấy trạng thái ĐÃ LIKE hay chưa (O(1))
    const isLiked = useAppSelector((state) =>
      selectIsInteracted(state, id, "track"),
    );

    // 2. Lấy trạng thái ĐANG XỬ LÝ API của riêng ID này
    const isPending = useAppSelector(
      (state) => state.interaction.loadingIds[`track:${id}`],
    );
    const [burstKey, setBurstKey] = useState(0);

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (isPending) return;
        if (!isLiked) setBurstKey((k) => k + 1);
        handleToggle(id, "track");
      },
      [isPending, isLiked, handleToggle, id],
    );

    return (
      <motion.button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        whileHover={!isPending ? { scale: 1.12 } : undefined}
        whileTap={!isPending ? { scale: 0.82 } : undefined}
        transition={SPRING_SNAPPY}
        aria-label={isLiked ? "Bỏ thích bài hát" : "Thích bài hát"}
        aria-pressed={isLiked}
        className={cn(
          // like-btn từ index.css
          "like-btn",
          "relative flex items-center gap-1.5 rounded-full",
          "text-muted-foreground/60",
          // hover state
          "hover:text-[hsl(var(--error))]",
          // focus
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--error)/0.4)] focus-visible:ring-offset-1",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          isLiked && "text-[hsl(var(--error))]",
          className,
        )}
      >
        {/* Icon container với scale pop khi liked */}
        <motion.div
          animate={
            isLiked
              ? { scale: [1, 1.35, 1], rotate: [0, -12, 8, 0] }
              : { scale: 1, rotate: 0 }
          }
          transition={{ duration: 0.38, ease: [0.34, 1.56, 0.64, 1] }}
          className="relative flex items-center justify-center"
        >
          {isPending ? (
            <Loader2 className="size-[15px] animate-spin opacity-50 shrink-0" />
          ) : (
            <Heart
              className={cn(
                "size-[15px] shrink-0 transition-[fill,filter] duration-200",
                isLiked && [
                  "fill-current",
                  "drop-shadow-[0_0_4px_hsl(var(--error)/0.55)]",
                ],
              )}
            />
          )}

          {/* Micro ripple burst — chỉ khi like */}
          <AnimatePresence>
            {isLiked && (
              <motion.span
                key={burstKey}
                initial={{ scale: 0.5, opacity: 0.9 }}
                animate={{ scale: 2.2, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.42, ease: "easeOut" }}
                className="absolute inset-[-2px] rounded-full border border-[hsl(var(--error)/0.45)] pointer-events-none"
              />
            )}
          </AnimatePresence>
        </motion.div>

        {/* Count — chỉ hiện khi showCount=true */}
        {showCount && likeCount !== undefined && (
          <motion.span
            key={isLiked ? "liked" : "default"}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={SPRING_SOFT}
            className={cn(
              "text-[11px] font-semibold tabular-nums leading-none select-none",
              isLiked ? "text-[hsl(var(--error))]" : "text-muted-foreground/55",
            )}
          >
            {likeCount + (isLiked ? 1 : 0)}
          </motion.span>
        )}
      </motion.button>
    );
  },
);
TrackLikeButton.displayName = "TrackLikeButton";

// ─────────────────────────────────────────────────────────────────────────────
// 2. ALBUM LIKE BUTTON
//    2 variant:
//    - "card"   → nằm trên overlay của AlbumCard, nền glass tối, icon trắng
//    - "detail" → nằm trong ActionBar trang AlbumDetail, size lớn hơn
//
//    Design: dùng Disc3 icon thay Heart để gắn với danh tính Album
//    Liked color: --wave-1 (tím xanh) thay vì --error → cảm giác collection
//    Burst: ring mở rộng dạng vinyl groove
// ─────────────────────────────────────────────────────────────────────────────

interface AlbumLikeButtonProps {
  id: string;
  variant?: "card" | "detail";
  className?: string;
}

export const AlbumLikeButton = memo(
  ({ id, variant = "detail", className }: AlbumLikeButtonProps) => {
    const { handleToggle } = useInteraction();
    const isLiked = useAppSelector((state) =>
      selectIsInteracted(state, id, "album"),
    );

    // 2. Lấy trạng thái ĐANG XỬ LÝ API của riêng ID này
    const isPending = useAppSelector(
      (state) => state.interaction.loadingIds[`album:${id}`],
    );
    const [burstKey, setBurstKey] = useState(0);
    const controls = useAnimation();

    const handleClick = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (isPending) return;
        if (!isLiked) {
          setBurstKey((k) => k + 1);
          // Vinyl spin micro-animation khi save
          await controls.start({
            rotate: [0, 360],
            transition: { duration: 0.55, ease: [0.34, 1.56, 0.64, 1] },
          });
        }
        handleToggle(id, "album");
      },
      [isPending, isLiked, handleToggle, id, controls],
    );

    const isCard = variant === "card";

    return (
      <motion.button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        whileHover={!isPending ? { scale: isCard ? 1.1 : 1.08 } : undefined}
        whileTap={!isPending ? { scale: isCard ? 0.88 : 0.92 } : undefined}
        transition={SPRING_SNAPPY}
        aria-label={isLiked ? "Xóa khỏi thư viện" : "Lưu vào thư viện"}
        aria-pressed={isLiked}
        className={cn(
          "relative flex items-center justify-center rounded-full transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          "disabled:opacity-40 disabled:cursor-not-allowed",

          // ── card variant: glass nền tối, icon trắng/tím ──
          isCard && [
            "size-8",
            "bg-black/40 backdrop-blur-md border border-white/10",
            "text-white/70 hover:text-white",
            "focus-visible:ring-[hsl(var(--wave-1)/0.5)]",
            isLiked &&
              "bg-[hsl(var(--wave-1)/0.25)] border-[hsl(var(--wave-1)/0.35)] text-[hsl(var(--wave-1))]",
          ],

          // ── detail variant: ghost + border, size medium ──
          !isCard && [
            "size-10 sm:size-11",
            "border border-border/50 bg-background/30 backdrop-blur-sm",
            "hover:bg-muted/60 hover:border-border",
            "focus-visible:ring-[hsl(var(--wave-1)/0.4)]",
            isLiked && [
              "text-[hsl(var(--wave-1))]",
              "border-[hsl(var(--wave-1)/0.35)]",
              "bg-[hsl(var(--wave-1)/0.08)]",
              "hover:bg-[hsl(var(--wave-1)/0.14)]",
              // dark mode glow
              "dark:shadow-[0_0_12px_hsl(var(--wave-1)/0.20)]",
            ],
            !isLiked && "text-foreground/70",
          ],

          className,
        )}
      >
        {/* Rotating disc icon */}
        <motion.div
          animate={controls}
          className="relative flex items-center justify-center"
        >
          {isPending ? (
            <Loader2
              className={cn(
                "animate-spin",
                isCard ? "size-3.5" : "size-[18px]",
              )}
            />
          ) : (
            <Disc3
              className={cn(
                "transition-[filter] duration-300",
                isCard ? "size-3.5" : "size-[18px]",
                isLiked &&
                  !isCard &&
                  "drop-shadow-[0_0_6px_hsl(var(--wave-1)/0.5)]",
              )}
            />
          )}
        </motion.div>

        {/* Vinyl groove burst — đồng tâm */}
        <AnimatePresence>
          {isLiked && (
            <>
              <motion.span
                key={`outer-${burstKey}`}
                initial={{ scale: 0.6, opacity: 0.8 }}
                animate={{ scale: isCard ? 2.0 : 2.4, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
                className="absolute inset-0 rounded-full border border-[hsl(var(--wave-1)/0.55)] pointer-events-none"
              />
              <motion.span
                key={`inner-${burstKey}`}
                initial={{ scale: 0.6, opacity: 0.5 }}
                animate={{ scale: isCard ? 1.4 : 1.7, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeOut", delay: 0.08 }}
                className="absolute inset-0 rounded-full border border-[hsl(var(--wave-2)/0.4)] pointer-events-none"
              />
            </>
          )}
        </AnimatePresence>
      </motion.button>
    );
  },
);
AlbumLikeButton.displayName = "AlbumLikeButton";

// ─────────────────────────────────────────────────────────────────────────────
// 3. PLAYLIST LIKE BUTTON
//    2 variant:
//    - "card"   → overlay góc card playlist, tương tự AlbumLikeButton card
//    - "detail" → trong header trang PlaylistDetail
//
//    Design: dùng BookHeart icon → gắn với danh tính "bộ sưu tập cảm xúc"
//    Liked color: --wave-2 (hồng tím) → cảm giác cá nhân, emotional
//    Burst: heart particles tỏa ra 4 góc
// ─────────────────────────────────────────────────────────────────────────────

interface PlaylistLikeButtonProps {
  id: string;
  variant?: "card" | "detail";
  className?: string;
}

// Particle positions cho 4 hướng
const PARTICLES = [
  { x: -14, y: -14, delay: 0 },
  { x: 14, y: -14, delay: 0.06 },
  { x: -14, y: 14, delay: 0.04 },
  { x: 14, y: 14, delay: 0.08 },
  { x: 0, y: -18, delay: 0.02 },
  { x: 0, y: 18, delay: 0.07 },
];

export const PlaylistLikeButton = memo(
  ({ id, variant = "detail", className }: PlaylistLikeButtonProps) => {
    const { handleToggle } = useInteraction();
    const isLiked = useAppSelector((state) =>
      selectIsInteracted(state, id, "playlist"),
    );

    // 2. Lấy trạng thái ĐANG XỬ LÝ API của riêng ID này
    const isPending = useAppSelector(
      (state) => state.interaction.loadingIds[`playlist:${id}`],
    );
    const [burstKey, setBurstKey] = useState(0);

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (isPending) return;
        if (!isLiked) setBurstKey((k) => k + 1);
        handleToggle(id, "playlist");
      },
      [isPending, isLiked, handleToggle, id],
    );

    // Detect transition từ unliked → liked để trigger particle
    const showParticles = isLiked && burstKey > 0;

    const isCard = variant === "card";

    return (
      <motion.button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        whileHover={!isPending ? { scale: isCard ? 1.1 : 1.08 } : undefined}
        whileTap={!isPending ? { scale: isCard ? 0.88 : 0.92 } : undefined}
        transition={SPRING_BOUNCY}
        aria-label={isLiked ? "Xóa khỏi thư viện" : "Lưu playlist"}
        aria-pressed={isLiked}
        className={cn(
          "relative flex items-center justify-center rounded-full transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          "disabled:opacity-40 disabled:cursor-not-allowed",

          // ── card variant ──
          isCard && [
            "size-8",
            "bg-black/40 backdrop-blur-md border border-white/10",
            "text-white/70 hover:text-white",
            "focus-visible:ring-[hsl(var(--wave-2)/0.5)]",
            isLiked && [
              "bg-[hsl(var(--wave-2)/0.25)]",
              "border-[hsl(var(--wave-2)/0.35)]",
              "text-[hsl(var(--wave-2))]",
            ],
          ],

          // ── detail variant ──
          !isCard && [
            "size-10 sm:size-11",
            "border border-border/50 bg-background/30 backdrop-blur-sm",
            "hover:bg-muted/60 hover:border-border",
            "focus-visible:ring-[hsl(var(--wave-2)/0.4)]",
            isLiked && [
              "text-[hsl(var(--wave-2))]",
              "border-[hsl(var(--wave-2)/0.35)]",
              "bg-[hsl(var(--wave-2)/0.08)]",
              "hover:bg-[hsl(var(--wave-2)/0.14)]",
              "dark:shadow-[0_0_14px_hsl(var(--wave-2)/0.22)]",
            ],
            !isLiked && "text-foreground/70",
          ],

          className,
        )}
      >
        {/* BookHeart icon với wobble khi liked */}
        <motion.div
          animate={
            isLiked
              ? { scale: [1, 1.25, 0.9, 1.08, 1], rotate: [0, -8, 6, -3, 0] }
              : { scale: 1, rotate: 0 }
          }
          transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          className="relative flex items-center justify-center"
        >
          {isPending ? (
            <Loader2
              className={cn(
                "animate-spin",
                isCard ? "size-3.5" : "size-[18px]",
              )}
            />
          ) : (
            <BookHeart
              className={cn(
                "transition-[fill,filter] duration-300",
                isCard ? "size-3.5" : "size-[18px]",
                isLiked && [
                  "fill-[hsl(var(--wave-2)/0.25)]",
                  !isCard && "drop-shadow-[0_0_7px_hsl(var(--wave-2)/0.55)]",
                ],
              )}
            />
          )}
        </motion.div>

        {/* Particle hearts tỏa ra 4 hướng */}
        <AnimatePresence>
          {showParticles &&
            PARTICLES.map((p, i) => (
              <motion.span
                key={`p-${burstKey}-${i}`}
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{ x: p.x, y: p.y, scale: 1, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.48,
                  delay: p.delay,
                  ease: "easeOut",
                }}
                className="absolute pointer-events-none"
              >
                <Heart
                  className={cn(
                    "fill-[hsl(var(--wave-2))] text-[hsl(var(--wave-2))]",
                    isCard ? "size-1.5" : "size-2",
                  )}
                />
              </motion.span>
            ))}
        </AnimatePresence>

        {/* Outer glow ring */}
        <AnimatePresence>
          {isLiked && (
            <motion.span
              key={`ring-${burstKey}`}
              initial={{ scale: 0.7, opacity: 0.7 }}
              animate={{ scale: isCard ? 2.1 : 2.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute inset-0 rounded-full border border-[hsl(var(--wave-2)/0.5)] pointer-events-none"
            />
          )}
        </AnimatePresence>
      </motion.button>
    );
  },
);
PlaylistLikeButton.displayName = "PlaylistLikeButton";

// ─────────────────────────────────────────────────────────────────────────────
// USAGE EXAMPLES (không export — chỉ tham khảo)
// ─────────────────────────────────────────────────────────────────────────────
//
// TrackList row:
//   <TrackLikeButton id={track._id} showCount likeCount={track.likeCount} />
//
// AlbumCard overlay (absolute top-right):
//   <AlbumLikeButton id={album._id} variant="card" className="absolute top-2 right-2" />
//
// AlbumDetail ActionBar:
//   <AlbumLikeButton id={album._id} variant="detail" />
//
// PlaylistCard overlay:
//   <PlaylistLikeButton id={playlist._id} variant="card" className="absolute top-2 right-2" />
//
// PlaylistDetail header:
//   <PlaylistLikeButton id={playlist._id} variant="detail" />
