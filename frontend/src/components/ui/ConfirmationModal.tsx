/**
 * ConfirmationModal.tsx — Production-grade confirm dialog
 *
 * Improvements over v1:
 *  • framer-motion AnimatePresence — smooth overlay fade + panel spring
 *  • Focus trap (Tab/Shift+Tab cycles only inside modal)
 *  • 4 variants: "info" | "warning" | "destructive" | "success"
 *  • Optional `countdownSeconds` — auto-disables confirm until countdown ends
 *  • Shake animation when user hits ESC on a destructive modal
 *  • Icon ring pulse for visual weight
 *  • useId() for stable aria-labelledby / aria-describedby
 *  • Proper cleanup: overflow restored on unmount even if isOpen skips false
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  ShieldAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ModalVariant = "info" | "warning" | "destructive" | "success";

export interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Visual + semantic variant — drives icon, colors, and button style */
  variant?: ModalVariant;
  /** @deprecated use `variant="destructive"` */
  isDestructive?: boolean;
  isLoading?: boolean;
  /**
   * Seconds the user must wait before confirming (destructive safety lock).
   * Shows a live countdown on the confirm button.
   */
  countdownSeconds?: number;
  /** Show a top-right close ×  button in addition to the cancel action */
  showCloseButton?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT CONFIG
// ─────────────────────────────────────────────────────────────────────────────

type VariantConfig = {
  Icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  ringColor: string;
  buttonVariant: "destructive" | "default" | "outline";
};

const VARIANT_CONFIG: Record<ModalVariant, VariantConfig> = {
  destructive: {
    Icon: ShieldAlert,
    iconBg: "dark:bg-red-500/15   bg-red-50",
    iconColor: "dark:text-red-400    text-red-600",
    ringColor: "dark:bg-red-500/8    bg-red-50/60",
    buttonVariant: "destructive",
  },
  warning: {
    Icon: AlertTriangle,
    iconBg: "dark:bg-amber-500/15 bg-amber-50",
    iconColor: "dark:text-amber-400  text-amber-600",
    ringColor: "dark:bg-amber-500/8  bg-amber-50/60",
    buttonVariant: "default",
  },
  info: {
    Icon: Info,
    iconBg: "dark:bg-primary/15   bg-primary/8",
    iconColor: "dark:text-primary    text-primary",
    ringColor: "dark:bg-primary/8    bg-primary/5",
    buttonVariant: "default",
  },
  success: {
    Icon: CheckCircle2,
    iconBg: "dark:bg-emerald-500/15 bg-emerald-50",
    iconColor: "dark:text-emerald-400  text-emerald-600",
    ringColor: "dark:bg-emerald-500/8  bg-emerald-50/60",
    buttonVariant: "default",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// FOCUS TRAP HOOK
// ─────────────────────────────────────────────────────────────────────────────

const FOCUSABLE =
  'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function useFocusTrap(containerRef: React.RefObject<HTMLElement>, isOpen: boolean) {
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    // Auto-focus the first focusable element
    const first = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)[0];
    first?.focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const elements = Array.from(
        containerRef.current!.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (!elements.length) return;

      const firstEl = elements[0];
      const lastEl = elements[elements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [isOpen, containerRef]);
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.18, ease: "easeIn" } },
};

const panelVariants = {
  hidden: { opacity: 0, scale: 0.94, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 380, damping: 30 },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 6,
    transition: { duration: 0.15, ease: "easeIn" },
  },
  // Shake: triggered by a key change on the panel via `animate` prop
  shake: {
    x: [0, -7, 7, -5, 5, -2, 2, 0],
    transition: { duration: 0.4, ease: "easeInOut" },
  },
};

