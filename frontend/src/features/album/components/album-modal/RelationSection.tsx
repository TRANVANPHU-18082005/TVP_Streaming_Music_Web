import React, { lazy, Suspense } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";

import type { AlbumFormValues } from "@/features/album/schemas/album.schema";
import { WaveformBars } from "@/components/MusicVisualizer";
const ArtistSelector = lazy(() =>
  import("@/features/artist/components/ArtistSelector").then((m) => ({
    default: m.ArtistSelector,
  })),
);
interface RelationSectionProps {
  form: UseFormReturn<AlbumFormValues>;
}

const RelationSection: React.FC<RelationSectionProps> = ({ form }) => {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-[13px] font-bold uppercase tracking-widest text-foreground">
          Liên kết
        </h4>
      </div>

      <div className="space-y-1">
        <Controller
          name="artist"
          control={form.control}
          render={({ field, fieldState }) => (
            <Suspense fallback={<WaveformBars active />}>
              <ArtistSelector
                label="Nghệ sĩ trình bày"
                required
                singleSelect
                value={field.value ? [field.value] : []}
                onChange={(ids) => {
                  field.onChange(ids[0] || "");
                  // THÊM DÒNG NÀY ĐỂ ÉP DIRTY:
                  form.setValue("artist", ids[0] || "", { shouldDirty: true });
                }}
                error={fieldState.error?.message}
              />
            </Suspense>
          )}
        />
      </div>
    </div>
  );
};

export default RelationSection;
