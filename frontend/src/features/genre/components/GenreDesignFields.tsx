import React from "react";
import {
  Palette,
  Hash,
  Paintbrush,
  AlignLeft,
  AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Props {
  register: any;
  errors: any;
  watchColor?: string;
  watchGradient?: string;
}

const LABEL_CLASS =
  "text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5 w-fit";

const GenreDesignFields: React.FC<Props> = ({
  register,
  errors,
  watchColor,
  watchGradient,
}) => {
  return (
    <div>
      <h4 className="text-[13px] font-bold uppercase tracking-widest text-foreground mb-6">
        Cấu hình giao diện
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div>
            <Label className={LABEL_CLASS}>
              <Palette className="size-3.5" /> Màu chủ đạo
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
              <span className="text-xs font-mono uppercase text-foreground font-semibold">
                {watchColor || "Chưa chọn màu"}
              </span>
            </div>
            {errors.color && (
              <p className="text-[12px] font-medium text-destructive mt-1 flex items-center gap-1.5">
                <AlertCircle className="size-3.5" />{" "}
                {errors.color.message as string}
              </p>
            )}
          </div>

          <div>
            <Label className={LABEL_CLASS}>
              <Hash className="size-3.5" /> Độ ưu tiên hiển thị
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
          <div>
            <Label className={LABEL_CLASS}>
              <Paintbrush className="size-3.5" /> Background Gradient CSS
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
                  style={{ background: watchGradient || "transparent" }}
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

          <div>
            <Label htmlFor="description" className={LABEL_CLASS}>
              <AlignLeft className="size-3.5" /> Mô tả ngắn
            </Label>
            <Textarea
              id="description"
              {...register("description")}
              rows={2}
              className={cn(
                "resize-none h-11 custom-scrollbar bg-transparent border-input text-sm focus-visible:ring-1 focus-visible:ring-primary",
                errors.description &&
                  "border-destructive focus-visible:ring-destructive",
              )}
              placeholder="Thông tin thêm (nếu có)..."
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
  );
};

export default GenreDesignFields;