const iconRingVariants = {
  hidden: { opacity: 0, scale: 0.6 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 300, damping: 20, delay: 0.1 },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const ConfirmationModal = ({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  variant = "info",
  isDestructive = false,
  isLoading = false,
  countdownSeconds,
  showCloseButton = false,
}: ConfirmationModalProps) => {
  // Back-compat: isDestructive prop maps to variant
  const resolvedVariant: ModalVariant = isDestructive ? "destructive" : variant;
  const config = VARIANT_CONFIG[resolvedVariant];
  const { Icon, iconBg, iconColor, ringColor, buttonVariant } = config;

  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Countdown state ───────────────────────────────────────────────────────
  const [remaining, setRemaining] = useState<number>(countdownSeconds ?? 0);

  useEffect(() => {
    if (!isOpen || !countdownSeconds) {
      setRemaining(countdownSeconds ?? 0);
      return;
    }
    setRemaining(countdownSeconds);
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isOpen, countdownSeconds]);

  const isCountingDown = remaining > 0;

  // ── Shake on ESC for destructive ─────────────────────────────────────────
  const [shake, setShake] = useState(false);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 450);
  }, []);

  // ── Keyboard: ESC → cancel (with shake guard for destructive) ─────────────
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (resolvedVariant === "destructive") {
        triggerShake();
      } else {
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, resolvedVariant, onCancel, triggerShake]);

  // ── Body overflow lock ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // ── Focus trap ────────────────────────────────────────────────────────────
  useFocusTrap(panelRef, isOpen);

  // ─────────────────────────────────────────────────────────────────────────
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── OVERLAY ─────────────────────────────────────────────────── */}
          <motion.div
            key="overlay"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-100 dark:bg-black/60 bg-black/40 backdrop-blur-sm"
            onClick={resolvedVariant === "destructive" ? triggerShake : onCancel}
            aria-hidden="true"
          />

          {/* ── PANEL ───────────────────────────────────────────────────── */}
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
            <motion.div
              key="panel"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descriptionId}
              variants={panelVariants}
              initial="hidden"
              animate={shake ? "shake" : "visible"}
              exit="exit"
              className={cn(
                "pointer-events-auto relative w-full max-w-md",
                "rounded-2xl border",
                "dark:bg-[#111111] bg-white",
                "dark:border-white/[0.08] border-black/[0.08]",
                "shadow-2xl dark:shadow-black/60",
                "overflow-hidden",
              )}
            >
              {/* Top accent line */}
              <div
                className={cn(
                  "absolute inset-x-0 top-0 h-[3px]",
                  resolvedVariant === "destructive" && "bg-gradient-to-r from-red-500/0 via-red-500 to-red-500/0",
                  resolvedVariant === "warning" && "bg-gradient-to-r from-amber-500/0 via-amber-500 to-amber-500/0",
                  resolvedVariant === "info" && "bg-gradient-to-r from-primary/0 via-primary to-primary/0",
                  resolvedVariant === "success" && "bg-gradient-to-r from-emerald-500/0 via-emerald-500 to-emerald-500/0",
                )}
              />

              {/* Close button */}
              {showCloseButton && (
                <button
                  onClick={onCancel}
                  aria-label="Đóng"
                  className="absolute top-4 right-4 z-10 flex items-center justify-center size-7 rounded-full dark:bg-white/8 bg-black/5 dark:text-white/40 text-gray-500 dark:hover:bg-white/14 hover:bg-black/10 dark:hover:text-white hover:text-gray-900 transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              )}

              <div className="p-6 pt-7 flex flex-col gap-5">
                {/* ── ICON + TITLE ────────────────────────────────────── */}
                <div className="flex items-start gap-4">
                  {/* Icon with animated ring */}
                  <div className="shrink-0 relative mt-0.5">
                    {/* Outer ring pulse */}
                    <motion.div
                      variants={iconRingVariants}
                      initial="hidden"
                      animate="visible"
                      className={cn("absolute -inset-1.5 rounded-full", ringColor)}
                    />
                    <motion.div
                      variants={iconRingVariants}
                      initial="hidden"
                      animate="visible"
                      className={cn(
                        "relative flex items-center justify-center size-10 rounded-full",
                        iconBg,
                      )}
                    >
                      <Icon className={cn("size-5", iconColor)} strokeWidth={1.75} />
                    </motion.div>
                  </div>

                  {/* Title */}
                  <div className="flex-1 min-w-0">
                    <h2
                      id={titleId}
                      className="text-[15px] font-semibold leading-snug tracking-tight dark:text-white text-gray-900"
                    >
                      {title}
                    </h2>
                  </div>
                </div>

                {/* ── DESCRIPTION ─────────────────────────────────────── */}
                <div
                  id={descriptionId}
                  className={cn(
                    "text-[13.5px] leading-relaxed dark:text-white/55 text-gray-600",
                    "pl-[3.5rem]",           // aligns with title text
                    "[&_a]:underline [&_a]:underline-offset-2 [&_a]:dark:text-primary [&_a]:text-primary",
                    "[&_strong]:dark:text-white/80 [&_strong]:text-gray-800 [&_strong]:font-medium",
                    "[&_code]:dark:bg-white/8 [&_code]:bg-black/6 [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[12px] [&_code]:font-mono",
                  )}
                >
                  {description}
                </div>

                {/* ── COUNTDOWN BAR (optional) ─────────────────────────── */}
                {countdownSeconds && countdownSeconds > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="pl-[3.5rem]"
                  >
                    <div className="relative h-1 rounded-full dark:bg-white/8 bg-black/6 overflow-hidden">
                      <motion.div
                        className={cn(
                          "absolute inset-y-0 left-0 rounded-full",
                          resolvedVariant === "destructive" && "bg-red-500",
                          resolvedVariant === "warning" && "bg-amber-500",
                          resolvedVariant === "info" && "bg-primary",
                          resolvedVariant === "success" && "bg-emerald-500",
                        )}
                        initial={{ width: "100%" }}
                        animate={{ width: "0%" }}
                        transition={{
                          duration: countdownSeconds,
                          ease: "linear",
                        }}
                      />
                    </div>
                    {isCountingDown && (
                      <p className="mt-1.5 text-[11px] dark:text-white/30 text-gray-400">
                        Có thể xác nhận sau {remaining}s…
                      </p>
                    )}
                  </motion.div>
                )}

                {/* ── ACTIONS ─────────────────────────────────────────── */}
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-1">
                  <Button
                    variant="outline"
                    onClick={onCancel}
                    disabled={isLoading}
                    className={cn(
                      "w-full sm:w-auto h-9 text-[13.5px] font-medium rounded-xl",
                      "dark:border-white/[0.12] border-black/[0.12]",
                      "dark:hover:bg-white/[0.06] hover:bg-black/[0.04]",
                    )}
                  >
                    {cancelLabel}
                  </Button>

                  <Button
                    variant={buttonVariant}
                    onClick={onConfirm}
                    disabled={isLoading || isCountingDown}
                    className={cn(
                      "w-full sm:w-auto h-9 text-[13.5px] font-medium rounded-xl",
                      "shadow-sm transition-all duration-150",
                      // Info/success use primary colour but styled uniformly
                      resolvedVariant === "info" || resolvedVariant === "success"
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                        : undefined,
                      isCountingDown && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-3.5 animate-spin" />
                        Đang xử lý…
                      </span>
                    ) : isCountingDown ? (
                      <span className="flex items-center gap-1.5 tabular-nums">
                        {confirmLabel}
                        <span className="text-[11px] opacity-70">({remaining})</span>
                      </span>
                    ) : (
                      confirmLabel
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default ConfirmationModal;