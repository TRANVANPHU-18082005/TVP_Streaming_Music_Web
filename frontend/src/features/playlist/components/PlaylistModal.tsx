import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import { Controller } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Save,
  Loader2,
  Camera,
  Globe,
  Lock,
  Link as LinkIcon,
  ImageIcon,
  CheckCircle2,
  Tags,
  Users,
  AlertCircle,
  Type,
  AlignLeft,
  Palette,
  Music2,
  Calendar,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAppSelector } from "@/store/hooks";
import { PLAYLIST_TYPES, PlaylistType } from "../schemas/playlist.schema";
import { cn } from "@/lib/utils";
import { usePlaylistForm } from "../hooks/usePlaylistForm";
import { TagInput } from "@/components/ui/tag-input";
import { UserSelector } from "@/features/user/components/UserSelector";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { IPlaylist } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// MODULE-SCOPE CONSTANTS — zero re-allocation per render
// ─────────────────────────────────────────────────────────────────────────────

const LABEL_CLASS =
  "text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5 w-fit";

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_ATTR = ACCEPTED_IMAGE_TYPES.join(",");

/** Matches GenreModal MODAL_SPRING — consistent spring physics across modals */
const MODAL_SPRING = {
  type: "spring",
  stiffness: 380,
  damping: 30,
} as const;

const VISIBILITY_OPTIONS = [
  {
    id: "public",
    label: "Công khai",
    desc: "Ai cũng có thể tìm thấy",
    icon: Globe,
    activeColor: "text-emerald-400",
    activeBg: "bg-emerald-500/10",
    activeBorder: "border-emerald-500/40",
    activeRing: "ring-emerald-500/15",
    activeIconBg: "bg-emerald-500/15",
    dotColor: "bg-emerald-400",
  },
  {
    id: "private",
    label: "Riêng tư",
    desc: "Chỉ mình bạn xem được",
    icon: Lock,
    activeColor: "text-rose-400",
    activeBg: "bg-rose-500/10",
    activeBorder: "border-rose-500/40",
    activeRing: "ring-rose-500/15",
    activeIconBg: "bg-rose-500/15",
    dotColor: "bg-rose-400",
  },
  {
    id: "unlisted",
    label: "Bảo mật Link",
    desc: "Chỉ ai có link mới xem",
    icon: LinkIcon,
    activeColor: "text-sky-400",
    activeBg: "bg-sky-500/10",
    activeBorder: "border-sky-500/40",
    activeRing: "ring-sky-500/15",
    activeIconBg: "bg-sky-500/15",
    dotColor: "bg-sky-400",
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlistToEdit?: IPlaylist | null;
  onSubmit: (data: FormData) => Promise<void>;
  isPending: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SectionBlock — mirrors GenreModal's section heading style.
 * hr separator + uppercase label pattern for visual rhythm.
 */
const SectionBlock = memo(
  ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <h4 className="text-[13px] font-bold uppercase tracking-widest text-foreground mb-6">
        {title}
      </h4>
      {children}
    </div>
  ),
);
SectionBlock.displayName = "SectionBlock";

/**
 * CoverUpload — isolated file zone with pre-validation.
 * Mirrors GenreModal's image upload zone (FIX 6, FIX 9).
 */
const CoverUpload = memo(
  ({
    preview,
    hasError,
    fileError,
    onFileChange,
  }: {
    preview: string | null;
    hasError: boolean;
    fileError: string | null;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  }) => (
    <div className="flex flex-col gap-2 shrink-0">
      <div
        className={cn(
          "relative group size-36 sm:size-40 rounded-xl border-2 border-dashed overflow-hidden",
          "flex items-center justify-center cursor-pointer transition-all duration-300",
          hasError || fileError
            ? "border-destructive/50 bg-destructive/5"
            : "border-muted-foreground/20 bg-secondary/10 hover:border-primary/50 hover:bg-primary/5 shadow-sm hover:shadow-md",
        )}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt="Cover preview"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center text-white backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-1.5">
                <div className="p-2.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20">
                  <Camera className="size-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide">
                  Đổi ảnh
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground transition-colors group-hover:text-primary px-3 text-center">
            <div className="p-3 rounded-full bg-background shadow-sm mb-2 border border-border/50 group-hover:bg-primary/5 group-hover:border-primary/30 transition-all">
              <ImageIcon className="size-6" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wide leading-tight">
              Tải ảnh lên
              <br />
              <span className="text-[9px] font-medium normal-case tracking-normal opacity-60">
                JPG · PNG · WEBP
              </span>
            </span>
          </div>
        )}

        {/* FIX 9: aria-label on file input */}
        <input
          type="file"
          accept={ACCEPTED_ATTR}
          aria-label="Upload cover image"
          className="absolute inset-0 opacity-0 cursor-pointer z-10"
          onChange={onFileChange}
        />

        {(hasError || fileError) && (
          <div className="absolute bottom-2 right-2 bg-destructive/90 backdrop-blur px-2 py-1 rounded text-[10px] text-destructive-foreground font-bold flex items-center gap-1 z-20 animate-in zoom-in duration-150">
            <AlertCircle className="size-3" />
            {fileError ? "File lỗi" : "Lỗi ảnh"}
          </div>
        )}
      </div>
      {fileError && (
        <p className="text-[11px] text-destructive font-medium max-w-[160px] leading-snug">
          {fileError}
        </p>
      )}
    </div>
  ),
);
CoverUpload.displayName = "CoverUpload";

