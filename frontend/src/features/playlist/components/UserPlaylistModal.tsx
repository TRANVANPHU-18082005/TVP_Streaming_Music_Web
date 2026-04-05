import { useEffect, useMemo, memo, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Plus,
  Loader2,
  Globe,
  Lock,
  CheckCircle2,
  Type,
  Music2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import React from "react";

// ─────────────────────────────────────────────────────────────────────────────
// MODULE-SCOPE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LABEL_CLASS — uses .text-overline from design system.
 * Replaces the inline text-[11px] font-bold uppercase tracking-widest pattern.
 */
const LABEL_CLASS =
  "text-overline text-muted-foreground/60 flex items-center gap-1.5 w-fit mb-2";

/** Aligned with --ease-spring + --duration-slow from design system */
const MODAL_SPRING = {
  type: "spring",
  stiffness: 400,
  damping: 32,
} as const;

/**
 * VISIBILITY_OPTIONS
 *
 * BEFORE: hardcoded Tailwind color classes (text-emerald-400, bg-rose-500/10…)
 * AFTER:  CSS token vars — skin-aware, light/dark adaptive.
 *
 * activeTokens.color   → hsl(var(--success)) or hsl(var(--error))
 * activeTokens.bg      → hsl(var(--success) / 0.08)
 * activeTokens.border  → hsl(var(--success) / 0.35)
 * activeTokens.glow    → shadow-[0_0_16px_hsl(var(--success)/0.2)]
 */
const VISIBILITY_OPTIONS = [
  {
    id: "public",
    label: "Public",
    desc: "Anyone can listen and discover",
    icon: Globe,
    token: "--success", // maps to hsl(var(--success))
  },
  {
    id: "private",
    label: "Private",
    desc: "Only visible to you",
    icon: Lock,
    token: "--error", // maps to hsl(var(--error))
  },
] as const;

type VisibilityId = (typeof VISIBILITY_OPTIONS)[number]["id"];

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface UserPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { title?: string; visibility?: string }) => Promise<void>;
  isPending: boolean;
}

interface FormValues {
  title: string;
  visibility: VisibilityId;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION BLOCK
// ─────────────────────────────────────────────────────────────────────────────

const SectionBlock = memo(
  ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="space-y-4">
      <h4 className="text-overline text-muted-foreground/50">{title}</h4>
      {children}
    </div>
  ),
);
SectionBlock.displayName = "SectionBlock";

// ─────────────────────────────────────────────────────────────────────────────
// VISIBILITY CARD
// Token-safe active state via CSS custom properties in inline style.
// ─────────────────────────────────────────────────────────────────────────────

