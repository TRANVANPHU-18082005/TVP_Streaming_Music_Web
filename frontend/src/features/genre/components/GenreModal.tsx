/**
 * GenreModal.tsx — Create / Edit genre modal
 *
 * Design System: Soundwave (Obsidian Luxury / Neural Audio)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * DELTA-ONLY REFACTOR
 *
 * FIX 1: Scroll lock — no scrollbar width compensation (layout shift on open)
 * FIX 2: Scroll lock cleanup unsafe in StrictMode double-invoke
 * FIX 3: No exit animation — modal blinks off instead of fading+scaling out
 * FIX 4: Modal content needs stopPropagation to prevent overlay close
 * FIX 5: createPortal(document.body) — SSR unsafe without guard
 * FIX 6: handleImageChange — no pre-validation (size/type) before setValue
 * FIX 7: labelClass string constant defined inside render — should be module scope
 * FIX 8: Trending toggle <div onClick> — WCAG violation (no role, tabIndex, aria)
 * FIX 9: File input missing aria-label
 * FIX 10: isWorking derived inline 5× — should be useMemo
 * FIX 11: watchColor fallback shows "black swatch" when no color selected
 * FIX 12: GenreModal not memo'd — parent re-renders on filter/sort state changes
 */

import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import { Controller } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Music,
  Palette,
  Layers,
  Image as ImageIcon,
  TrendingUp,
  AlertCircle,
  Hash,
  Paintbrush,
  Camera,
  AlignLeft,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Genre } from "../types";
import { useGenreForm } from "../hooks/useGenreForm";

import { GenreSelector } from "./GenreSelector";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — FIX 7: module scope
// ─────────────────────────────────────────────────────────────────────────────

const LABEL_CLASS =
  "text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5 w-fit";

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
];

