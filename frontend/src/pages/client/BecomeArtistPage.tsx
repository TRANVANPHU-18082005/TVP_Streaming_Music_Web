import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Upload,
  AlertCircle,
  Loader2,
  Check,
  X,
  FileImage,
  User,
  Mail,
  Globe,
  Sparkles,
} from "lucide-react";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Schema & Hook
import { useVerification } from "@/features/verification/hooks/useVerification";
import {
  BecomeArtistFormValues,
  becomeArtistSchema,
} from "@/features/verification/schemas/verification.schema";

export const BecomeArtistPage = () => {
  const { submitRequest, isSubmitting } = useVerification();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<BecomeArtistFormValues>({
    resolver: zodResolver(becomeArtistSchema) as any,
    defaultValues: {
      artistName: "",
      realName: "",
      emailWork: "",
      socialLink: "",
    },
  });

  const frontImageFile = watch("frontImage");
  const backImageFile = watch("backImage");

  const onSubmit = (data: BecomeArtistFormValues) => {
    const formData = new FormData();
    formData.append("artistName", data.artistName);
    formData.append("realName", data.realName);
    formData.append("emailWork", data.emailWork);
    formData.append("socialLinks[]", data.socialLink);
    formData.append("idCardImages", data.frontImage);
    formData.append("idCardImages", data.backImage);
    submitRequest(formData);
  };

  // Helper render vùng upload
  const renderUploadArea = (
    name: "frontImage" | "backImage",
    label: string,
    file: File | undefined,
  ) => (
    <div className="space-y-3">
      <Label
        className={cn(
          "text-sm font-bold text-foreground",
          errors[name] && "text-destructive",
        )}
      >
        {label} <span className="text-destructive">*</span>
      </Label>

      <div
        className={cn(
          "relative aspect-video rounded-xl border-2 border-dashed transition-all duration-200 overflow-hidden flex flex-col items-center justify-center bg-muted/10 group cursor-pointer",
          errors[name]
            ? "border-destructive bg-destructive/5"
            : "border-border hover:border-primary hover:bg-primary/5",
          file && "border-solid border-primary/50 bg-background",
        )}
      >
        {file ? (
          <>
            <img
              src={URL.createObjectURL(file)}
              alt="Preview"
              className="absolute inset-0 size-full object-contain p-2"
            />
            {/* Overlay Change */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
              <Upload className="size-8 text-white" />
              <span className="text-white text-xs font-bold uppercase tracking-widest">
                Thay đổi ảnh
              </span>
            </div>
          </>
        ) : (
          <div className="text-center p-6 space-y-3">
            <div
              className={cn(
                "p-3 rounded-full inline-flex shadow-sm transition-colors",
                errors[name]
                  ? "bg-destructive/10 text-destructive"
                  : "bg-background text-muted-foreground group-hover:text-primary group-hover:bg-primary/10",
              )}
            >
              <FileImage className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">
                Click to upload
              </p>
              <p className="text-xs text-muted-foreground font-medium">
                JPG, PNG (Max 5MB)
              </p>
            </div>
          </div>
        )}

        <Controller
          control={control}
          name={name}
          render={({ field: { onChange, value, ...field } }) => (
            <input
              {...field}
              type="file"
              accept="image/png, image/jpeg, image/webp"
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onChange(f);
              }}
            />
          )}
        />
      </div>

      {/* Error Message */}
      {errors[name] && (
        <p className="text-xs font-bold text-destructive flex items-center gap-1.5 animate-in slide-in-from-left-1">
          <AlertCircle className="size-3.5" /> {errors[name]?.message}
        </p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background py-8 md:py-16 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* HEADER */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-2">
            <Sparkles className="size-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
            Become an Artist
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto font-medium leading-relaxed">
            Xác minh danh tính để nhận tích xanh, truy cập trang quản trị Artist
            và phân phối âm nhạc của bạn đến hàng triệu người nghe.
          </p>
        </div>

        {/* MAIN FORM CARD */}
        <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
          {/* Progress / Info Banner (Optional) */}
          <div className="bg-muted/30 border-b border-border p-4 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <ShieldCheckIcon className="size-4" /> Secure Verification Process
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="p-6 md:p-10 space-y-10"
          >
            {/* SECTION 1: ARTIST PROFILE */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b-2 border-primary/10">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-md shadow-primary/20">
                  1
                </span>
                <h3 className="font-bold text-lg text-foreground">
                  Thông tin Artist
                </h3>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2.5">
                  <Label className="text-sm font-bold">
                    Nghệ danh (Stage Name){" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      {...register("artistName")}
                      placeholder="VD: Sơn Tùng M-TP"
                      className={cn(
                        "pl-9 h-11 bg-background font-medium",
                        errors.artistName &&
                          "border-destructive focus-visible:ring-destructive/30",
                      )}
                    />
                  </div>
                  {errors.artistName && (
                    <p className="text-xs font-bold text-destructive">
                      {errors.artistName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2.5">
                  <Label className="text-sm font-bold">
                    Social Link <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      {...register("socialLink")}
                      placeholder="Facebook, Instagram, Spotify..."
                      className={cn(
                        "pl-9 h-11 bg-background font-medium",
                        errors.socialLink &&
                          "border-destructive focus-visible:ring-destructive/30",
                      )}
                    />
                  </div>
                  {errors.socialLink && (
                    <p className="text-xs font-bold text-destructive">
                      {errors.socialLink.message}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* SECTION 2: LEGAL INFO */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b-2 border-primary/10">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-md shadow-primary/20">
                  2
                </span>
                <h3 className="font-bold text-lg text-foreground">
                  Thông tin Pháp lý
                </h3>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2.5">
                  <Label className="text-sm font-bold">
                    Họ và Tên thật <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    {...register("realName")}
                    placeholder="Theo giấy tờ tùy thân (CCCD/Passport)"
                    className={cn(
                      "h-11 bg-background font-medium",
                      errors.realName &&
                        "border-destructive focus-visible:ring-destructive/30",
                    )}
                  />
                  {errors.realName && (
                    <p className="text-xs font-bold text-destructive">
                      {errors.realName.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2.5">
                  <Label className="text-sm font-bold">
                    Email công việc <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      {...register("emailWork")}
                      type="email"
                      placeholder="contact@example.com"
                      className={cn(
                        "pl-9 h-11 bg-background font-medium",
                        errors.emailWork &&
                          "border-destructive focus-visible:ring-destructive/30",
                      )}
                    />
                  </div>
                  {errors.emailWork && (
                    <p className="text-xs font-bold text-destructive">
                      {errors.emailWork.message}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* SECTION 3: KYC */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b-2 border-primary/10">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-md shadow-primary/20">
                  3
                </span>
                <h3 className="font-bold text-lg text-foreground">
                  Xác minh danh tính (KYC)
                </h3>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-amber-700 dark:text-amber-400">
                <AlertCircle className="size-5 shrink-0 mt-0.5" />
                <div className="text-sm font-medium">
                  <p className="font-bold mb-1">Yêu cầu bảo mật</p>
                  <p className="opacity-90">
                    Vui lòng tải lên ảnh 2 mặt CCCD/Passport rõ nét. Thông tin
                    này được mã hóa chuẩn AES-256 và chỉ dùng duy nhất cho việc
                    xác minh chính chủ.
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {renderUploadArea(
                  "frontImage",
                  "Mặt trước CCCD",
                  frontImageFile,
                )}
                {renderUploadArea("backImage", "Mặt sau CCCD", backImageFile)}
              </div>
            </section>

            {/* SUBMIT */}
            <div className="pt-6 border-t border-border">
              <Button
                type="submit"
                size="lg"
                className="w-full h-14 text-base font-bold uppercase tracking-wide shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-[0.99] rounded-xl"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-5 animate-spin" /> Đang xử
                    lý...
                  </>
                ) : (
                  <>
                    Gửi yêu cầu xác minh <Check className="ml-2 size-5" />
                  </>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground mt-4 font-medium">
                Bằng việc gửi yêu cầu, bạn đồng ý với{" "}
                <a href="#" className="underline hover:text-primary">
                  Điều khoản dịch vụ
                </a>{" "}
                dành cho Nghệ sĩ.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Helper Icon Component (nếu chưa có)
function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