const VisibilityCard = memo(
  ({
    option,
    isSelected,
    onSelect,
  }: {
    option: (typeof VISIBILITY_OPTIONS)[number];
    isSelected: boolean;
    onSelect: (id: string) => void;
  }) => {
    const Icon = option.icon;

    return (
      <button
        type="button"
        role="radio"
        aria-checked={isSelected}
        onClick={() => onSelect(option.id)}
        className={cn(
          // Base — .pressable geometry + glass surface
          "relative flex flex-col gap-3 p-4 rounded-2xl border-2 text-left w-full",
          "pressable transition-all duration-200 select-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2",
          "focus-visible:outline-[hsl(var(--ring))]",
          isSelected
            ? "shadow-raised"
            : [
                "border-border/50 bg-surface-1/60",
                "hover:border-border-strong hover:bg-surface-2/60",
              ],
        )}
        style={
          isSelected
            ? {
                // All colors via token → skin + light/dark adaptive
                background: `hsl(var(${option.token}) / 0.07)`,
                borderColor: `hsl(var(${option.token}) / 0.40)`,
                boxShadow: `0 0 16px hsl(var(${option.token}) / 0.12)`,
              }
            : undefined
        }
      >
        {/* Top row: icon + radio indicator */}
        <div className="flex items-center justify-between w-full">
          {/* Icon pill */}
          <div
            className={cn(
              "p-2.5 rounded-xl transition-all duration-200",
              !isSelected && "bg-muted/40 text-muted-foreground",
            )}
            style={
              isSelected
                ? {
                    background: `hsl(var(${option.token}) / 0.14)`,
                    color: `hsl(var(${option.token}))`,
                  }
                : undefined
            }
          >
            <Icon className="size-4" aria-hidden="true" />
          </div>

          {/* Radio dot */}
          <div
            className={cn(
              "size-5 rounded-full border-2 flex items-center justify-center",
              "transition-all duration-200 shrink-0",
              !isSelected && "border-muted-foreground/25",
            )}
            style={
              isSelected
                ? {
                    borderColor: `hsl(var(${option.token}))`,
                    background: `hsl(var(${option.token}))`,
                  }
                : undefined
            }
          >
            {isSelected && (
              <CheckCircle2 className="size-3 text-white" aria-hidden="true" />
            )}
          </div>
        </div>

        {/* Labels */}
        <div className="space-y-0.5">
          <span
            className={cn(
              "text-sm font-semibold block leading-tight transition-colors",
              !isSelected && "text-muted-foreground",
            )}
            style={
              isSelected ? { color: `hsl(var(${option.token}))` } : undefined
            }
          >
            {option.label}
          </span>
          <span className="text-[11px] text-muted-foreground/60 font-medium block leading-snug">
            {option.desc}
          </span>
        </div>
      </button>
    );
  },
);
VisibilityCard.displayName = "VisibilityCard";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const UserPlaylistModal = memo<UserPlaylistModalProps>(
  ({ isOpen, onClose, onSubmit, isPending }) => {
    const {
      register,
      handleSubmit,
      watch,
      setValue,
      reset,
      formState: { isSubmitting },
    } = useForm<FormValues>({
      defaultValues: { title: "", visibility: "public" },
    });

    // FIX 10: single useMemo for derived loading state
    const isWorking = useMemo(
      () => isPending || isSubmitting,
      [isPending, isSubmitting],
    );

    const currentVisibility = watch("visibility");

    // Reset on close
    useEffect(() => {
      if (!isOpen) reset();
    }, [isOpen, reset]);

    // FIX 1+2: scroll lock + scrollbar-width compensation (no layout shift)
    useEffect(() => {
      if (!isOpen) return;
      const sbw = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${sbw}px`;
      return () => {
        document.body.style.overflow = "";
        document.body.style.paddingRight = "";
      };
    }, [isOpen]);

    // Escape key close
    useEffect(() => {
      if (!isOpen) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape" && !isWorking) onClose();
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }, [isOpen, isWorking, onClose]);

    const handleVisibilitySelect = useCallback(
      (id: string) =>
        setValue("visibility", id as VisibilityId, { shouldDirty: true }),
      [setValue],
    );

    const onInternalSubmit = useCallback(
      async (data: FormValues) => {
        await onSubmit({
          title: data.title || undefined,
          visibility: data.visibility,
        });
        onClose();
      },
      [onSubmit, onClose],
    );

    // FIX 5: SSR guard
    if (typeof document === "undefined") return null;

    return createPortal(
      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6"
            role="presentation"
          >
            {/* ── Backdrop — hsl(var(--overlay)) is theme-aware ── */}
            <motion.div
              key="upm-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 backdrop-blur-md"
              style={{ background: "hsl(var(--overlay) / 0.75)" }}
              onClick={!isWorking ? onClose : undefined}
              aria-hidden="true"
            />

            {/*
             * ── Modal shell ──
             * .glass-frosted: auto bg/blur/border/shadow per theme
             * Bottom-sheet on mobile (rounded-t-3xl, full-width)
             * Centered card on sm+ (rounded-2xl, max-w-md)
             */}
            <motion.div
              key="upm-content"
              initial={{ opacity: 0, scale: 0.97, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={MODAL_SPRING}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="upm-title"
              className={cn(
                "relative z-[101] w-full sm:max-w-md",
                "flex flex-col max-h-[92dvh] sm:max-h-[88vh]",
                // Bottom-sheet radius on mobile, card radius on sm+
                "rounded-t-3xl sm:rounded-2xl",
                // .glass-frosted handles all bg/blur/shadow per light/dark
                "glass-frosted overflow-hidden",
              )}
            >
              {/* ── Drag handle (mobile only) ── */}
              <div
                className="sm:hidden flex justify-center pt-3 pb-1 shrink-0"
                aria-hidden="true"
              >
                <div className="w-10 h-1 rounded-full bg-border/60" />
              </div>

              {/* ══════ HEADER ══════ */}
              <header className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 border-b border-border/40 shrink-0">
                <div className="flex items-center gap-3">
                  {/* Icon — token bg + .shadow-glow-xs */}
                  <div
                    className="p-2.5 rounded-xl shadow-glow-xs shrink-0"
                    style={{
                      background: "hsl(var(--primary) / 0.12)",
                      color: "hsl(var(--primary))",
                      border: "1px solid hsl(var(--primary) / 0.18)",
                    }}
                    aria-hidden="true"
                  >
                    <Music2 className="size-5" />
                  </div>

                  <div>
                    <h3
                      id="upm-title"
                      className="text-base font-bold text-foreground leading-tight"
                    >
                      New Playlist
                    </h3>
                    <p className="text-track-meta mt-0.5">
                      Start building your own sound.
                    </p>
                  </div>
                </div>

                {/* Close — .control-btn--ghost pattern */}
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isWorking}
                  aria-label="Close modal"
                  className={cn(
                    "size-8 flex items-center justify-center rounded-full shrink-0",
                    "text-muted-foreground/60",
                    "hover:bg-muted/60 hover:text-foreground",
                    "transition-colors duration-150",
                    "focus-visible:outline-2 focus-visible:outline-offset-2",
                    "focus-visible:outline-[hsl(var(--ring))]",
                    "disabled:opacity-40 disabled:pointer-events-none",
                  )}
                >
                  <X className="size-4.5" aria-hidden="true" />
                </button>
              </header>

              {/* ══════ SCROLLABLE BODY ══════ */}
              <div className="flex-1 overflow-y-auto scrollbar-thin p-5 sm:p-6">
                <form
                  id="upm-form"
                  onSubmit={handleSubmit(onInternalSubmit)}
                  noValidate
                  className="space-y-7"
                >
                  {/* ── Title ── */}
                  <SectionBlock title="Playlist Info">
                    <div className="space-y-2">
                      <label htmlFor="upm-title" className={LABEL_CLASS}>
                        <Type className="size-3" aria-hidden="true" />
                        Name
                      </label>
                      <Input
                        id="upm-title"
                        {...register("title")}
                        placeholder="Leave blank to auto-generate…"
                        autoComplete="off"
                        // .input-base from design system
                        className="input-base h-11 text-sm"
                      />
                      <p className="text-track-meta text-muted-foreground/50 pl-0.5">
                        System will generate a name if left empty.
                      </p>
                    </div>
                  </SectionBlock>

                  {/* Divider — .divider-fade token */}
                  <div
                    className="divider-fade"
                    role="separator"
                    aria-hidden="true"
                  />

                  {/* ── Visibility ── */}
                  <SectionBlock title="Visibility">
                    <div
                      role="radiogroup"
                      aria-label="Select playlist visibility"
                      className="grid grid-cols-2 gap-3"
                    >
                      {VISIBILITY_OPTIONS.map((opt) => (
                        <VisibilityCard
                          key={opt.id}
                          option={opt}
                          isSelected={currentVisibility === opt.id}
                          onSelect={handleVisibilitySelect}
                        />
                      ))}
                    </div>
                  </SectionBlock>
                </form>
              </div>

              {/* ══════ STICKY FOOTER ══════ */}
              <footer className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t border-border/40 shrink-0">
                <p className="text-track-meta text-muted-foreground/45 hidden sm:block">
                  You can edit this later.
                </p>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  {/* Cancel — .btn-ghost from design system */}
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isWorking}
                    className="btn-ghost btn-sm flex-1 sm:flex-none rounded-xl h-10 px-5 disabled:opacity-40"
                  >
                    Cancel
                  </button>

                  {/* Submit — .btn-primary from design system (gradient + glow) */}
                  <button
                    type="submit"
                    form="upm-form"
                    disabled={isWorking}
                    className="btn-primary btn-sm flex-1 sm:flex-none rounded-xl h-10 px-5 gap-2 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isWorking ? (
                      <>
                        <Loader2
                          className="size-3.5 animate-[spin_0.7s_linear_infinite]"
                          aria-hidden="true"
                        />
                        Creating…
                      </>
                    ) : (
                      <>
                        <Plus className="size-3.5" aria-hidden="true" />
                        Create Playlist
                      </>
                    )}
                  </button>
                </div>
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body,
    );
  },
);

UserPlaylistModal.displayName = "UserPlaylistModal";
export default UserPlaylistModal;
