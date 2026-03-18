import { memo } from "react";
import { Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useInteraction } from "../hooks/useInteraction"; // Hook mới đã build

const SPRING_SNAPPY = { type: "spring", stiffness: 500, damping: 25 };

interface LikeButtonProps {
  trackId: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const LikeButton = memo(
  ({ trackId, size = "md", className }: LikeButtonProps) => {
    // 🚀 LOGIC MỚI: Lấy mọi thứ từ Interaction Hook
    const { handleLikeTrack, useIsLiked, useIsLoading } = useInteraction();

    // Tự subscribe trạng thái like của đúng trackId này trong Store trung tâm
    const isLiked = useIsLiked(trackId);
    const isLoading = useIsLoading(trackId);

    const cls = size === "lg" ? "size-7" : size === "sm" ? "size-4" : "size-5";

    const handleLike = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isLoading) return; // Chống spam click
      handleLikeTrack(trackId);
    };

    return (
      <motion.button
        type="button"
        onClick={handleLike}
        disabled={isLoading}
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.88 }}
        transition={SPRING_SNAPPY}
        className={cn(
          "relative flex items-center justify-center p-2 rounded-full transition-colors",
          "disabled:opacity-70 disabled:cursor-not-allowed",
          isLiked ? "text-rose-500" : "text-white/40 hover:text-white/80",
          className,
        )}
      >
        <motion.div
          animate={
            isLiked
              ? { scale: [1, 1.45, 1], rotate: [0, 15, 0] }
              : { scale: 1, rotate: 0 }
          }
          transition={{
            duration: 0.4,
            ease: [0.34, 1.56, 0.64, 1],
          }}
        >
          <Heart
            className={cn(cls, isLiked && "fill-current")}
            strokeWidth={isLiked ? 2.5 : 2}
          />
        </motion.div>

        {/* Hiệu ứng Burst */}
        <AnimatePresence>
          {isLiked && (
            <motion.span
              key="burst"
              className="absolute inset-0 rounded-full border-2 border-rose-500/60"
              initial={{ scale: 0.4, opacity: 1 }}
              animate={{ scale: 2.4, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>

        {/* Hiệu ứng Glow */}
        <AnimatePresence>
          {isLiked && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute inset-0 bg-rose-500/20 blur-xl rounded-full -z-10"
            />
          )}
        </AnimatePresence>
      </motion.button>
    );
  },
);

LikeButton.displayName = "LikeButton";
export default LikeButton;
