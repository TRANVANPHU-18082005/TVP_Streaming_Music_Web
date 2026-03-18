import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Controller } from "react-hook-form";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type Playlist } from "../types";
import { usePlaylistForm } from "../hooks/usePlaylistForm";
import { TagInput } from "@/components/ui/tag-input";
import { UserSelector } from "@/features/user/components/UserSelector";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlistToEdit?: Playlist | null;
  onSubmit: (data: FormData) => Promise<void>;
  isPending: boolean;
}

const PlaylistModal: React.FC<PlaylistModalProps> = ({
  isOpen,
  onClose,
  playlistToEdit,
  onSubmit,
  isPending,
}) => {
  const {
    form,
    handleSubmit,
    isSubmitting: isFormSubmitting,
  } = usePlaylistForm({
    playlistToEdit,
    onSubmit,
  });

  const {
    register,
    control,
    formState: { errors },
    setValue,
    watch,
  } = form;

  // --- LOGIC UI: Xử lý Preview ảnh ---
  const [preview, setPreview] = useState<string | null>(null);
  const coverValue = watch("coverImage");
  // const themeColor = watch("themeColor");

  useEffect(() => {
    if (coverValue instanceof File) {
      const url = URL.createObjectURL(coverValue);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    } else if (typeof coverValue === "string" && coverValue.length > 0) {
      setPreview(coverValue);
    } else {
      setPreview(null);
    }
  }, [coverValue]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setValue("coverImage", file, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    },
    [setValue],
  );

  // Lock scroll khi mở Modal
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isWorking = isPending || isFormSubmitting;

  const labelClass =
    "text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5 w-fit";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
        onClick={!isWorking ? onClose : undefined}
      />

      {/* Modal Container: Bento Box Style */}
      <div className="relative z-[101] w-full max-w-3xl bg-background border border-border/40 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden rounded-[24px] animate-in zoom-in-95 duration-200">
        {/* HEADER */}
        <div className="shrink-0 px-6 sm:px-8 py-5 border-b border-border/40 flex justify-between items-center bg-background/95 backdrop-blur-xl z-20">
          <div className="flex items-center gap-4">
            <div className="size-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 text-primary shadow-sm shrink-0">
              <ImageIcon className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-sm",
                    playlistToEdit
                      ? "bg-amber-500/10 text-amber-500"
                      : "bg-emerald-500/10 text-emerald-500",
                  )}
                >
                  {playlistToEdit ? "Edit Mode" : "New"}
                </span>
              </div>
              <h3 className="font-bold text-xl text-foreground tracking-tight leading-none">
                {playlistToEdit ? "Cập Nhật Playlist" : "Tạo Playlist Mới"}
              </h3>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isWorking}
            className="rounded-full size-10 bg-muted/40 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 bg-muted/10">
          <form
            id="playlist-form"
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            {/* ===== KHỐI 1: ẢNH VÀ THÔNG TIN CƠ BẢN ===== */}
            <div className="bg-card border border-border/50 rounded-[20px] p-5 sm:p-6 shadow-sm">
              <h4 className="text-[12px] font-bold uppercase tracking-widest text-foreground mb-6 flex items-center gap-2">
                <span className="w-1.5 h-4 rounded-full bg-primary" />
                Thông tin chung
              </h4>

              <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
                {/* --- COVER IMAGE --- */}
                <div className="flex flex-col gap-3 shrink-0">
                  <div
                    className={cn(
                      "relative group size-36 sm:size-44 rounded-2xl border-2 border-dashed overflow-hidden flex items-center justify-center cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md",
                      errors.coverImage
                        ? "border-destructive/60 bg-destructive/5"
                        : "border-border/60 bg-background hover:border-primary/50",
                    )}
                  >
                    {preview ? (
                      <>
                        <img
                          src={preview}
                          alt="Cover"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-sm">
                          <div className="bg-background/20 text-white rounded-full p-3 backdrop-blur-md">
                            <Camera className="size-6" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted-foreground/60 transition-colors group-hover:text-primary">
                        <div className="p-3 rounded-full bg-muted/50 mb-2 border border-border/50 shadow-inner group-hover:bg-primary/10 group-hover:border-primary/30 transition-all">
                          <ImageIcon className="size-6" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wide">
                          Tải ảnh lên
                        </span>
                      </div>
                    )}

                    <input
                      type="file"
                      accept="image/jpeg, image/png, image/webp"
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      onChange={handleFileChange}
                    />

                    {/* Lỗi Upload */}
                    {errors.coverImage && (
                      <div className="absolute bottom-2 right-2 bg-destructive/95 backdrop-blur shadow-lg px-2 py-1 rounded text-[10px] text-white font-bold flex items-center gap-1.5 z-20 animate-in zoom-in">
                        <AlertCircle className="size-3" /> Lỗi ảnh
                      </div>
                    )}
                  </div>

                  {/* Theme Color Picker - Style Badge */}
                  <div className="flex items-center justify-between bg-background border border-border/60 rounded-[14px] p-2 px-3 shadow-sm hover:border-primary/40 transition-colors group">
                    <div className="flex items-center gap-2">
                      <Palette className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground">
                        Màu chủ đạo
                      </span>
                    </div>
                    <div className="relative size-6 rounded-full overflow-hidden border border-border shadow-inner ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                      <input
                        type="color"
                        {...register("themeColor")}
                        className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] cursor-pointer p-0 m-0"
                      />
                    </div>
                  </div>
                </div>

                {/* --- BASIC INFO INPUTS --- */}
                <div className="flex-1 w-full space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="title" className={labelClass}>
                      <Type className="size-3.5" /> Tên Playlist{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="title"
                        {...register("title")}
                        placeholder="VD: Lofi Chill Vibes 2024..."
                        className={cn(
                          "h-12 bg-background border-border/60 rounded-xl text-[15px] font-semibold shadow-sm focus-visible:ring-1 focus-visible:ring-primary transition-all",
                          errors.title &&
                            "border-destructive focus-visible:ring-destructive pr-10 bg-destructive/5",
                        )}
                      />
                      {errors.title && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive">
                          <AlertCircle className="size-5" />
                        </div>
                      )}
                    </div>
                    {errors.title && (
                      <p className="text-[12px] font-semibold text-destructive flex items-center gap-1.5 animate-in slide-in-from-top-1">
                        {errors.title.message as string}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="description" className={labelClass}>
                      <AlignLeft className="size-3.5" /> Mô tả (Tùy chọn)
                    </Label>
                    <Textarea
                      id="description"
                      {...register("description")}
                      rows={4}
                      placeholder="Giới thiệu đôi nét về danh sách phát này..."
                      className={cn(
                        "resize-none bg-background border-border/60 rounded-xl text-sm font-medium shadow-sm focus-visible:ring-1 focus-visible:ring-primary transition-all",
                        errors.description &&
                          "border-destructive focus-visible:ring-destructive bg-destructive/5",
                      )}
                    />
                    {errors.description && (
                      <p className="text-[12px] font-semibold text-destructive flex items-center gap-1.5 animate-in slide-in-from-top-1">
                        <AlertCircle className="size-3.5" />{" "}
                        {errors.description.message as string}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ===== KHỐI 2: METADATA (Tags & Collaborators) ===== */}
            <div className="bg-card border border-border/50 rounded-[20px] p-5 sm:p-6 shadow-sm">
              <h4 className="text-[12px] font-bold uppercase tracking-widest text-foreground mb-6 flex items-center gap-2">
                <span className="w-1.5 h-4 rounded-full bg-primary" />
                Phân loại & Hợp tác
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                {/* Tags */}
                <div className="space-y-2">
                  <Label className={labelClass}>
                    <Tags className="size-3.5" /> Thẻ Tags (Keywords)
                  </Label>
                  <Controller
                    name="tags"
                    control={control}
                    render={({ field }) => (
                      <div
                        className={cn(
                          "rounded-xl border border-border/60 bg-background shadow-sm overflow-hidden transition-all focus-within:ring-1 focus-within:ring-primary",
                          errors.tags &&
                            "border-destructive focus-within:ring-destructive bg-destructive/5",
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
                          className="border-none shadow-none min-h-[46px] bg-transparent"
                        />
                      </div>
                    )}
                  />
                  {errors.tags?.message &&
                    typeof errors.tags.message === "string" && (
                      <p className="text-[12px] font-semibold text-destructive flex items-center gap-1.5 animate-in slide-in-from-top-1">
                        <AlertCircle className="size-3.5" />{" "}
                        {errors.tags.message}
                      </p>
                    )}
                </div>

                {/* Collaborators */}
                <div className="space-y-2">
                  <Label className={labelClass}>
                    <Users className="size-3.5" /> Người cộng tác
                  </Label>
                  <Controller
                    name="collaborators"
                    control={control}
                    render={({ field }) => (
                      <div
                        className={cn(
                          "rounded-xl shadow-sm overflow-hidden border border-border/60 bg-background transition-all",
                          errors.collaborators &&
                            "border-destructive ring-1 ring-destructive",
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
            </div>

            {/* ===== KHỐI 3: VISIBILITY (Settings) ===== */}
            <div className="bg-card border border-border/50 rounded-[20px] p-5 sm:p-6 shadow-sm">
              <h4 className="text-[12px] font-bold uppercase tracking-widest text-foreground mb-5 flex items-center gap-2">
                <span className="w-1.5 h-4 rounded-full bg-primary" />
                Trạng thái hiển thị
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    id: "public",
                    label: "Công khai",
                    desc: "Ai cũng có thể tìm thấy",
                    icon: Globe,
                    activeColor: "text-emerald-500",
                    activeRing:
                      "ring-emerald-500/20 border-emerald-500/50 bg-emerald-500/5",
                  },
                  {
                    id: "private",
                    label: "Riêng tư",
                    desc: "Chỉ mình bạn xem được",
                    icon: Lock,
                    activeColor: "text-rose-500",
                    activeRing:
                      "ring-rose-500/20 border-rose-500/50 bg-rose-500/5",
                  },
                  {
                    id: "unlisted",
                    label: "Bảo mật Link",
                    desc: "Chỉ ai có link mới xem được",
                    icon: LinkIcon,
                    activeColor: "text-blue-500",
                    activeRing:
                      "ring-blue-500/20 border-blue-500/50 bg-blue-500/5",
                  },
                ].map((item) => {
                  const isSelected = watch("visibility") === item.id;
                  return (
                    <Label
                      key={item.id}
                      onClick={() =>
                        setValue("visibility", item.id as any, {
                          shouldDirty: true,
                        })
                      }
                      className={cn(
                        "relative p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer flex flex-col gap-3 select-none group",
                        isSelected
                          ? cn("shadow-md ring-4", item.activeRing)
                          : "border-border/50 bg-background hover:border-border hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div
                          className={cn(
                            "p-2.5 rounded-lg transition-colors",
                            isSelected
                              ? "bg-background shadow-sm"
                              : "bg-muted text-muted-foreground group-hover:text-foreground",
                          )}
                        >
                          <item.icon
                            className={cn(
                              "size-4.5",
                              isSelected ? item.activeColor : "",
                            )}
                          />
                        </div>
                        <div
                          className={cn(
                            "size-5 rounded-full border-2 flex items-center justify-center transition-all",
                            isSelected
                              ? cn(
                                  "scale-110 border-transparent",
                                  item.activeColor.replace("text", "bg"),
                                )
                              : "border-muted-foreground/30 group-hover:border-primary/40",
                          )}
                        >
                          {isSelected && (
                            <CheckCircle2 className="size-3.5 text-white" />
                          )}
                        </div>
                      </div>
                      <div>
                        <span
                          className={cn(
                            "text-[14px] font-bold block transition-colors",
                            isSelected
                              ? "text-foreground"
                              : "text-muted-foreground group-hover:text-foreground",
                          )}
                        >
                          {item.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-medium mt-0.5 block leading-tight">
                          {item.desc}
                        </span>
                      </div>
                    </Label>
                  );
                })}
              </div>
            </div>
          </form>
        </div>

        {/* FOOTER */}
        <div className="shrink-0 px-6 sm:px-8 py-5 border-t border-border/50 bg-background/95 backdrop-blur-xl flex justify-between items-center z-20">
          <p className="text-[11px] text-muted-foreground font-medium hidden sm:block">
            Các trường có{" "}
            <span className="text-destructive font-bold text-sm">*</span> là bắt
            buộc.
          </p>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isWorking}
              className="font-bold text-muted-foreground hover:text-foreground hover:bg-muted flex-1 sm:flex-none h-11 px-6 rounded-xl"
            >
              Hủy
            </Button>
            <Button
              form="playlist-form"
              type="submit"
              disabled={isWorking}
              className="font-bold flex-1 sm:flex-none shadow-xl hover:shadow-primary/20 hover:scale-105 active:scale-95 transition-all h-11 px-8 rounded-xl"
            >
              {isWorking ? (
                <>
                  <Loader2 className="size-5 animate-spin mr-2" /> Đang xử lý...
                </>
              ) : (
                <>
                  <Save className="size-5 mr-2" />{" "}
                  {playlistToEdit ? "Lưu thay đổi" : "Tạo Playlist"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default PlaylistModal;
