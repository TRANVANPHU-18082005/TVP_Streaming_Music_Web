import React, { useState, useEffect } from "react";
import { type UseFormReturn } from "react-hook-form";
import { X, Upload, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AlbumFormValues } from "@/features/album/schemas/album.schema";

interface CoverUploadProps {
  form: UseFormReturn<AlbumFormValues>;
}

const CoverUpload: React.FC<CoverUploadProps> = ({ form }) => {
  const {
    watch,
    setValue,
    formState: { errors },
  } = form;
  const coverValue = watch("coverImage");
  const [preview, setPreview] = useState<string | null>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setValue("coverImage", file, { shouldValidate: true, shouldDirty: true });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-[13px] font-bold uppercase tracking-widest text-foreground">
          Ảnh bìa (Cover)
        </h4>
      </div>

      <div
        className={cn(
          "relative group aspect-square w-full rounded-lg border border-dashed transition-all overflow-hidden flex items-center justify-center cursor-pointer bg-muted/10 hover:bg-muted/30 hover:border-primary/50",
          errors.coverImage
            ? "border-destructive bg-destructive/5"
            : "border-border",
        )}
      >
        {preview ? (
          <img
            src={preview}
            alt="Cover"
            className="w-full h-full object-cover relative z-10"
          />
        ) : (
          <div className="text-center p-6 flex flex-col items-center">
            <div className="size-12 bg-background rounded-md shadow-sm border border-border flex items-center justify-center mb-3">
              <Upload className="size-5 text-muted-foreground" />
            </div>
            <span className="text-[13px] font-semibold text-foreground">
              Tải ảnh lên
            </span>
            <span className="text-[11px] font-medium text-muted-foreground mt-1 text-center">
              JPEG, PNG, WebP • Tối đa 2MB
            </span>
          </div>
        )}

        <input
          type="file"
          accept="image/jpeg, image/png, image/webp"
          className="absolute inset-0 opacity-0 cursor-pointer z-20"
          onChange={handleFileChange}
        />

        {preview && (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 z-30 h-7 w-7 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              setValue("coverImage", null, {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      {errors.coverImage && (
        <p className="text-[12px] text-destructive font-medium flex items-center gap-1.5 mt-1">
          <AlertCircle className="size-3.5" />{" "}
          {errors.coverImage.message as string}
        </p>
      )}
    </div>
  );
};

export default CoverUpload;