const MODAL_SPRING = { type: "spring", stiffness: 380, damping: 30 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface GenreModalProps {
  isOpen: boolean;
  onClose: () => void;
  genreToEdit?: Genre | null;
  onSubmit: (data: FormData) => Promise<void>;
  isPending: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// GENRE MODAL — FIX 12: memo
// ─────────────────────────────────────────────────────────────────────────────

const GenreModal = memo<GenreModalProps>(
  ({ isOpen, onClose, genreToEdit, onSubmit, isPending }) => {
    const {
      form,
      handleSubmit,
      isSubmitting: isFormSubmitting,
    } = useGenreForm({ genreToEdit, onSubmit });

    const {
      register,
      setValue,
      watch,
      control,
      formState: { errors },
    } = form;

    const isEditing = !!genreToEdit;
    const watchGradient = watch("gradient");
    const watchColor = watch("color");
    const currentParentId = watch("parentId");
    const isTrending = watch("isTrending");
    const imageValue = watch("image");

    // FIX 10: single useMemo — computed once per render, used in 5 places
    const isWorking = useMemo(
      () => isPending || isFormSubmitting,
      [isPending, isFormSubmitting],
    );

    // ── Image preview ──────────────────────────────────────────────────────────

    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageFileError, setImageFileError] = useState<string | null>(null);

    useEffect(() => {
      if (imageValue instanceof File) {
        const url = URL.createObjectURL(imageValue);
        setImagePreview(url);
        return () => URL.revokeObjectURL(url);
      } else if (typeof imageValue === "string" && imageValue.length > 0) {
        setImagePreview(imageValue);
      } else {
        setImagePreview(null);
      }
    }, [imageValue]);

    // FIX 6: pre-validate size + type before setValue
    const handleImageChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!ACCEPTED_TYPES.includes(file.type)) {
          setImageFileError("Chi ho tro JPEG, PNG, WebP, SVG.");
          return;
        }
        if (file.size > MAX_FILE_SIZE) {
          setImageFileError(`Kich thuoc toi da ${MAX_FILE_SIZE_MB}MB.`);
          return;
        }
        setImageFileError(null);
        setValue("image", file, { shouldValidate: true, shouldDirty: true });
      },
      [setValue],
    );

    // ── FIX 1 + 2: Scroll lock with scrollbar compensation ────────────────────

    useEffect(() => {
      if (!isOpen) return;
      // FIX 1: measure scrollbar width before hiding it
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${scrollbarWidth}px`;

      return () => {
        // FIX 2: always clean up — effect runs on open only so cleanup = close
        document.body.style.overflow = "";
        document.body.style.paddingRight = "";
      };
    }, [isOpen]);

    // ── Escape key ────────────────────────────────────────────────────────────

    useEffect(() => {
      if (!isOpen) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape" && !isWorking) onClose();
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }, [isOpen, isWorking, onClose]);

    // ── FIX 5: SSR guard ──────────────────────────────────────────────────────

    if (typeof document === "undefined") return null;

    return createPortal(
      // FIX 3: AnimatePresence enables exit animation (fade + scale out)
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop — FIX 3: motion.div for smooth fade out */}
            <motion.div
              key="genre-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
              onClick={!isWorking ? onClose : undefined}
            />

            {/* Content — FIX 3: scale + fade out, FIX 4: stopPropagation */}
            <motion.div
              key="genre-modal-content"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 4 }}
              transition={MODAL_SPRING}
              onClick={(e) => e.stopPropagation()}
              className="relative z-[101] w-full max-w-2xl bg-background border border-border rounded-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-labelledby="genre-modal-title"
            >
              {/* HEADER */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-background shrink-0 z-20">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 rounded-xl text-primary border border-primary/10 shadow-sm">
                    {isEditing ? (
                      <Palette className="size-5" />
                    ) : (
                      <Music className="size-5" />
                    )}
                  </div>
                  <div>
                    <h3
                      id="genre-modal-title"
                      className="text-lg font-bold leading-none text-foreground uppercase tracking-tight"
                    >
                      {isEditing ? "Cap Nhat The Loai" : "Tao The Loai Moi"}
                    </h3>
                    <p className="text-[13px] font-medium text-muted-foreground mt-1">
                      {isEditing
                        ? "Chinh sua thong tin chi tiet cua danh muc nay."
                        : "Them mot danh muc am nhac moi vao he thong."}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  disabled={isWorking}
                  aria-label="Close modal"
                  className="rounded-md size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="size-5" aria-hidden="true" />
                </Button>
              </div>

              {/* BODY */}
              <div className="flex-1 overflow-y-auto custom-scrollbar bg-background p-6 sm:p-8">
                <form
                  id="genre-form"
                  onSubmit={handleSubmit}
                  className="space-y-8"
                >
                  {/* SECTION 1: GENERAL */}
                  <div>
                    <h4 className="text-[13px] font-bold uppercase tracking-widest text-foreground mb-6">
                      Thong tin chung
                    </h4>
                    <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
                      {/* Image upload */}
                      <div className="flex flex-col gap-2 shrink-0">
                        <div
                          className={cn(
                            "relative group size-36 sm:size-40 rounded-xl border-2 border-dashed overflow-hidden flex items-center justify-center cursor-pointer transition-all duration-300",
                            errors.image || imageFileError
                              ? "border-destructive/50 bg-destructive/5"
                              : "border-muted-foreground/20 bg-secondary/10 hover:border-primary/50 hover:bg-primary/5 shadow-sm hover:shadow-md",
                          )}
                        >
                          {imagePreview ? (
                            <>
                              <img
                                src={imagePreview}
                                alt="Genre image preview"
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center text-white backdrop-blur-[2px]">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="cursor-pointer font-semibold shadow-md pointer-events-none"
                                >
                                  <Camera className="w-4 h-4 mr-2" /> Doi anh
                                </Button>
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center text-muted-foreground transition-colors group-hover:text-primary">
                              <div className="p-3 rounded-full bg-background shadow-sm mb-2 border border-border/50">
                                <ImageIcon className="size-6" />
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-wide">
                                Tai anh / icon
                              </span>
                            </div>
                          )}

                          {/* FIX 9: aria-label on file input */}
                          <input
                            type="file"
                            accept={ACCEPTED_TYPES.join(",")}
                            aria-label="Upload genre image"
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            onChange={handleImageChange}
                          />

                          {(errors.image || imageFileError) && (
                            <div className="absolute bottom-2 right-2 bg-destructive/90 backdrop-blur px-2 py-1 rounded text-[10px] text-destructive-foreground font-bold flex items-center gap-1 z-20">
                              <AlertCircle className="size-3" />
                              {imageFileError ? "File khong hop le" : "Loi anh"}
                            </div>
                          )}
                        </div>
                        {imageFileError && (
                          <p className="text-[11px] text-destructive font-medium max-w-[160px]">
                            {imageFileError}
                          </p>
                        )}
                      </div>

                      {/* Basic inputs */}
                      <div className="flex-1 w-full space-y-5">
                        <div className="space-y-2">
                          <Label htmlFor="name" className={LABEL_CLASS}>
                            <Music className="size-3.5" />
                            Ten the loai{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <div className="relative">
                            <Input
                              id="name"
                              {...register("name")}
                              placeholder="VD: Pop, Ballad, Lofi..."
                              className={cn(
                                "h-11 bg-transparent border-input rounded-md text-[15px] font-semibold focus-visible:ring-1 focus-visible:ring-primary transition-all",
                                errors.name &&
                                  "border-destructive focus-visible:ring-destructive pr-10",
                              )}
                            />
                            {errors.name && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive">
                                <AlertCircle className="size-4" />
                              </div>
                            )}
                          </div>
                          {errors.name && (
                            <p className="text-[12px] font-medium text-destructive mt-1 flex items-center gap-1.5 animate-in slide-in-from-top-1">
                              {errors.name.message as string}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label className={LABEL_CLASS}>
                            <Layers className="size-3.5" />
                            The loai cha (Danh muc goc)
                          </Label>
                          <div className="bg-background rounded-md border border-input p-2 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                            <GenreSelector
                              variant="form"
                              excludeIds={genreToEdit ? [genreToEdit._id] : []}
                              singleSelect={true}
                              value={currentParentId}
                              onChange={(id) => {
                                setValue("parentId", id || "", {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
                              }}
                              className="border-none shadow-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <hr className="border-border border-dashed" />

                  {/* SECTION 2: DESIGN */}
                  <div>
                    <h4 className="text-[13px] font-bold uppercase tracking-widest text-foreground mb-6">
                      Cau hinh giao dien
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-5">
                        {/* Color */}
                        <div>
                          <Label className={LABEL_CLASS}>
                            <Palette className="size-3.5" /> Mau chu dao
                          </Label>
                          <div
                            className={cn(
                              "flex gap-3 items-center p-1.5 border rounded-md bg-transparent transition-colors",
                              errors.color
                                ? "border-destructive ring-1 ring-destructive/20"
                                : "border-input",
                            )}
                          >
                            <div className="relative size-8 rounded overflow-hidden border border-border shadow-inner shrink-0 group hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer">
                              <input
                                type="color"
                                {...register("color")}
                                className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] cursor-pointer p-0 m-0"
                              />
                            </div>
                            {/* FIX 11: show "Chua chon mau" when no color selected */}
                            <span className="text-xs font-mono uppercase text-foreground font-semibold">
                              {watchColor || "Chua chon mau"}
                            </span>
                          </div>
                          {errors.color && (
                            <p className="text-[12px] font-medium text-destructive mt-1 flex items-center gap-1.5">
                              <AlertCircle className="size-3.5" />{" "}
                              {errors.color.message as string}
                            </p>
                          )}
                        </div>

                        {/* Priority */}
                        <div>
                          <Label className={LABEL_CLASS}>
                            <Hash className="size-3.5" /> Do uu tien hien thi
                          </Label>
                          <Input
                            type="number"
                            {...register("priority", { valueAsNumber: true })}
                            placeholder="0"
                            className={cn(
                              "h-11 bg-transparent border-input font-mono text-[15px] focus-visible:ring-1 focus-visible:ring-primary",
                              errors.priority &&
                                "border-destructive focus-visible:ring-destructive",
                            )}
                          />
                          {errors.priority && (
                            <p className="text-[12px] font-medium text-destructive mt-1 flex items-center gap-1.5">
                              <AlertCircle className="size-3.5" />{" "}
                              {errors.priority.message as string}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-5">
                        {/* Gradient */}
                        <div>
                          <Label className={LABEL_CLASS}>
                            <Paintbrush className="size-3.5" /> Background
                            Gradient CSS
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              {...register("gradient")}
                              placeholder="linear-gradient(to right, ...)"
                              className={cn(
                                "h-11 bg-transparent border-input font-mono text-xs focus-visible:ring-1 focus-visible:ring-primary",
                                errors.gradient &&
                                  "border-destructive focus-visible:ring-destructive",
                              )}
                            />
                            <div
                              className="size-11 rounded-md border border-border shadow-sm shrink-0 bg-checkerboard relative overflow-hidden"
                              title="Gradient Preview"
                              aria-hidden="true"
                            >
                              <div
                                className="absolute inset-0"
                                style={{
                                  background: watchGradient || "transparent",
                                }}
                              />
                            </div>
                          </div>
                          {errors.gradient && (
                            <p className="text-[12px] font-medium text-destructive mt-1 flex items-center gap-1.5">
                              <AlertCircle className="size-3.5" />{" "}
                              {errors.gradient.message as string}
                            </p>
                          )}
                        </div>

                        {/* Description */}
                        <div>
                          <Label htmlFor="description" className={LABEL_CLASS}>
                            <AlignLeft className="size-3.5" /> Mo ta ngan
                          </Label>
                          <Textarea
                            id="description"
                            {...register("description")}
                            rows={2}
                            className={cn(
                              "resize-none h-[44px] custom-scrollbar bg-transparent border-input text-sm focus-visible:ring-1 focus-visible:ring-primary",
                              errors.description &&
                                "border-destructive focus-visible:ring-destructive",
                            )}
                            placeholder="Thong tin them (neu co)..."
                          />
                          {errors.description && (
                            <p className="text-[12px] font-medium text-destructive mt-1 flex items-center gap-1.5">
                              <AlertCircle className="size-3.5" />{" "}
                              {errors.description.message as string}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <hr className="border-border border-dashed" />

                  {/* SECTION 3: TRENDING
                   * FIX 8: <button type="button"> instead of <div onClick>
                   * Adds keyboard access (Tab focus, Enter/Space activate).
                   * aria-pressed communicates toggle state to screen readers.
                   */}
                  <button
                    type="button"
                    aria-pressed={isTrending}
                    onClick={() =>
                      setValue("isTrending", !isTrending, { shouldDirty: true })
                    }
                    className={cn(
                      "w-full flex items-center justify-between p-4 border rounded-xl transition-all cursor-pointer select-none group text-left",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      isTrending
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-input bg-transparent hover:border-primary/50 hover:bg-muted/30",
                    )}
                  >
                    <div className="flex gap-4 items-center">
                      <div
                        className={cn(
                          "p-2.5 rounded-lg transition-colors",
                          isTrending
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground group-hover:text-foreground",
                        )}
                      >
                        <TrendingUp className="size-5" aria-hidden="true" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-foreground block">
                          Trang thai Trending (Thinh hanh)
                        </span>
                        <p
                          className={cn(
                            "text-[11px] font-medium mt-0.5 transition-colors",
                            isTrending
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                        >
                          {isTrending
                            ? "Dang duoc danh dau la the loai thinh hanh"
                            : "Khong nam trong danh sach thinh hanh"}
                        </p>
                      </div>
                    </div>

                    {/* Switch — stopPropagation prevents double toggle */}
                    <div
                      className="pl-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                      aria-hidden="true" // the parent button handles accessibility
                    >
                      <Controller
                        control={control}
                        name="isTrending"
                        render={({ field }) => (
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            tabIndex={-1} // button parent handles focus
                            className="data-[state=checked]:bg-primary scale-110"
                          />
                        )}
                      />
                    </div>
                  </button>
                </form>
              </div>

              {/* FOOTER */}
              <div className="flex items-center justify-between p-5 border-t border-border bg-background shrink-0 z-20">
                <p className="text-[11px] text-muted-foreground font-medium hidden sm:block">
                  Cac truong co{" "}
                  <span className="text-destructive font-bold text-sm">*</span>{" "}
                  la bat buoc.
                </p>
                <div className="flex gap-3 w-full sm:w-auto">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={onClose}
                    disabled={isWorking}
                    className="font-bold border-input bg-background hover:bg-accent hover:text-foreground h-10 px-5 rounded-md flex-1 sm:flex-none"
                  >
                    Huy
                  </Button>
                  <Button
                    type="submit"
                    form="genre-form"
                    disabled={isWorking}
                    className="font-bold shadow-md hover:shadow-lg transition-all h-10 px-6 rounded-md flex-1 sm:flex-none"
                  >
                    {isWorking ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" /> Dang
                        luu...
                      </>
                    ) : (
                      <>
                        <Save className="size-4 mr-2" />
                        {isEditing ? "Luu thay doi" : "Tao the loai"}
                      </>
                    )}
                  </Button>
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

GenreModal.displayName = "GenreModal";
export default GenreModal;
