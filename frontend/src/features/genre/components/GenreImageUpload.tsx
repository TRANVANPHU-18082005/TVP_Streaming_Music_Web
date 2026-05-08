import React from "react";
import { Camera, AlertCircle, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  imagePreview: string | null;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  imageFileError?: string | null;
  error?: any;
  disabled?: boolean;
}

const GenreImageUpload: React.FC<Props> = ({
  imagePreview,
  onImageChange,
  imageFileError,
  error,
  disabled,
}) => {
  return (
    <div className="flex flex-col gap-2 shrink-0">
      <div
        className={cn(
          "relative group size-36 sm:size-40 rounded-xl border-2 border-dashed overflow-hidden flex items-center justify-center cursor-pointer transition-all duration-300",
          error || imageFileError
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
                <Camera className="w-4 h-4 mr-2" /> Đổi ảnh
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground transition-colors group-hover:text-primary">
            <div className="p-3 rounded-full bg-background shadow-sm mb-2 border border-border/50">
              <ImageIcon className="size-6" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wide">
              Tải ảnh / biểu tượng
            </span>
          </div>
        )}

        <input
          type="file"
          accept={[
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/svg+xml",
          ].join(",")}
          aria-label="Upload genre image"
          className="absolute inset-0 opacity-0 cursor-pointer z-10"
          onChange={onImageChange}
          disabled={disabled}
        />

        {(error || imageFileError) && (
          <div className="absolute bottom-2 right-2 bg-destructive/90 backdrop-blur px-2 py-1 rounded text-[10px] text-destructive-foreground font-bold flex items-center gap-1 z-20">
            <AlertCircle className="size-3" />
            {imageFileError ? "File không hợp lệ" : "Lỗi ảnh"}
          </div>
        )}
      </div>
      {imageFileError && (
        <p className="text-[11px] text-destructive font-medium max-w-40">
          {imageFileError}
        </p>
      )}
    </div>
  );
};

export default GenreImageUpload;