/**
 * VisibilityCard — memo'd radio button.
 * Mirrors GenreModal's trending <button aria-pressed> pattern (FIX 8).
 * Only re-renders when its own isSelected flips.
 */
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
          "relative p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer",
          "flex flex-col gap-3 text-left w-full group select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isSelected
            ? cn(
              "ring-4 shadow-md",
              option.activeBg,
              option.activeBorder,
              option.activeRing,
            )
            : "border-input bg-transparent hover:border-primary/50 hover:bg-muted/30",
        )}
      >
        <div className="flex items-center justify-between w-full">
          <div
            className={cn(
              "p-2.5 rounded-lg transition-all duration-200",
              isSelected
                ? cn(option.activeIconBg, "shadow-sm")
                : "bg-muted text-muted-foreground group-hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-4.5 transition-colors",
                isSelected
                  ? option.activeColor
                  : "text-muted-foreground group-hover:text-foreground",
              )}
            />
          </div>
          <div
            className={cn(
              "size-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 shrink-0",
              isSelected
                ? cn("scale-110 border-transparent", option.dotColor)
                : "border-muted-foreground/30 group-hover:border-primary/50",
            )}
          >
            {isSelected && <CheckCircle2 className="size-3 text-white" />}
          </div>
        </div>
        <div>
          <span
            className={cn(
              "text-sm font-bold block leading-tight transition-colors",
              isSelected
                ? "text-foreground"
                : "text-muted-foreground group-hover:text-foreground",
            )}
          >
            {option.label}
          </span>
          <span className="text-[11px] text-muted-foreground/70 font-medium mt-0.5 block leading-snug">
            {option.desc}
          </span>
        </div>
      </button>
    );
  },
);
VisibilityCard.displayName = "VisibilityCard";

// ─────────────────────────────────────────────────────────────────────────────
// PLAYLIST MODAL — memo (FIX 12)
// ─────────────────────────────────────────────────────────────────────────────

