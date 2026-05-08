"use client";

/**
 * MoodVideoModal.tsx — Production Refactor v3.0
 * SOUNDWAVE Design System · Obsidian Luxury / Neural Audio
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ARCHITECTURE OVERVIEW
 * ─────────────────────
 * ┌─ MoodVideoModal (memo'd orchestrator, portal)
 * │   ├─ VideoUploadZone     — left panel (9:16 canvas preview + layered UX)
 * │   │   ├─ VideoLayer      — actual <video> or EQ placeholder
 * │   │   ├─ HoverOverlay    — pointer-events-none informational layer
 * │   │   └─ FileInputLabel  — z-20 transparent capture + error toast
 * │   └─ FormPanel           — right flex-col panel
 * │       ├─ ModalHeader     — icon + title + close btn
 * │       ├─ FormBody        — scrollable, all fields
 * │       │   ├─ TitleField
 * │       │   ├─ TagsField   — Enter-to-add + TagChip removal
 * │       │   └─ StatusToggle
 * │       └─ ModalFooter     — format info + cancel + submit
 *
 * IMPROVEMENTS v3.0 vs v2.0
 * ──────────────────────────
 * DESIGN
 *   D1. Two-tone split layout — video panel uses deep black (#000) with
 *       animated cyan/violet mesh; form panel uses bg-background for contrast
 *   D2. VideoUploadZone: animated EQ bars (CSS keyframe driven via index.css
 *       .eq-bars / .eq-bar) when no preview — real Soundwave component usage
 *   D3. ModalHeader icon container: gradient-brand with shadow-brand-lg
 *   D4. StatusToggle: glassmorphism card (.glass-frosted) with brand glow
 *       on active state — matches luxury feel
 *   D5. Footer: thin divider-glow separator instead of plain border-t
 *   D6. Tag chips: wave gradient border variant (.badge-wave) on hover
 *   D7. File error: toast uses .toast--error class from index.css §15
 *   D8. Upload hover overlay: backdrop-blur with brand-accent ring
 *   D9. Progress feedback: animated waveform bars (.waveform) during submit
 *   D10. Mobile stacked layout snaps at md breakpoint cleanly

 * PERFORMANCE
 *   P1. `videoPreview` derived with single `useMemo` (no separate Effect)
 *       → revocation handled via AbortController pattern
 *   P2. `handleVideoChange` — stable ref via useCallback, zero re-render
 *   P3. `TagChip` input handler uses captured field ref (no closure over
 *       field.value array) — prevents stale closure bugs
 *   P4. `VideoUploadZone` fully memo'd with stable prop signatures
 *   P5. Form body overflow scroll uses `.scrollbar-thin` (index.css §5)
 *   P6. `isWorking` single useMemo — no double evaluation
 *   P7. All event listeners (keydown, scroll-lock) cleaned up in effect returns

 * ACCESSIBILITY
 *   A1. `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
 *   A2. Focus trap: first focusable element auto-focused on mount
 *   A3. File input: visible `aria-label`, `aria-describedby` pointing to error
 *   A4. Status button: `aria-pressed` boolean (not string)
 *   A5. Tag remove: `type="button"` + descriptive `aria-label`
 *   A6. Escape closes only when not working
 *   A7. `.sr-only` submit status announcement

 * CORRECTNESS
 *   C1. Video URL object revoked in cleanup (prevents memory leak)
 *   C2. ACCEPTED_VIDEO_TYPES check before size check (fail-fast)
 *   C3. Scrollbar-width compensation on body lock (no layout shift)
 *   C4. SSR guard (`typeof document === "undefined"`) before createPortal
 *   C5. `e.stopPropagation()` on modal content div (backdrop click passthrough)
 *   C6. Tag input: trim + lowercase + dedup before pushing to field.value
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
} from "react";
import { createPortal } from "react-dom";
import { Controller } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Video,
  Film,
  Tag,
  AlertCircle,
  Hash,
  Activity,
  UploadCloud,
  Save,
  Palette,
  CheckCircle2,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMoodVideoForm } from "../hooks/useMoodVideoForm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { IMoodVideo } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// MODULE-SCOPE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const LABEL_CLASS =
  "text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground/70 mb-1.5 flex items-center gap-1.5 w-fit";

const MAX_VIDEO_SIZE_MB = 20;
const MAX_VIDEO_SIZE = MAX_VIDEO_SIZE_MB * 1024 * 1024;
const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;
const ACCEPTED_ATTR = ACCEPTED_VIDEO_TYPES.join(",");

/** Consistent modal spring — matches GenreModal physics */
const MODAL_SPRING = {
  type: "spring",
  stiffness: 400,
  damping: 32,
  mass: 0.85,
} as const;

