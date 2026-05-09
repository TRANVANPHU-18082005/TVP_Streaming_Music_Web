import React, { memo, useMemo } from "react";
import { motion, AnimatePresence, PanInfo, Variants } from "framer-motion";

import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { toCDN } from "@/utils/track-helper";
import { SP, SheetBackdrop, HandleBar } from "../sheetPrimitives";
import { useIsLiked } from "@/features/interaction/hooks/useIsLiked";
import { Heart, ListPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ITrack } from "@/features/track";
import { useInteraction } from "@/features/interaction";
// ─────────────────────────────────────────────────────────────────────────────
// SHARED: TRACK PREVIEW ROW
// ─────────────────────────────────────────────────────────────────────────────
const SHEET_VARIANTS: Variants = {
  hidden: { y: "100%", opacity: 0 },
  show: { y: 0, opacity: 1 },
  exit: { y: "100%", opacity: 0 },
};
const TrackPreviewRow = memo(({ track }: { track: ITrack }) => {
  const artistName =
    typeof track.artist === "object"
      ? (track.artist?.name ?? "Unknown")
      : "Unknown";
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-border/[0.06]">
      <ImageWithFallback
        src={toCDN(track.coverImage)}
        alt={track.title}
        className="w-12 h-12 rounded-xl object-cover ring-1 ring-border shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {track.title}
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {artistName}
        </p>
      </div>
    </div>
  );
});
TrackPreviewRow.displayName = "TrackPreviewRow";

export interface TrackSheetProps {
  track: ITrack | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToPlaylist: (track: ITrack) => void;
}

export const TrackSheet = memo(
  ({ track, isOpen, onClose, onAddToPlaylist }: TrackSheetProps) => {
    const { handleToggle } = useInteraction();
    const isLiked = useIsLiked(track?._id || "", "track");

    const options = useMemo(() => {
      if (!track) return [];
      return [
        {
          icon: ListPlus,
          label: "Thêm vào playlist",
          onClick: () => onAddToPlaylist(track),
        },
        {
          icon: Heart,
          label: `${isLiked ? "Bỏ thích" : "Thêm vào yêu thích"}`,
          onClick: () => {
            handleToggle(track?._id || "", "track");
            onClose();
          },
        },
      ];
    }, [track, onAddToPlaylist, onClose, handleToggle, isLiked]);

    return (
      <>
        <AnimatePresence>
          {isOpen && track && (
            <SheetBackdrop key="backdrop" onClick={onClose} zIndex={90} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isOpen && track && (
            <motion.div
              key="option-sheet"
              variants={SHEET_VARIANTS}
              initial="hidden"
              animate="show"
              exit="exit"
              transition={SP.sheet}
              className="fixed bottom-0 left-0 right-0 bg-background border-t border-border rounded-t-3xl"
              style={{ zIndex: 91 }}
              role="dialog"
              aria-modal="true"
              aria-label={`Tùy chọn cho ${track.title}`}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.28 }}
              dragMomentum={false}
              onDragEnd={(_event: unknown, info: PanInfo) => {
                if (info.offset.y > 60 || info.velocity.y > 400) onClose();
              }}
            >
              <HandleBar />
              <TrackPreviewRow track={track} />

              <div className="py-2 pb-safe">
                {options.map(({ icon: Icon, label, onClick }) => (
                  <motion.button
                    key={label}
                    whileTap={{ backgroundColor: "hsl(var(--muted) / 0.8)" }}
                    onClick={onClick}
                    className={cn(
                      "w-full flex items-center gap-4 px-5 py-3.5",
                      "text-muted-foreground hover:text-foreground hover:bg-muted",
                      "transition-colors text-left",
                    )}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="text-[15px] font-medium leading-none">
                      {label}
                    </span>
                  </motion.button>
                ))}
              </div>

              <div className="px-4 pb-6 pt-1">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  transition={SP.snappy}
                  onClick={onClose}
                  className="w-full py-3.5 rounded-2xl bg-secondary
             text-secondary-foreground text-[14px] font-semibold
             hover:bg-secondary/80 transition-colors"
                >
                  Hủy
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  },
);
TrackSheet.displayName = "TrackSheet";
