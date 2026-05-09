import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
  lazy,
  Suspense,
} from "react";
import { createPortal } from "react-dom";
import { Controller } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Music,
  Palette,
  Layers,
  TrendingUp,
  AlertCircle,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGenreForm } from "../hooks/useGenreForm";

const GenreSelector = lazy(() =>
  import("./GenreSelector").then((m) => ({
    default: m.GenreSelector,
  })),
);
const GenreImageUploadLazy = lazy(() => import("./GenreImageUpload"));
const GenreDesignFieldsLazy = lazy(() => import("./GenreDesignFields"));
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { IGenre } from "../types";
import { env } from "@/config/env";
import { WaveformBars } from "@/components/MusicVisualizer";
import { handleError } from "@/utils/handleError";

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
  genreToEdit?: IGenre | null;
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
    } = useGenreForm(
      genreToEdit
        ? {
            mode: "edit",
            genreToEdit,
            onSubmit,
          }
        : {
            mode: "create",
            onSubmit,
          },
    );
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
    console.log(currentParentId);
    // FIX 10: single useMemo — computed once per render, used in 5 places
    const isWorking = useMemo(
      () => isPending || isFormSubmitting,
      [isPending, isFormSubmitting],
    );

    if (env.NODE_ENV === "development") {
      try {
        // eslint-disable-next-line no-console
        console.debug("[GenreModal] render status:", {
          isWorking,
          isFormSubmitting,
          isPending,
          dirtyFields: form.formState.dirtyFields,
        });
      } catch (e) {
        /* ignore */
        handleError(e, "[GenreModal] Debug log error");
      }
    }

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
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop — FIX 3: motion.div for smooth fade out */}
            <motion.div
              key="genre-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Content — FIX 3: scale + fade out, FIX 4: stopPropagation */}
            <motion.div
              key="genre-modal-content"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 4 }}
              transition={MODAL_SPRING}
              onClick={(e) => e.stopPropagation()}
              className="relative z-101 w-full max-w-2xl bg-background border border-border rounded-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
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
                      {isEditing ? "Cập nhật Thể loại" : "Tạo Thể loại mới"}
                    </h3>
                    <p className="text-[13px] font-medium text-muted-foreground mt-1">
                      {isEditing
                        ? "Chỉnh sửa thông tin chi tiết của danh mục này."
                        : "Thêm một danh mục âm nhạc mới vào hệ thống."}
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
                      Thông tin chung
                    </h4>
                    <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
                      {/* Image upload (extracted) */}
                      <div className="flex flex-col gap-2 shrink-0">
                        <Suspense
                          fallback={
                            <div className="size-36 sm:size-40 rounded-xl bg-muted/10 flex items-center justify-center">
                              ...
                            </div>
                          }
                        >
                          <GenreImageUploadLazy
                            imagePreview={imagePreview}
                            onImageChange={handleImageChange}
                            imageFileError={imageFileError}
                            error={errors.image}
                            disabled={isWorking}
                          />
                        </Suspense>
                      </div>

                      {/* Basic inputs */}
                      <div className="flex-1 w-full space-y-5">
                        <div className="space-y-2">
                          <Label htmlFor="name" className={LABEL_CLASS}>
                            <Music className="size-3.5" />
                            Tên thể loại{" "}
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
                            Thể loại cha (Danh mục gốc)
                          </Label>
                          <div className="bg-background rounded-md border border-input p-2 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                            <Suspense fallback={<WaveformBars active />}>
                              <GenreSelector
                                variant="form"
                                excludeIds={
                                  genreToEdit ? [genreToEdit._id] : []
                                }
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
                            </Suspense>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <hr className="border-border border-dashed" />

                  {/* SECTION 2: DESIGN — extracted */}
                  <div>
                    <Suspense fallback={<div className="py-6">...</div>}>
                      <GenreDesignFieldsLazy
                        register={register}
                        errors={errors}
                        watchColor={watchColor}
                        watchGradient={watchGradient}
                      />
                    </Suspense>
                  </div>

                  <hr className="border-border border-dashed" />

                  {/* SECTION 3: TRENDING
                   * FIX 8: <button type="button"> instead of <div onClick>
                   * Adds keyboard access (Tab focus, Enter/Space activate).
                   * aria-pressed communicates toggle state to screen readers.
                   */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-pressed={isTrending}
                    onClick={(e) => {
                      // Avoid toggling when an inner <button> (the Radix Switch) was clicked
                      if ((e.target as HTMLElement).closest("button")) return;
                      setValue("isTrending", !isTrending, {
                        shouldDirty: true,
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setValue("isTrending", !isTrending, {
                          shouldDirty: true,
                        });
                      }
                    }}
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
                      <div
                        onClick={(e) => e.stopPropagation()}
                        aria-hidden="true"
                        className={cn(
                          "pl-2 shrink-0",
                          "text-[11px] font-medium mt-0.5 transition-colors",
                          isTrending ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        <p>
                          {isTrending
                            ? "Đang được đánh dấu là thể loại thịnh hành"
                            : "Không nằm trong danh sách thịnh hành"}
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
                  </div>
                </form>
              </div>

              {/* FOOTER */}
              <div className="flex items-center justify-between p-5 border-t border-border bg-background shrink-0 z-20">
                <p className="text-[11px] text-muted-foreground font-medium hidden sm:block">
                  Các trường có{" "}
                  <span className="text-destructive font-bold text-sm">*</span>{" "}
                  là bắt buộc.
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
                    onClick={() =>
                      // eslint-disable-next-line no-console
                      console.debug("[GenreModal] Save clicked", {
                        isWorking,
                        dirtyFields: form.formState.dirtyFields,
                      })
                    }
                    className="font-bold shadow-md hover:shadow-lg transition-all h-10 px-6 rounded-md flex-1 sm:flex-none"
                  >
                    {isWorking ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" /> Đang
                        lưu...
                      </>
                    ) : (
                      <>
                        <Save className="size-4 mr-2" />
                        {isEditing ? "Lưu thay đổi" : "Tạo thể loại"}
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