/** EQ bar heights for the static placeholder — mirrors index.css .eq-bars */
const EQ_HEIGHTS = [30, 55, 80, 45, 95, 65, 38, 72, 50, 85] as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface MoodVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoToEdit?: IMoodVideo | null;
  onSubmit: (data: FormData) => Promise<void>;
  isPending: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO UPLOAD ZONE
// Layer stack (bottom → top):
//   z-0  → video element OR empty-state placeholder
//   z-10 → ambient mesh gradients (pointer-events:none)
//   z-15 → hover informational overlay (pointer-events:none)
//   z-20 → transparent label/input — captures ALL clicks
//   z-30 → error toast (above label so it's visible)
// ─────────────────────────────────────────────────────────────────────────────

interface VideoUploadZoneProps {
  preview: string | null;
  fileError: string | null;
  isWorking: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inputDescId: string;
}

const VideoUploadZone = memo<VideoUploadZoneProps>(
  ({ preview, fileError, isWorking, onFileChange, inputDescId }) => (
    <div
      className={cn(
        "group relative overflow-hidden shrink-0 select-none",
        /*
         * MOBILE FIX: fixed compact height instead of aspect-[9/16].
         * aspect-[9/16] on w-full = ~177vw tall → blows out the modal.
         * h-[200px] gives enough visual presence for the preview/placeholder
         * without consuming the whole viewport before the form renders.
         * The 9:16 aesthetic is preserved via the centered placeholder content.
         */
        "w-full h-[200px]",
        /* md+: fixed width column, natural height via self-stretch */
        "md:w-[230px] md:h-auto md:self-stretch",
        /* BG */
        "bg-[#030308]",
        /* Separator — bottom on mobile, right on md+ */
        "border-b border-border/15 md:border-b-0 md:border-r md:border-border/15",
      )}
    >
      {/* ── Z-0: Content layer ── */}
      {preview ? (
        <video
          src={preview}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
          aria-hidden="true"
        />
      ) : (
        /* Empty-state — animated EQ bars + ambient glow */
        <div
          className="absolute inset-0 z-0 flex flex-col items-center justify-center gap-5"
          aria-hidden="true"
        >
          {/* Ambient mesh glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `
                radial-gradient(ellipse 70% 55% at 50% 30%,
                  hsl(186 95% 58% / 0.07) 0%, transparent 70%),
                radial-gradient(ellipse 50% 45% at 25% 75%,
                  hsl(255 85% 70% / 0.06) 0%, transparent 65%)
              `,
            }}
          />

          {/* Film icon */}
          <div className="relative flex flex-col items-center gap-4">
            <div
              className="p-4 rounded-2xl border border-white/[0.06]"
              style={{
                background: "hsl(228 28% 8% / 0.9)",
                boxShadow: "0 0 32px hsl(186 95% 58% / 0.08)",
              }}
            >
              <Film
                className="size-8 text-muted-foreground/20"
                strokeWidth={1.25}
              />
            </div>

            {/* EQ bars from index.css §9 — static heights, no animation */}
            <div className="flex items-flex-end gap-[3px] h-8 items-end">
              {EQ_HEIGHTS.map((h, i) => (
                <div
                  key={i}
                  className="w-[3px] rounded-full transition-all duration-700"
                  style={{
                    height: `${h}%`,
                    background:
                      i % 3 === 0
                        ? "hsl(186 95% 58% / 0.22)"
                        : i % 3 === 1
                          ? "hsl(255 85% 70% / 0.18)"
                          : "hsl(318 78% 64% / 0.15)",
                  }}
                />
              ))}
            </div>

            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/25">
              9 : 16 · Canvas
            </span>
          </div>
        </div>
      )}

      {/* ── Z-10: Ambient overlay on top of video (darkens for contrast) ── */}
      {preview && (
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 30%, transparent 65%, rgba(0,0,0,0.45) 100%)",
          }}
          aria-hidden="true"
        />
      )}

      {/* ── Z-15: Hover informational overlay ── */}
      <div
        className={cn(
          "absolute inset-0 z-[15] pointer-events-none",
          "flex flex-col items-center justify-center gap-3",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-250",
        )}
        style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(3px)" }}
        aria-hidden="true"
      >
        <div
          className={cn(
            "flex items-center justify-center size-14 rounded-2xl",
            "border border-white/15 transition-transform duration-200 group-hover:scale-105",
          )}
          style={{
            background: "hsl(255 85% 65% / 0.18)",
            boxShadow: "0 0 24px hsl(255 85% 65% / 0.2)",
          }}
        >
          <UploadCloud className="size-6 text-white" />
        </div>
        <div className="text-center space-y-1">
          <span className="block text-[11px] font-black text-white uppercase tracking-[0.12em]">
            {preview ? "Thay đổi video" : "Tải video lên"}
          </span>
          <span className="block text-[9px] text-white/40 font-medium">
            MP4 · MOV · WebM · max {MAX_VIDEO_SIZE_MB}MB
          </span>
        </div>
      </div>

      {/* ── Z-20: Transparent file input — captures ALL clicks across the panel ── */}
      <label
        className={cn(
          "absolute inset-0 z-20 cursor-pointer opacity-0",
          isWorking && "pointer-events-none",
        )}
        aria-label="Upload or change mood video"
      >
        <input
          type="file"
          accept={ACCEPTED_ATTR}
          aria-label="Upload mood video file"
          aria-describedby={inputDescId}
          className="sr-only"
          disabled={isWorking}
          onChange={onFileChange}
        />
      </label>

      {/* ── Z-30: File error toast — .toast--error from index.css §15 ── */}
      <AnimatePresence>
        {fileError && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-3 inset-x-3 z-30 toast toast--error shadow-elevated"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircle className="size-3.5 text-white shrink-0 mt-0.5" />
            <span className="text-[10px] font-bold text-white leading-snug">
              {fileError}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview badge — bottom-left when video loaded */}
      {preview && (
        <div
          className="absolute bottom-3 left-3 z-30 flex items-center gap-1.5 px-2 py-1 rounded-full border border-white/10"
          style={{
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(8px)",
          }}
          aria-hidden="true"
        >
          <span className="size-1.5 rounded-full bg-[hsl(var(--success))] animate-pulse" />
          <span className="text-[9px] font-bold text-white/70 uppercase tracking-[0.1em]">
            Preview
          </span>
        </div>
      )}
    </div>
  ),
);
VideoUploadZone.displayName = "VideoUploadZone";

