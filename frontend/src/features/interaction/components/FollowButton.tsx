// src/features/interaction/components/FollowButton.tsx
import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { useInteraction } from "../hooks/useInteraction";
import { cn } from "@/lib/utils";

const SPRING_SNAPPY = { type: "spring", stiffness: 500, damping: 30 };

interface FollowButtonProps {
  artistId: string;
  className?: string;
}

export const FollowButton = memo(
  ({ artistId, className }: FollowButtonProps) => {
    const { handleFollowArtist, useIsFollowed, useIsLoading } =
      useInteraction();

    const isFollowed = useIsFollowed(artistId);
    const isLoading = useIsLoading(artistId);

    const handleFollow = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (isLoading) return;
      handleFollowArtist(artistId);
    };

    return (
      <motion.button
        type="button"
        onClick={handleFollow}
        disabled={isLoading}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={SPRING_SNAPPY}
        className={cn(
          "relative flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-bold text-sm overflow-hidden transition-colors duration-300",
          isFollowed
            ? "bg-secondary/50 text-foreground border border-primary/20 backdrop-blur-md"
            : "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.3)]",
          isLoading && "opacity-80 cursor-not-allowed",
          className,
        )}
      >
        {/* Hiệu ứng Shine chạy ngang khi chưa follow (tạo sự chú ý) */}
        {!isFollowed && !isLoading && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{
              repeat: Infinity,
              duration: 1.5,
              ease: "linear",
              repeatDelay: 3,
            }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-1/2 skew-x-12"
          />
        )}

        {/* Content chính của nút */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Loader2 className="size-4 animate-spin" />
            </motion.div>
          ) : (
            <motion.div
              key={isFollowed ? "followed" : "unfollowed"}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              className="flex items-center gap-2"
            >
              {isFollowed ? (
                <>
                  <UserCheck className="size-4 text-primary" />
                  <span>Đang theo dõi</span>
                </>
              ) : (
                <>
                  <UserPlus className="size-4" />
                  <span>Theo dõi</span>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hiệu ứng Burst (Vòng tròn nổ rộ) khi nhấn Follow */}
        <AnimatePresence>
          {isFollowed && (
            <motion.span
              key="follow-burst"
              initial={{ scale: 0.5, opacity: 1 }}
              animate={{ scale: 2.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="absolute inset-0 rounded-full border-2 border-primary/50 pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* Lớp Glow huyền ảo sau lưng nút khi đã follow */}
        {isFollowed && (
          <motion.div
            layoutId="follow-glow"
            className="absolute inset-0 bg-primary/10 blur-lg -z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
        )}
      </motion.button>
    );
  },
);

FollowButton.displayName = "FollowButton";
export default FollowButton;
