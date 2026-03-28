import { memo, useCallback, useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useInteraction } from "../hooks/useInteraction";
import { useAppSelector } from "@/store/hooks";

const SPRING_SNAPPY = { type: "spring", stiffness: 500, damping: 28 } as const;

const BURST = {
  initial: { scale: 0.4, opacity: 1 },
  animate: { scale: 2.6, opacity: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.5, ease: "easeOut" },
} as const;

const ICON_SIZE = {
  sm: "size-3.5",
  md: "size-[18px]",
  lg: "size-6",
};

interface LikeButtonProps {
  id: string;
  type?: "track" | "album" | "playlist"; // 🚩 Bỏ 'artist' ra khỏi đây
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const LikeButton = memo(
  ({ id, type = "track", size = "md", className }: LikeButtonProps) => {
    const { handleToggle } = useInteraction();

    // 🚀 Chỉ truy xuất các map liên quan đến LIKE
    const isLiked = useAppSelector((state) => {
      const maps = {
        track: "likedTracks",
        album: "likedAlbums",
        playlist: "likedPlaylists",
      } as const;
      return !!state.interaction[maps[type]][id];
    });

    const isLoading = useAppSelector(
      (state) => !!state.interaction.loadingIds[id],
    );
    const [burstKey, setBurstKey] = useState(0);

    const handleLike = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (isLoading) return;

        // Chỉ nổ hiệu ứng khi bấm LIKE (từ trắng sang đỏ)
        if (!isLiked) setBurstKey((k) => k + 1);
        console.log("Toggling like for", { id, type }); // Debug log
        handleToggle(id, type);
      },
      [isLoading, isLiked, handleToggle, id, type],
    );

    return (
      <motion.button
        type="button"
        onClick={handleLike}
        disabled={isLoading}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.85 }}
        transition={SPRING_SNAPPY}
        className={cn(
          "relative flex items-center justify-center rounded-full transition-colors duration-200",
          isLiked
            ? "text-[hsl(var(--error))]"
            : "text-muted-foreground/40 hover:text-foreground",
          className,
        )}
      >
        <motion.div
          animate={isLiked ? { scale: [1, 1.3, 1] } : { scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          {isLoading ? (
            <Loader2
              className={cn(ICON_SIZE[size], "animate-spin opacity-50")}
            />
          ) : (
            <Heart className={cn(ICON_SIZE[size], isLiked && "fill-current")} />
          )}
        </motion.div>

        {/* Burst Effect */}
        <AnimatePresence>
          {isLiked && (
            <motion.span
              key={burstKey}
              {...BURST}
              className="absolute inset-0 rounded-full border-2 border-[hsl(var(--error)/0.5)] pointer-events-none"
            />
          )}
        </AnimatePresence>
      </motion.button>
    );
  },
);
export default LikeButton;