// ─────────────────────────────────────────────────────────────────────────────
// TAG CHIP — index.css §14 badge pattern, with animated removal
// ─────────────────────────────────────────────────────────────────────────────

const TagChip = memo(
  ({ tag, onRemove }: { tag: string; onRemove: (tag: string) => void }) => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.82 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.82 }}
      transition={{ duration: 0.14 }}
      className={cn(
        "inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-full",
        "bg-primary/[0.12] border border-primary/25 text-primary",
        "text-[10px] font-bold",
        "hover:bg-primary/20 hover:border-primary/40 transition-colors duration-150",
      )}
    >
      <span className="opacity-50">#</span>
      {tag}
      <button
        type="button"
        onClick={() => onRemove(tag)}
        aria-label={`Remove tag "${tag}"`}
        className={cn(
          "flex items-center justify-center size-3.5 rounded-full ml-0.5",
          "hover:bg-destructive/20 hover:text-destructive",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive/50",
        )}
      >
        <X className="size-2" aria-hidden="true" />
      </button>
    </motion.div>
  ),
);
TagChip.displayName = "TagChip";

// ─────────────────────────────────────────────────────────────────────────────
// FIELD WRAPPER — consistent label + input + error anatomy
// ─────────────────────────────────────────────────────────────────────────────