const PlaylistModal = memo<PlaylistModalProps>(
  ({ isOpen, onClose, playlistToEdit, onSubmit, isPending }) => {
    const isEditing = Boolean(playlistToEdit);

    const {
      form,
      handleSubmit,
      isSubmitting: isFormSubmitting,
    } = usePlaylistForm(
      playlistToEdit
        ? {
          mode: "edit",
          playlistToEdit,
          onSubmit,
        }
        : {
          mode: "create",
          onSubmit,
        },
    );
    const {
      register,
      control,
      formState: { errors },
      setValue,
      watch,
    } = form;

    const { user } = useAppSelector((s) => s.auth);
    const isAdmin = user?.role === "admin";

    // FIX 10: single useMemo
    const isWorking = useMemo(
      () => isPending || isFormSubmitting,
      [isPending, isFormSubmitting],
    );

    // ── Cover image preview lifecycle ───────────────────────────────────────
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [coverFileError, setCoverFileError] = useState<string | null>(null);
    const coverValue = watch("coverImage");

    useEffect(() => {
      if (coverValue instanceof File) {
        const url = URL.createObjectURL(coverValue);
        setCoverPreview(url);
        return () => URL.revokeObjectURL(url);
      }
      setCoverPreview(
        typeof coverValue === "string" && coverValue ? coverValue : null,
      );
    }, [coverValue]);

    // FIX 6: pre-validate type + size (matches GenreModal handleImageChange)
    const handleCoverChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
          setCoverFileError("Chỉ hỗ trợ JPEG, PNG, WebP.");
          return;
        }
        if (file.size > MAX_FILE_SIZE) {
          setCoverFileError(`Kích thước tối đa ${MAX_FILE_SIZE_MB}MB.`);
          return;
        }
        setCoverFileError(null);
        setValue("coverImage", file, {
          shouldDirty: true,
          shouldValidate: true,
        });
      },
      [setValue],
    );

    // ── Visibility ───────────────────────────────────────────────────────────
    const handleVisibilitySelect = useCallback(
      (id: string) => setValue("visibility", id as any, { shouldDirty: true }),
      [setValue],
    );
    const currentVisibility = watch("visibility");

    // ── FIX 1+2: scroll lock with scrollbar compensation ────────────────────
    useEffect(() => {
      if (!isOpen) return;
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${scrollbarWidth}px`;
      return () => {
        document.body.style.overflow = "";
        document.body.style.paddingRight = "";
      };
    }, [isOpen]);

    // ── Escape key handler ───────────────────────────────────────────────────
    useEffect(() => {
      if (!isOpen) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape" && !isWorking) onClose();
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }, [isOpen, isWorking, onClose]);

    // ── FIX 5: SSR guard ─────────────────────────────────────────────────────
    if (typeof document === "undefined") return null;

    return createPortal(
      // FIX 3: AnimatePresence for exit animation
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <motion.div
              key="playlist-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Content — FIX 4: stopPropagation */}
            <motion.div
              key="playlist-modal-content"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 4 }}
              transition={MODAL_SPRING}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="playlist-modal-title"
              className="relative z-[101] w-full max-w-2xl bg-background border border-border rounded-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
            >
              {/* ══════ HEADER ══════ */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-background shrink-0 z-20">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 rounded-xl text-primary border border-primary/10 shadow-sm">
                    {isEditing ? (
                      <Palette className="size-5" />
                    ) : (
                      <Music2 className="size-5" />
                    )}
                  </div>
                  <div>
                    <h3
                      id="playlist-modal-title"
                      className="text-lg font-bold leading-none text-foreground uppercase tracking-tight"
                    >
                      {isEditing ? "Cập Nhật Playlist" : "Tạo Playlist Mới"}
                    </h3>
                    <p className="text-[13px] font-medium text-muted-foreground mt-1">
                      {isEditing
                        ? "Chỉnh sửa thông tin chi tiết của danh sách phát."
                        : "Thêm một danh sách phát mới vào hệ thống."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isWorking}
                  aria-label="Đóng modal"
                  className="rounded-md size-8 flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>

              {/* ══════ BODY ══════ */}
              <div className="flex-1 overflow-y-auto custom-scrollbar bg-background p-6 sm:p-8">
                <form
                  id="playlist-form"
                  onSubmit={handleSubmit}
                  noValidate
                  className="space-y-8"
                >
                  {/* ── Section 1: General ── */}
                  <SectionBlock title="Thông tin chung">
                    <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
                      {/* Cover + theme color */}
                      <div className="flex flex-col gap-3 shrink-0">
                        <CoverUpload
                          preview={coverPreview}
                          hasError={Boolean(errors.coverImage)}
                          fileError={coverFileError}
                          onFileChange={handleCoverChange}
                        />

                        {/* Theme color — mirrors GenreModal color row style */}
                        <div
                          className={cn(
                            "flex items-center justify-between p-1.5 border rounded-md bg-transparent transition-colors",
                            errors.themeColor
                              ? "border-destructive ring-1 ring-destructive/20"
                              : "border-input",
                          )}
                        >
                          <div className="flex items-center gap-2 pl-1">
                            <Palette className="size-3.5 text-muted-foreground" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                              Màu chủ đạo
                            </span>
                          </div>
                          <div className="relative size-8 rounded overflow-hidden border border-border shadow-inner shrink-0 group hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer">
                            <input
                              type="color"
                              {...register("themeColor")}
                              aria-label="Chọn màu chủ đạo"
                              className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] cursor-pointer p-0 m-0"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Text inputs */}
                      <div className="flex-1 w-full space-y-5">
                        {/* Title */}
                        <div className="space-y-2">
                          <Label htmlFor="pl-title" className={LABEL_CLASS}>
                            <Type className="size-3.5" />
                            Tên Playlist{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <div className="relative">
                            <Input
                              id="pl-title"
                              {...register("title")}
                              placeholder="VD: Lofi Chill Vibes 2025..."
                              autoComplete="off"
                              className={cn(
                                "h-11 bg-transparent border-input rounded-md text-[15px] font-semibold focus-visible:ring-1 focus-visible:ring-primary transition-all",
                                errors.title &&
                                "border-destructive focus-visible:ring-destructive pr-10",
                              )}
                            />
                            {errors.title && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive">
                                <AlertCircle className="size-4" />
                              </div>
                            )}
                          </div>
                          {errors.title && (
                            <p className="text-[12px] font-medium text-destructive mt-1 flex items-center gap-1.5 animate-in slide-in-from-top-1">
                              {errors.title.message as string}
                            </p>
                          )}
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                          <Label
                            htmlFor="pl-description"
                            className={LABEL_CLASS}
                          >
                            <AlignLeft className="size-3.5" />
                            Mô tả ngắn
                          </Label>
                          <Textarea
                            id="pl-description"
                            {...register("description")}
                            rows={3}
                            placeholder="Giới thiệu đôi nét về danh sách phát này..."
                            className={cn(
                              "resize-none custom-scrollbar bg-transparent border-input text-sm focus-visible:ring-1 focus-visible:ring-primary",
                              errors.description &&
                              "border-destructive focus-visible:ring-destructive",
                            )}
                          />
                          {errors.description && (
                            <p className="text-[12px] font-medium text-destructive mt-1 flex items-center gap-1.5 animate-in slide-in-from-top-1">
                              <AlertCircle className="size-3.5" />{" "}
                              {errors.description.message as string}
                            </p>
                          )}
                        </div>

                        {/* Publish At */}
                        <div className="space-y-2">
                          <Label htmlFor="pl-publishAt" className={LABEL_CLASS}>
                            <Calendar className="size-3.5" /> Ngày công bố
                          </Label>
                          <Input
                            id="pl-publishAt"
                            type="datetime-local"
                            {...register("publishAt")}
                            className={cn(
                              "h-10 bg-transparent border-input rounded-md text-sm",
                              errors.publishAt &&
                              "border-destructive focus-visible:ring-destructive",
                            )}
                          />
                          {errors.publishAt && (
                            <p className="text-[12px] font-medium text-destructive mt-1 flex items-center gap-1.5">
                              <AlertCircle className="size-3.5" />{" "}
                              {errors.publishAt.message as string}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </SectionBlock>

                  {/* Admin-only fields */}
                  {isAdmin && (
                    <>
                      <hr className="border-border border-dashed" />
                      <SectionBlock title="Quản trị">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label className={LABEL_CLASS}>Chủ sở hữu</Label>
                            <Controller
                              name="userId"
                              control={control}
                              render={({ field }) => (
                                <div>
                                  <UserSelector
                                    singleSelect
                                    value={field.value as any}
                                    onChange={(val) => {
                                      field.onChange(val as any);
                                      setValue("userId", val as any, {
                                        shouldDirty: true,
                                        shouldValidate: true,
                                      });
                                    }}
                                    initialUsers={playlistToEdit?.user as any}
                                  />
                                  {errors.userId && (
                                    <p className="text-[12px] text-destructive mt-1">
                                      {errors.userId?.message as string}
                                    </p>
                                  )}
                                </div>
                              )}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className={LABEL_CLASS}>Hệ thống</Label>
                            <div className="flex items-center gap-3">
                              <Controller
                                name="isSystem"
                                control={control}
                                render={({ field }) => (
                                  <Switch
                                    checked={!!field.value}
                                    onCheckedChange={(v) => {
                                      const val = Boolean(v);
                                      field.onChange(val as any);
                                      setValue("isSystem", val as any, {
                                        shouldDirty: true,
                                        shouldValidate: true,
                                      });
                                    }}
                                  />
                                )}
                              />
                              <span className="text-sm text-muted-foreground">
                                Đánh dấu là hệ thống (không thể xóa)
                              </span>
                            </div>
                          </div>
                        </div>
                      </SectionBlock>
                    </>
                  )}

                  <hr className="border-border border-dashed" />

                  {/* ── Section 2: Tags & Collaborators ── */}
                  <SectionBlock title="Phân loại & Hợp tác">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Type Select */}
                      <div className="space-y-2">
                        <Label className={LABEL_CLASS}>
                          <Type className="size-3.5" /> Loại
                        </Label>
                        <Controller
                          name="type"
                          control={control}
                          render={({ field }) => (
                            <div>
                              <Select
                                value={field.value}
                                onValueChange={(v: PlaylistType) => {
                                  field.onChange(v);
                                  setValue("type", v, { shouldDirty: true });
                                }}
                              >
                                <SelectTrigger className="h-9 w-full bg-background/80 text-sm rounded-lg border-border/60 focus:ring-1 focus:ring-primary/30">
                                  <SelectValue placeholder="Chọn loại" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PLAYLIST_TYPES.map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {t}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {errors.type && (
                                <p className="text-[12px] text-destructive mt-1">
                                  {errors.type?.message as string}
                                </p>
                              )}
                            </div>
                          )}
                        />
                      </div>
                      {/* Tags */}
                      <div className="space-y-2">
                        <Label className={LABEL_CLASS}>
                          <Tags className="size-3.5" /> Thẻ Tags (Keywords)
                        </Label>
                        <Controller
                          name="tags"
                          control={control}
                          render={({ field }) => (
                            <div
                              className={cn(
                                "rounded-md border bg-transparent overflow-hidden transition-all",
                                "focus-within:ring-1 focus-within:ring-primary focus-within:border-primary",
                                errors.tags
                                  ? "border-destructive focus-within:ring-destructive"
                                  : "border-input",
                              )}
                            >
                              <TagInput
                                value={field.value || []}
                                onChange={(val) => {
                                  field.onChange(val);
                                  setValue("tags", val, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                  });
                                }}
                                placeholder="Nhập tag & Enter..."
                                className="border-none shadow-none min-h-[44px] bg-transparent"
                              />
                            </div>
                          )}
                        />
                        {errors.tags?.message &&
                          typeof errors.tags.message === "string" && (
                            <p className="text-[12px] font-medium text-destructive mt-1 flex items-center gap-1.5">
                              <AlertCircle className="size-3.5" />{" "}
                              {errors.tags.message}
                            </p>
                          )}
                      </div>

                      {/* Collaborators */}
                      <div className="space-y-2">
                        <Label className={LABEL_CLASS}>
                          <Users className="size-3.5" /> Người cộng tác
                        </Label>
                        <Controller
                          name="collaborators"
                          control={control}
                          render={({ field }) => (
                            <div
                              className={cn(
                                "rounded-md border border-input bg-transparent overflow-hidden transition-all",
                                "focus-within:ring-1 focus-within:ring-primary focus-within:border-primary",
                                errors.collaborators &&
                                "border-destructive ring-1 ring-destructive/20",
                              )}
                            >
                              <UserSelector
                                singleSelect={false}
                                value={field.value}
                                onChange={(val) => {
                                  field.onChange(val);
                                  setValue("collaborators", val, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                  });
                                }}
                                initialUsers={playlistToEdit?.collaborators}
                                className="border-none shadow-none bg-transparent"
                              />
                            </div>
                          )}
                        />
                      </div>
                    </div>
                  </SectionBlock>

                  <hr className="border-border border-dashed" />

                  {/* ── Section 3: Visibility ──
                   * <button role="radio"> pattern from GenreModal trending FIX 8:
                   * keyboard nav (Tab + Space/Enter) + aria-checked for AT.
                   */}
                  <SectionBlock title="Trạng thái hiển thị">
                    <div
                      role="radiogroup"
                      aria-label="Chọn trạng thái hiển thị"
                      className="grid grid-cols-1 sm:grid-cols-3 gap-4"
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

              {/* ══════ FOOTER ══════ */}
              <div className="flex items-center justify-between p-5 border-t border-border bg-background shrink-0 z-20">
                <p className="text-[11px] text-muted-foreground font-medium hidden sm:block">
                  Các trường có{" "}
                  <span className="text-destructive font-bold text-sm">*</span>{" "}
                  là bắt buộc.
                </p>
                <div className="flex gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isWorking}
                    className={cn(
                      "font-bold border border-input bg-background",
                      "hover:bg-accent hover:text-foreground",
                      "h-10 px-5 rounded-md flex-1 sm:flex-none text-sm",
                      "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    form="playlist-form"
                    disabled={isWorking}
                    className={cn(
                      "font-bold h-10 px-6 rounded-md flex-1 sm:flex-none",
                      "inline-flex items-center justify-center gap-2 text-sm",
                      "bg-primary text-primary-foreground",
                      "shadow-md hover:shadow-lg hover:brightness-110 active:scale-[0.98]",
                      "transition-all duration-150",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
                    )}
                  >
                    {isWorking ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Đang lưu...
                      </>
                    ) : (
                      <>
                        <Save className="size-4" />
                        {isEditing ? "Lưu thay đổi" : "Tạo Playlist"}
                      </>
                    )}
                  </button>
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

PlaylistModal.displayName = "PlaylistModal";
export default PlaylistModal;
