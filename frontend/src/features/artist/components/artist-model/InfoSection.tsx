import React, { lazy, Suspense } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { cn } from "@/lib/utils";
import { UserSelector } from "@/features/user/components/UserSelector";
import { TagInput } from "@/components/ui/tag-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle } from "lucide-react";
const NationalitySelector = lazy(() =>
  import("@/components/ui/NationalitySelector").then((m) => ({
    default: m.NationalitySelector,
  })),
);
import { WaveformBars } from "@/components/MusicVisualizer";
import { ArtistEditFormValues } from "../../schemas/artist.schema";
import { IArtist } from "../../types";

interface InfoSectionProps {
  form: UseFormReturn<ArtistEditFormValues>;
  artistToEdit?: IArtist | null;
}

const InfoSection: React.FC<InfoSectionProps> = ({ form, artistToEdit }) => {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form;

  const labelClass =
    "text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block";

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-[13px] font-bold uppercase tracking-widest text-foreground">
          Hồ sơ Nghệ sĩ
        </h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ==================== 1. TÊN NGHỆ SĨ ==================== */}
        <div>
          <Label htmlFor="name" className={labelClass}>
            Tên Nghệ sĩ <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            {...register("name")}
            placeholder="VD: Sơn Tùng M-TP"
            className={cn(
              "h-11 bg-transparent border-input rounded-md text-base font-medium",
              errors.name &&
                "border-destructive focus-visible:ring-destructive",
            )}
          />
          {errors.name && (
            <p className="text-[12px] font-medium text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="size-3.5" /> {errors.name.message}
            </p>
          )}
        </div>

        {/* ==================== 2. QUỐC TỊCH ==================== */}
        <div className="flex flex-col space-y-2">
          <Label htmlFor="nationality" className={labelClass}>
            Quốc tịch
          </Label>
          <Controller
            name="nationality"
            control={control}
            // 🔥 LỖI Ở ĐÂY: Đã xóa defaultValue="VN".
            // Form Edit sẽ tự đổ "US" vào đây, Form Create sẽ tự lấy "VN" từ artist.schema.ts
            render={({ field }) => (
              <Suspense fallback={<WaveformBars active />}>
                <NationalitySelector
                  value={field.value}
                  onChange={(val) => {
                    field.onChange(val);
                    setValue("nationality", val, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                  className={cn(
                    "w-full",
                    errors.nationality &&
                      "border-destructive bg-destructive/5 ring-1 ring-destructive/20",
                  )}
                />
              </Suspense>
            )}
          />
          {errors.nationality && (
            <p className="text-[12px] font-medium text-destructive flex items-center gap-1.5 animate-in slide-in-from-top-1">
              <AlertCircle className="size-3.5" />
              {errors.nationality.message}
            </p>
          )}
        </div>

        {/* ==================== 3. TÊN GỌI KHÁC (ALIASES) ==================== */}
        <div>
          <Label className={labelClass}>Tên gọi khác (Aliases)</Label>
          <Controller
            name="aliases"
            control={control}
            render={({ field }) => (
              <div
                className={cn(
                  "rounded-md border border-input bg-transparent focus-within:ring-1 focus-within:ring-primary",
                  errors.aliases &&
                    "border-destructive focus-within:ring-destructive",
                )}
              >
                <TagInput
                  value={field.value || []}
                  onChange={(val) => {
                    field.onChange(val);
                    setValue("aliases", val, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                  placeholder="Nhập tên & Enter..."
                  className="border-none shadow-none"
                />
              </div>
            )}
          />
          {errors.aliases?.message &&
            typeof errors.aliases.message === "string" && (
              <p className="text-[12px] font-medium text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="size-3.5" /> {errors.aliases.message}
              </p>
            )}
        </div>

        {/* ==================== 4. USER LIÊN KẾT ==================== */}
        <div>
          <Label className={labelClass}>Liên kết Tài khoản User</Label>
          <Controller
            name="userId"
            control={control}
            render={({ field, fieldState }) => (
              <UserSelector
                value={field.value || undefined}
                onChange={(val) => {
                  field.onChange(val);
                  setValue("userId", val, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
                singleSelect
                error={fieldState.error?.message}
                initialUsers={artistToEdit?.user ? [artistToEdit.user] : []}
              />
            )}
          />
        </div>
      </div>

      {/* ==================== 6. TIỂU SỬ (BIO) ==================== */}
      <div>
        <Label htmlFor="bio" className={labelClass}>
          Tiểu sử (Bio)
        </Label>
        <Textarea
          id="bio"
          {...register("bio")}
          rows={4}
          className={cn(
            "resize-none bg-transparent rounded-md border-input text-sm",
            errors.bio && "border-destructive focus-visible:ring-destructive",
          )}
          placeholder="Giới thiệu về hành trình âm nhạc của nghệ sĩ..."
        />
        {errors.bio && (
          <p className="text-[12px] font-medium text-destructive mt-1 flex items-center gap-1">
            <AlertCircle className="size-3.5" /> {errors.bio.message}
          </p>
        )}
      </div>
    </div>
  );
};

export default InfoSection;