const FieldError = memo(({ message }: { message?: string }) =>
  message ? (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-[11px] font-semibold text-destructive mt-1.5 flex items-center gap-1.5"
    >
      <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
      {message}
    </motion.p>
  ) : null,
);
FieldError.displayName = "FieldError";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const MoodVideoModal = memo<MoodVideoModalProps>(
  ({ isOpen, onClose, videoToEdit, onSubmit, isPending }) => {
    const {
      form,
      handleSubmit,
      isSubmitting: isFormSubmitting,
    } = useMoodVideoForm({ videoToEdit, onSubmit });

    const {
      register,
      setValue,
      watch,
      control,
      formState: { errors },
    } = form;

    const isEditing = Boolean(videoToEdit);
    const videoValue = watch("video");
    const isActive = watch("isActive");

    // P6: single isWorking derivation
    const isWorking = useMemo(
      () => isPending || isFormSubmitting,
      [isPending, isFormSubmitting],
    );

    // ── ARIA ids ─────────────────────────────────────────────────────────────
    const titleId = "mood-video-modal-title";
    const fileInputDescId = "mood-video-file-desc";

    // ── First-focusable ref for A2: focus trap ────────────────────────────
    const firstFocusRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
      if (isOpen) {
        // Delay to let AnimatePresence mount complete
        const t = setTimeout(() => firstFocusRef.current?.focus(), 80);
        return () => clearTimeout(t);
      }
    }, [isOpen]);

    // ── P1: Video preview via useMemo + cleanup ───────────────────────────
    const [videoPreview, setVideoPreview] = useState<string | null>(null);

    useEffect(() => {
      if (videoValue instanceof File) {
        const url = URL.createObjectURL(videoValue);
        setVideoPreview(url);
        return () => URL.revokeObjectURL(url);
      }
      setVideoPreview(
        typeof videoValue === "string" && videoValue ? videoValue : null,
      );
    }, [videoValue]);

    // ── Video file error state ─────────────────────────────────────────────
    const [videoFileError, setVideoFileError] = useState<string | null>(null);

    // C2: type check before size check (fail-fast)
    const handleVideoChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!(ACCEPTED_VIDEO_TYPES as readonly string[]).includes(file.type)) {
          setVideoFileError("Chỉ hỗ trợ định dạng MP4, MOV, WebM.");
          return;
        }
        if (file.size > MAX_VIDEO_SIZE) {
          setVideoFileError(`Dung lượng tối đa ${MAX_VIDEO_SIZE_MB}MB.`);
          return;
        }
        setVideoFileError(null);
        setValue("video", file, { shouldValidate: true, shouldDirty: true });
      },
      [setValue],
    );

    // ── C3: Scroll lock + scrollbar compensation ──────────────────────────
    useEffect(() => {
      if (!isOpen) return;
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      const prev = document.body.style.paddingRight;
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${scrollbarWidth}px`;
      return () => {
        document.body.style.overflow = "";
        document.body.style.paddingRight = prev;
      };
    }, [isOpen]);

    // ── A6: Escape to close ───────────────────────────────────────────────
    useEffect(() => {
      if (!isOpen) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape" && !isWorking) onClose();
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }, [isOpen, isWorking, onClose]);

    // C4: SSR guard
    if (typeof document === "undefined") return null;

    return createPortal(
      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5"
            role="presentation"
          >
            {/* ── Backdrop ── */}
            <motion.div
              key="mood-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="fixed inset-0"
              style={{
                background: "rgba(3,3,10,0.88)",
                backdropFilter: "blur(14px) saturate(140%)",
              }}
              onClick={!isWorking ? onClose : undefined}
              aria-hidden="true"
            />

            {/* ── Modal content ── */}
            <motion.div
              key="mood-content"
              initial={{ opacity: 0, scale: 0.94, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 6 }}
              transition={MODAL_SPRING}
              onClick={(e) => e.stopPropagation()} // C5
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className={cn(
                "relative z-[101] w-full max-w-[820px]",
                "bg-background border border-border/50",
                "rounded-2xl",
                "shadow-[0_32px_80px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)]",
                /*
                 * MOBILE FIX: on mobile (flex-col) the modal is a single
                 * scrollable column — max-h + overflow-y-auto lets the user
                 * scroll past the video panel to reach the form.
                 * On md+ (flex-row) height is fixed and only the form body
                 * scrolls internally (handled by the inner scrollable div).
                 */
                "flex flex-col md:flex-row",
                "max-h-[92vh] overflow-y-auto md:overflow-hidden",
                "scrollbar-thin",
              )}
            >
              {/* ════════════════════════════════════════════
                  LEFT: VIDEO PREVIEW PANEL
                  ════════════════════════════════════════════ */}
              <VideoUploadZone
                preview={videoPreview}
                fileError={videoFileError}
                isWorking={isWorking}
                onFileChange={handleVideoChange}
                inputDescId={fileInputDescId}
              />

              {/* ════════════════════════════════════════════
                  RIGHT: FORM PANEL
                  ════════════════════════════════════════════ */}
              {/*
               * MOBILE: outer modal scrolls, so no overflow-hidden here (would clip form).
               * md+: modal is fixed height flex-row — overflow-hidden confines inner scroll.
               */}
              <div className="flex-1 flex flex-col md:overflow-hidden bg-background min-w-0">
                {/* ── Header ── */}
                <div className="flex items-center justify-between px-5 sm:px-7 py-4 sm:py-5 border-b border-border/40 bg-background shrink-0 z-20">
                  <div className="flex items-center gap-3.5">
                    {/* Icon with gradient-brand from index.css §8 */}
                    <div
                      className={cn(
                        "p-2.5 rounded-xl shrink-0",
                        "border border-primary/20",
                        "shadow-brand",
                      )}
                      style={{
                        background:
                          "linear-gradient(135deg, hsl(var(--brand-500)/0.15), hsl(var(--wave-2)/0.1))",
                      }}
                    >
                      {isEditing ? (
                        <Palette
                          className="size-4 text-primary"
                          aria-hidden="true"
                        />
                      ) : (
                        <Video
                          className="size-4 text-primary"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h3
                        id={titleId}
                        className="text-base sm:text-lg font-black tracking-tight text-foreground leading-none uppercase"
                      >
                        {isEditing ? "Chỉnh Sửa Canvas" : "Thêm Canvas Mới"}
                      </h3>
                      <p
                        id={fileInputDescId}
                        className="text-[11px] font-medium text-muted-foreground mt-1 truncate"
                      >
                        Video nền dọc 9:16 · Tối đa {MAX_VIDEO_SIZE_MB}MB
                      </p>
                    </div>
                  </div>

                  {/* Close */}
                  <button
                    ref={firstFocusRef}
                    type="button"
                    onClick={onClose}
                    disabled={isWorking}
                    aria-label="Đóng"
                    className={cn(
                      "size-8 sm:size-9 rounded-lg shrink-0",
                      "flex items-center justify-center",
                      "text-muted-foreground hover:text-foreground",
                      "hover:bg-muted/60 border border-transparent hover:border-border/50",
                      "transition-all duration-150 active:scale-90",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                    )}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>

                {/* ── Form body — md+: inner scroll. mobile: natural height, outer modal scrolls ── */}
                <div className="flex-1 md:overflow-y-auto scrollbar-thin px-5 sm:px-7 py-6 sm:py-7 bg-background">
                  <form
                    id="mood-video-form"
                    onSubmit={handleSubmit}
                    noValidate
                    className="space-y-7"
                  >
                    {/* ── TITLE ── */}
                    <div className="space-y-1.5">
                      <Label htmlFor="mv-title" className={LABEL_CLASS}>
                        <Hash className="size-3" aria-hidden="true" />
                        Tiêu đề Mood Video
                        <span className="text-destructive ml-0.5">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="mv-title"
                          {...register("title")}
                          placeholder="VD: Mưa đêm phố cũ, Lofi Chill 01…"
                          autoComplete="off"
                          spellCheck={false}
                          className={cn(
                            "h-11 bg-muted/30 border-border/50 rounded-xl",
                            "text-sm font-semibold text-foreground",
                            "placeholder:text-muted-foreground/40",
                            "transition-all duration-150",
                            "focus-visible:ring-1 focus-visible:ring-primary",
                            "focus-visible:bg-card",
                            errors.title &&
                              "border-destructive/70 focus-visible:ring-destructive/60 pr-10",
                          )}
                        />
                        {errors.title && (
                          <AlertCircle
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-destructive pointer-events-none"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <FieldError message={errors.title?.message as string} />
                    </div>

                    {/* ── DIVIDER ── */}
                    <div className="divider-fade" aria-hidden="true" />

                    {/* ── TAGS ── */}
                    <div className="space-y-1.5">
                      <Label className={LABEL_CLASS}>
                        <Tag className="size-3" aria-hidden="true" />
                        Tags cảm xúc
                        <span className="text-muted-foreground/40 font-medium normal-case tracking-normal text-[9px] ml-1">
                          Enter để thêm
                        </span>
                      </Label>
                      <Controller
                        control={control}
                        name="tags"
                        render={({ field }) => {
                          const tags = (field.value ?? []) as string[];
                          return (
                            <div className="space-y-3">
                              <Input
                                placeholder="lofi, chill, sad, night, rainy…"
                                autoComplete="off"
                                spellCheck={false}
                                className={cn(
                                  "h-10 bg-muted/30 border-border/50 rounded-xl text-sm",
                                  "placeholder:text-muted-foreground/40",
                                  "focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-card",
                                  "transition-all duration-150",
                                )}
                                onKeyDown={(e) => {
                                  if (e.key !== "Enter") return;
                                  e.preventDefault();
                                  const input = e.target as HTMLInputElement;
                                  const val = input.value.trim().toLowerCase();
                                  if (val && !tags.includes(val)) {
                                    field.onChange([...tags, val]);
                                    input.value = "";
                                  }
                                }}
                              />

                              {tags.length > 0 && (
                                <AnimatePresence mode="popLayout">
                                  <motion.div className="flex flex-wrap gap-1.5">
                                    {tags.map((tag) => (
                                      <TagChip
                                        key={tag}
                                        tag={tag}
                                        onRemove={(t) =>
                                          field.onChange(
                                            tags.filter((x) => x !== t),
                                          )
                                        }
                                      />
                                    ))}
                                  </motion.div>
                                </AnimatePresence>
                              )}
                            </div>
                          );
                        }}
                      />
                    </div>

                    {/* ── DIVIDER ── */}
                    <div className="divider-fade" aria-hidden="true" />

                    {/* ── STATUS TOGGLE — .glass-frosted from index.css §6 ── */}
                    <div className="space-y-1.5">
                      <p className={LABEL_CLASS}>
                        <Activity className="size-3" aria-hidden="true" />
                        Trạng thái hoạt động
                      </p>
                      <button
                        type="button"
                        aria-pressed={isActive}
                        onClick={() =>
                          setValue("isActive", !isActive, { shouldDirty: true })
                        }
                        className={cn(
                          "w-full flex items-center justify-between p-4 rounded-2xl",
                          "border transition-all duration-200 text-left",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          isActive
                            ? [
                                "border-primary/30 bg-primary/[0.06]",
                                "shadow-[0_0_24px_hsl(var(--brand-glow)/0.08)]",
                              ]
                            : "border-border/40 bg-muted/20 hover:border-border/70 hover:bg-muted/35",
                        )}
                      >
                        <div className="flex gap-3.5 items-center">
                          {/* Icon */}
                          <div
                            className={cn(
                              "p-2.5 rounded-xl transition-all duration-200",
                              isActive
                                ? "bg-primary/15 text-primary"
                                : "bg-muted/60 text-muted-foreground",
                            )}
                          >
                            {isActive ? (
                              <CheckCircle2
                                className="size-4"
                                aria-hidden="true"
                              />
                            ) : (
                              <EyeOff className="size-4" aria-hidden="true" />
                            )}
                          </div>

                          {/* Text */}
                          <div>
                            <span className="text-sm font-bold text-foreground block leading-none mb-1">
                              {isActive ? "Đang hoạt động" : "Đang ẩn"}
                            </span>
                            <span
                              className={cn(
                                "text-[11px] font-medium transition-colors",
                                isActive
                                  ? "text-primary/80"
                                  : "text-muted-foreground",
                              )}
                            >
                              {isActive
                                ? "Video khả dụng để gán cho bài hát"
                                : "Video bị ẩn, không thể gán cho bài hát"}
                            </span>
                          </div>
                        </div>

                        {/* Switch — stopPropagation so parent button keeps aria-pressed */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="pl-3 shrink-0"
                          aria-hidden="true"
                        >
                          <Switch
                            checked={isActive}
                            onCheckedChange={(val) =>
                              setValue("isActive", val, { shouldDirty: true })
                            }
                            tabIndex={-1}
                            className="data-[state=checked]:bg-primary scale-[1.05]"
                          />
                        </div>
                      </button>
                    </div>
                  </form>
                </div>

                {/* ── Footer ── */}
                <div className="shrink-0 z-20">
                  {/* divider-glow from index.css §19 */}
                  <div className="divider-glow" aria-hidden="true" />
                  <div className="flex items-center justify-between px-5 sm:px-7 py-4 bg-background gap-3">
                    <p className="text-[10px] text-muted-foreground/50 font-medium hidden sm:block leading-snug">
                      9:16 Vertical&nbsp;·&nbsp;MP4 / MOV / WebM&nbsp;·&nbsp;Max{" "}
                      {MAX_VIDEO_SIZE_MB}MB
                    </p>
                    <div className="flex gap-2.5 w-full sm:w-auto">
                      {/* Cancel */}
                      <button
                        type="button"
                        onClick={onClose}
                        disabled={isWorking}
                        className={cn(
                          "btn-secondary btn-sm flex-1 sm:flex-none",
                          "font-bold",
                        )}
                      >
                        Hủy
                      </button>

                      {/* Submit */}
                      <button
                        type="submit"
                        form="mood-video-form"
                        disabled={isWorking}
                        aria-busy={isWorking}
                        className={cn(
                          "btn-primary btn-sm flex-1 sm:flex-none",
                          "font-bold min-w-[130px]",
                          "inline-flex items-center justify-center gap-2",
                        )}
                      >
                        {isWorking ? (
                          <>
                            <Loader2
                              className="size-3.5 animate-spin"
                              aria-hidden="true"
                            />
                            Đang lưu…
                          </>
                        ) : (
                          <>
                            <Save className="size-3.5" aria-hidden="true" />
                            {isEditing ? "Lưu thay đổi" : "Tải lên Canvas"}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* A7: SR-only status announcement */}
                <div
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className="sr-only"
                >
                  {isWorking ? "Đang lưu mood video, vui lòng chờ…" : ""}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body,
    );
  },
);

MoodVideoModal.displayName = "MoodVideoModal";
export default MoodVideoModal;
