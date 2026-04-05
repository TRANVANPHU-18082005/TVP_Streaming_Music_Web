"use client";
import React, { useState, useCallback } from "react";
import { UploadCloud, FileVideo, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoUploadZoneProps {
  value?: File | string | null;
  onChange: (file: File | null) => void;
  error?: string;
}

export const VideoUploadZone = ({
  value,
  onChange,
  error,
}: VideoUploadZoneProps) => {
  const [preview, setPreview] = useState<string | null>(
    typeof value === "string" ? value : null,
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onChange(file);
        setPreview(URL.createObjectURL(file));
      }
    },
    [onChange],
  );

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "relative rounded-2xl border-2 border-dashed transition-all",
          error
            ? "border-destructive/50 bg-destructive/5"
            : "border-border/60 hover:border-primary/40 bg-muted/5",
          preview
            ? "aspect-[9/16] w-48 mx-auto overflow-hidden"
            : "p-8 text-center",
        )}
      >
        {preview ? (
          <>
            <video
              src={preview}
              className="h-full w-full object-cover"
              muted
              autoPlay
              loop
            />
            <button
              onClick={() => {
                setPreview(null);
                onChange(null);
              }}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black"
            >
              <X className="size-4" />
            </button>
          </>
        ) : (
          <label className="flex flex-col items-center cursor-pointer">
            <div className="p-3 rounded-full bg-primary/10 mb-3">
              <UploadCloud className="size-6 text-primary" />
            </div>
            <span className="text-sm font-bold">
              Drop your Canvas video here
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              MP4, WebM (Max 20MB)
            </span>
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        )}
      </div>
      {error && (
        <p className="text-[11px] text-destructive font-medium">{error}</p>
      )}
    </div>
  );
};
