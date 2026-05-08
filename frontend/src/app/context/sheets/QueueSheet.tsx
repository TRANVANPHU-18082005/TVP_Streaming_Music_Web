import { memo, useEffect } from "react";
import { AnimatePresence, motion, Variants } from "framer-motion";
import QueuePanel from "@/features/player/components/Queuepanel";
import { QsBackdrop, QsHandleBar } from "../sheetPrimitives";

const QUEUE_SHEET_VARIANTS: Variants = {
  hidden: { y: "100%", opacity: 0 },
  show: { y: 0, opacity: 1 },
  exit: { y: "100%", opacity: 0 },
};
const QUEUE_SHEET_SPRING = {
  type: "spring",
  stiffness: 300,
  damping: 28,
  mass: 0.65,
} as const;
export interface QueueSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueueSheet = memo(({ isOpen, onClose }: QueueSheetProps) => {
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <QsBackdrop onClick={onClose} />

          <motion.div
            key="queue-sheet"
            variants={QUEUE_SHEET_VARIANTS}
            initial="hidden"
            animate="show"
            exit="exit"
            transition={QUEUE_SHEET_SPRING}
            className="absolute bottom-0 left-0 right-0 flex flex-col rounded-t-[28px] overflow-hidden sheet-surface"
            style={{ zIndex: 95, maxHeight: "88dvh" }}
            role="dialog"
            aria-modal="true"
            aria-label="Hàng chờ phát nhạc"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.28 }}
            dragMomentum={false}
            onDragEnd={(
              _: unknown,
              info: { offset: { y: number }; velocity: { y: number } },
            ) => {
              if (info.offset.y > 60 || info.velocity.y > 400) onClose();
            }}
          >
            <QsHandleBar />
            <QueuePanel onClose={onClose} showCloseButton />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});
QueueSheet.displayName = "QueueSheet";

export default QueueSheet;
