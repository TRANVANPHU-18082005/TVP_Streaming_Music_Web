import React, { useState, useEffect } from "react";
import { type UseFormReturn } from "react-hook-form";
import { Camera, ImageIcon, Trash2, User, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";
import { ArtistFormValues } from "../../schemas/artist.schema";

interface ImageSectionProps {
  form: UseFormReturn<ArtistFormValues>;
  initialData?: ArtistFormValues | null; // Cập nhật kiểu cho chuẩn
}

const ImageSection: React.FC<ImageSectionProps> = ({ form, initialData }) => {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    typeof initialData?.avatar === "string" ? initialData.avatar : null,
  );
  const [coverPreview, setCoverPreview] = useState<string | null>(
    typeof initialData?.coverImage === "string" ? initialData.coverImage : null,
  );

  // Lấy errors + watch để cập nhật preview khi form thay đổi
  const {
    formState: { errors },
    watch,
  } = form;

  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  const avatarValue = watch("avatar");
  const coverValue = watch("coverImage");

  // Sync previews with form values (supports default string URLs and File objects)
  useEffect(() => {
    if (avatarValue instanceof File) {
      const url = URL.createObjectURL(avatarValue);
      setAvatarPreview(url);
      return () => URL.revokeObjectURL(url);
    } else if (typeof avatarValue === "string" && avatarValue.length > 0) {
      setAvatarPreview(avatarValue);
    } else {
      setAvatarPreview(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarValue]);

  useEffect(() => {
    if (coverValue instanceof File) {
      const url = URL.createObjectURL(coverValue);
      setCoverPreview(url);
      return () => URL.revokeObjectURL(url);
    } else if (typeof coverValue === "string" && coverValue.length > 0) {
      setCoverPreview(coverValue);
    } else {
      setCoverPreview(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverValue]);

  const handleFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "avatar" | "coverImage",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Nếu quá nặng thì báo toast nhẹ (Zod vẫn sẽ chặn lại bên dưới)
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File size must be under 5MB");
      // Cố tình đẩy file vào form để Zod bắn lỗi màu đỏ ra giao diện
    }

    // 🔥 FIX 2: Thêm shouldValidate: true
    form.setValue(field, file, { shouldDirty: true, shouldValidate: true });

    // Tạo preview URL
    const url = URL.createObjectURL(file);
    if (field === "avatar") setAvatarPreview(url);
    else setCoverPreview(url);
  };

  const handleRemove = (
    e: React.MouseEvent,
    field: "avatar" | "coverImage",
  ) => {
    e.preventDefault();
    // 🔥 FIX 2: Thêm shouldValidate: true
    form.setValue(field, null, { shouldDirty: true, shouldValidate: true });
    if (field === "avatar") setAvatarPreview(null);
    else setCoverPreview(null);
  };

  return (
    <div className="relative mb-20 flex flex-col">
      {/* --- COVER IMAGE --- */}
      <div
        className={cn(
          "group relative w-full h-48 md:h-56 bg-secondary/20 border-b border-border overflow-hidden flex items-center justify-center",
          // 🔥 Đổi viền đỏ nếu có lỗi
          errors.coverImage && "border-b-destructive bg-destructive/5",
        )}
      >
        {coverPreview ? (
          <>
            <img
              src={coverPreview}
              className={cn(
                "w-full h-full object-cover transition-transform duration-700 group-hover:scale-105",
                // Mờ ảnh nếu lỗi
                errors.coverImage && "opacity-50",
              )}
              alt="cover"
            />
            {/* Dark Overlay on Hover */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3 backdrop-blur-[2px]">
              <Button
                variant="secondary"
                size="sm"
                className="relative cursor-pointer font-semibold shadow-md"
              >
                <Camera className="w-4 h-4 mr-2" /> Change Cover
                <input
                  type="file"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  accept="image/jpeg, image/png, image/webp"
                  onChange={(e) => handleFile(e, "coverImage")}
                />
              </Button>
              <Button
                variant="destructive"
                size="icon"
                className="shadow-md"
                onClick={(e) => handleRemove(e, "coverImage")}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-full border-dashed hover:bg-muted/50 transition-all cursor-pointer">
            <div className="p-3 rounded-lg bg-background border shadow-sm mb-2 text-muted-foreground group-hover:text-primary transition-colors">
              <ImageIcon className="w-6 h-6" />
            </div>
            <span className="text-[13px] font-bold text-foreground">
              Upload Cover Image
            </span>
            <span className="text-[10px] text-muted-foreground mt-1">
              Recommended: 1920x600 px
            </span>
            <input
              type="file"
              className="hidden"
              accept="image/jpeg, image/png, image/webp"
              onChange={(e) => handleFile(e, "coverImage")}
            />
          </label>
        )}

        {/* 🔥 Hiển thị lỗi Zod cho Cover */}
        {errors.coverImage && (
          <div className="absolute bottom-2 right-2 bg-destructive/90 backdrop-blur px-3 py-1.5 rounded-md text-[12px] text-destructive-foreground font-bold flex items-center gap-1.5 shadow-lg">
            <AlertCircle className="size-4" />{" "}
            {errors.coverImage.message as string}
          </div>
        )}

        {/* Theme Color Picker */}
        <div className="absolute bottom-4 right-2 md:right-[40px] flex items-center gap-2 bg-background p-1.5 pr-3 rounded-full border border-border shadow-lg z-20 hover:scale-105 transition-transform">
          <div className="relative size-7 rounded-full overflow-hidden border border-border shadow-sm">
            <input
              type="color"
              {...form.register("themeColor")}
              className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] cursor-pointer p-0 m-0"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase leading-none text-foreground">
              Theme
            </span>
            <span className="text-[9px] text-muted-foreground leading-none">
              Color
            </span>
          </div>
        </div>
      </div>

      {/* --- AVATAR IMAGE --- */}
      <div className="absolute -bottom-16 left-6 z-10 flex flex-col items-center">
        <div
          className={cn(
            "group/avatar relative size-32 rounded-full border-4 border-card bg-muted shadow-md overflow-hidden",
            // 🔥 Đổi viền đỏ nếu lỗi
            errors.avatar && "border-destructive ring-2 ring-destructive/50",
          )}
        >
          {avatarPreview ? (
            <>
              <img
                src={avatarPreview}
                className={cn(
                  "w-full h-full object-cover",
                  // Mờ ảnh nếu lỗi
                  errors.avatar && "opacity-50",
                )}
                alt="avatar"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/avatar:opacity-100 transition-all flex items-center justify-center gap-2 backdrop-blur-[1px]">
                <label className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors cursor-pointer text-white">
                  <Camera className="w-4 h-4" />
                  <input
                    type="file"
                    className="hidden"
                    accept="image/jpeg, image/png, image/webp"
                    onChange={(e) => handleFile(e, "avatar")}
                  />
                </label>
                <button
                  type="button"
                  onClick={(e) => handleRemove(e, "avatar")}
                  className="p-2 bg-destructive/80 rounded-full hover:bg-destructive text-white transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-muted/80 transition-colors">
              <User className="w-8 h-8 text-muted-foreground mb-1" />
              <span className="text-[10px] font-bold uppercase text-muted-foreground">
                Avatar
              </span>
              <input
                type="file"
                className="hidden"
                accept="image/jpeg, image/png, image/webp"
                onChange={(e) => handleFile(e, "avatar")}
              />
            </label>
          )}
        </div>

        {/* 🔥 Hiển thị lỗi Zod cho Avatar */}
        {errors.avatar && (
          <div className="mt-2 text-[11px] text-destructive font-bold flex items-center gap-1 whitespace-nowrap bg-destructive/10 px-2 py-1 rounded-md border border-destructive/20">
            <AlertCircle className="size-3" /> {errors.avatar.message as string}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageSection;
