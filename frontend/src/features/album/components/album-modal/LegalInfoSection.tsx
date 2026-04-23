import React from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/ui/tag-input";
import type { AlbumFormValues } from "@/features/album/schemas/album.schema";

interface LegalInfoSectionProps {
  form: UseFormReturn<AlbumFormValues>;
}

const LegalInfoSection: React.FC<LegalInfoSectionProps> = ({ form }) => {
  const {
    control,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-[13px] font-bold uppercase tracking-widest text-foreground">
          Bản quyền & Metadata
        </h4>
        <p className="text-[13px] text-muted-foreground mt-1">
          Dữ liệu phân phối (UPC, Bản quyền) theo chuẩn quốc tế.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Thẻ tìm kiếm (Tags)
        </Label>
        <Controller
          name="tags"
          control={control}
          render={({ field }) => (
            <div className="rounded-md border border-input bg-transparent focus-within:ring-1 focus-within:ring-primary focus-within:border-primary">
              <TagInput
                value={field.value || []}
                onChange={(newTags) => {
                  field.onChange(newTags);
                  // THÊM DÒNG NÀY (Nhớ lấy form.setValue từ hook ra)
                  form.setValue("tags", newTags, { shouldDirty: true });
                }}
                placeholder="Nhập tag và ấn Enter..."
                className="border-none shadow-none focus-visible:ring-0"
              />
            </div>
          )}
        />
        {errors.tags && (
          <p className="text-[12px] text-destructive font-medium flex items-center gap-1.5 mt-1">
            <AlertCircle className="size-3.5" /> Thẻ tìm kiếm không hợp lệ
          </p>
        )}
      </div>
    </div>
  );
};

export default LegalInfoSection;
