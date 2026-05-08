import { memo } from "react";
import { motion, type Variants, type PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";

// SPRING PRESETS & VARIANTS (shared across sheets)
export const SP = {
  snappy: { type: "spring", stiffness: 440, damping: 28 } as const,
  pop: { type: "spring", stiffness: 520, damping: 24 } as const,
  sheet: { type: "spring", stiffness: 300, damping: 28, mass: 0.65 } as const,
  item: { type: "spring", stiffness: 380, damping: 30 } as const,
} as const;
const SHEET_VARIANTS: Variants = {
  hidden: { y: "100%", opacity: 0 },
  show: { y: 0, opacity: 1 },
  exit: { y: "100%", opacity: 0 },
};

// Shared: sheet backdrop
export const SheetBackdrop = memo(
  ({ onClick, zIndex = 90 }: { onClick: () => void; zIndex?: number }) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-[3px]"
      style={{ zIndex }}
      onClick={onClick}
      aria-hidden="true"
    />
  ),
);
SheetBackdrop.displayName = "SheetBackdrop";

// Shared: handle bar
export const HandleBar = memo(() => (
  <div className="flex justify-center pt-3 pb-1 shrink-0">
    <motion.div
      className="h-1 rounded-full bg-muted-foreground/30"
      style={{ width: 36 }}
      whileHover={{
        width: 48,
        backgroundColor: "hsl(var(--muted-foreground) / 0.5)",
      }}
      transition={{ duration: 0.15 }}
      aria-hidden="true"
    />
  </div>
));
HandleBar.displayName = "HandleBar";

// Shared: action button row
export interface ActionItem {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger" | "active";
  disabled?: boolean;
}

export const ActionButton = memo(
  ({
    icon: Icon,
    label,
    onClick,
    variant = "default",
    disabled,
  }: ActionItem) => (
    <motion.button
      whileTap={{ backgroundColor: "hsl(var(--muted) / 0.8)" }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-4 px-5 py-3.5",
        "hover:bg-muted transition-colors text-left",
        "disabled:opacity-30 disabled:pointer-events-none",
        variant === "default" && "text-muted-foreground hover:text-foreground",
        variant === "danger" && "text-destructive hover:text-destructive",
        variant === "active" && "text-primary",
      )}
    >
      <Icon
        className={cn(
          "w-5 h-5 shrink-0",
          variant === "default" && "text-muted-foreground",
          variant === "danger" && "text-destructive/80",
          variant === "active" && "text-primary/70",
        )}
      />
      <span className="text-[14px] font-medium">{label}</span>
    </motion.button>
  ),
);
ActionButton.displayName = "ActionButton";

// Shared: cancel footer
export const CancelFooter = memo(({ onClose }: { onClose: () => void }) => (
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
));
CancelFooter.displayName = "CancelFooter";

// Shared: sheet wrapper
interface SheetWrapperProps {
  ariaLabel: string;
  zIndex?: number;
  children: React.ReactNode;
  onClose: () => void;
}

export const SheetWrapper = memo(
  ({ ariaLabel, zIndex = 91, children, onClose }: SheetWrapperProps) => (
    <motion.div
      key="sheet"
      variants={SHEET_VARIANTS}
      initial="hidden"
      animate="show"
      exit="exit"
      transition={SP.sheet}
      className="fixed bottom-0 left-0 right-0 bg-background border-t border-border rounded-t-3xl"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.28 }}
      dragMomentum={false}
      onDragEnd={(_event: unknown, info: PanInfo) => {
        if (info.offset.y > 60 || info.velocity.y > 400) onClose();
      }}
    >
      {children}
    </motion.div>
  ),
);
SheetWrapper.displayName = "SheetWrapper";

// Queue sheet primitives
export const QS_BACKDROP_Z = 94;
export const QS_SHEET_Z = 95;

export const QsBackdrop = memo(({ onClick }: { onClick: () => void }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
    className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
    style={{ zIndex: QS_BACKDROP_Z }}
    onClick={onClick}
    aria-hidden="true"
  />
));
QsBackdrop.displayName = "QsBackdrop";

export const QsHandleBar = memo(() => (
  <div className="flex justify-center pt-3 pb-1 shrink-0">
    <motion.div
      className="h-1 rounded-full bg-muted-foreground/30"
      style={{ width: 36 }}
      whileHover={{
        width: 48,
        backgroundColor: "hsl(var(--muted-foreground) / 0.5)",
      }}
      transition={{ duration: 0.15 }}
      aria-hidden="true"
    />
  </div>
));
QsHandleBar.displayName = "QsHandleBar";

export default {} as const;
