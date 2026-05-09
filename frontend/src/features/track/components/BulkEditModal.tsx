import React, { lazy, Suspense } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  Disc,
  Tags,
  Globe,
  AlertTriangle,
  Layers,
  Video,
  Sparkles,
  CheckCircle2,
  FileText,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

// UI Components
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

// Components Selector
const AlbumSelector = lazy(() =>
  import("@/features/album/components/AlbumSelector").then((m) => ({
    default: m.AlbumSelector,
  })),
);
const GenreSelector = lazy(() =>
  import("@/features/genre/components/GenreSelector").then((m) => ({
    default: m.GenreSelector,
  })),
);
import { TagInput } from "@/components/ui/tag-input";
import { MoodVideoPicker } from "@/features/mood-video/components/MoodVideoPicker";
import {
  BulkTrackUpdateFormValues,
  bulkTrackUpdateSchema,
} from "../schemas/track.schema";
import { WaveformBars } from "@/components/MusicVisualizer";

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onSubmit: (data: BulkTrackUpdateFormValues) => void;
  isPending: boolean;
  initialTab?: "metadata" | "album" | "mood" | "legal";
}

export const BulkEditModal: React.FC<BulkEditModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  onSubmit,
  isPending,
  initialTab = "metadata",
}) => {
  const { control, handleSubmit, setValue, watch } =
    useForm<BulkTrackUpdateFormValues>({
      resolver: zodResolver(bulkTrackUpdateSchema) as any,
      defaultValues: {
        tags: [],
        isPublic: undefined, // undefined = không thay đổi
        albumId: undefined,
      },
    });

  const isPublic = watch("isPublic");
  // moodVideo selection will use the shared MoodVideoPicker component

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !isPending && !open && onClose()}
    >
      <DialogContent className="w-[95vw] sm:max-w-[550px] max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden border-border shadow-2xl ring-1 ring-black/5 rounded-2xl z-[100]">
        {/* HEADER */}
        <DialogHeader className="px-6 py-5 border-b bg-muted/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary border border-primary/20 hidden sm:block">
              <Layers className="size-5" />
            </div>
            <div className="space-y-0.5">
              <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                Chỉnh sửa hàng loạt
              </DialogTitle>
              <DialogDescription className="text-foreground/70 font-medium flex items-center gap-1.5 text-xs sm:text-sm">
                Áp dụng cho
                <span className="text-primary font-bold px-1.5 py-0.5 bg-primary/10 rounded border border-primary/20 text-xs">
                  {selectedCount} bài hát
                </span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0"
        >
          <Tabs
            defaultValue={initialTab}
            className="flex flex-col flex-1 min-h-0"
          >
            {/* TABS LIST */}
            <div className="px-5 pt-5 pb-2 shrink-0">
              <TabsList className="grid w-full grid-cols-4 bg-muted h-11 p-1 rounded-lg">
                <TabsTrigger
                  value="metadata"
                  className="gap-2 text-xs sm:text-sm font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-md transition-all"
                >
                  <Tags className="size-3.5 sm:size-4" /> Metadata
                </TabsTrigger>
                <TabsTrigger
                  value="mood"
                  className="gap-2 text-xs sm:text-sm font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-md transition-all"
                >
                  <Layers className="size-3.5 sm:size-4" /> Mood Video
                </TabsTrigger>
                <TabsTrigger
                  value="album"
                  className="gap-2 text-xs sm:text-sm font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-md transition-all"
                >
                  <Disc className="size-3.5 sm:size-4" /> Album
                </TabsTrigger>
                <TabsTrigger
                  value="legal"
                  className="gap-2 text-xs sm:text-sm font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-md transition-all"
                >
                  <FileText className="size-3.5 sm:size-4" /> Legal
                </TabsTrigger>
              </TabsList>
            </div>

            {/* SCROLLABLE CONTENT */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-2">
              <div className="py-2">
                {/* --- TAB: METADATA --- */}
                <TabsContent
                  value="metadata"
                  className="space-y-6 mt-0 animate-in fade-in slide-in-from-right-4 duration-300 outline-none"
                >
                  {/* Genre */}
                  <div className="space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                      Cập nhật Thể loại
                    </Label>
                    <div className="bg-background p-2 border border-input rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                      <Controller
                        control={control}
                        name="genreIds"
                        render={({ field }) => (
                          <Suspense fallback={<WaveformBars active />}>
                            <GenreSelector
                              value={field.value}
                              onChange={field.onChange}
                              className="border-none"
                            />
                          </Suspense>
                        )}
                      />
                    </div>
                    {/* Warning */}
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="size-4 shrink-0" />
                      <p className="text-[11px] font-medium leading-tight">
                        Sẽ <strong>thay thế</strong> toàn bộ thể loại cũ.
                      </p>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                      Thêm từ khóa (Tags)
                    </Label>
                    <Controller
                      control={control}
                      name="tags"
                      render={({ field }) => (
                        <TagInput
                          value={field.value || []}
                          onChange={field.onChange}
                          placeholder="Nhập tags..."
                          className="bg-background border-input min-h-[42px]"
                        />
                      )}
                    />
                  </div>

                  {/* Mood Video (Canvas) */}
                  <div className="space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                      Gán Mood Video (Canvas)
                    </Label>
                    <div className="p-3 rounded-md bg-muted/5 text-sm text-muted-foreground">
                      Sử dụng tab <strong>“Mood Video”</strong> để gán, chọn
                      hoặc gỡ Mood Video cho các bài hát một cách trực quan.
                    </div>
                  </div>

                  {/* Visibility - Fixed Click Handler */}
                  <div
                    className={cn(
                      "flex items-center justify-between p-4 border rounded-xl transition-all cursor-pointer select-none group",
                      isPublic !== undefined
                        ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                        : "border-border bg-background hover:bg-muted/40 hover:border-foreground/20",
                    )}
                    // Click vào cả khối để toggle
                    onClick={() => {
                      if (isPublic === undefined)
                        setValue("isPublic", true, { shouldDirty: true });
                      else if (isPublic === true)
                        setValue("isPublic", false, { shouldDirty: true });
                      else
                        setValue("isPublic", undefined, { shouldDirty: true });
                    }}
                  >
                    <div className="flex gap-4 items-center">
                      <div
                        className={cn(
                          "p-2.5 rounded-lg border shrink-0 transition-colors",
                          isPublic !== undefined
                            ? "bg-background border-primary/20 text-primary"
                            : "bg-muted border-transparent text-muted-foreground group-hover:bg-muted/80",
                        )}
                      >
                        <Globe className="size-5" />
                      </div>
                      <div>
                        <Label className="text-sm font-bold text-foreground cursor-pointer block">
                          Trạng thái hiển thị
                        </Label>
                        <p
                          className={cn(
                            "text-xs font-medium mt-0.5 transition-colors",
                            isPublic !== undefined
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                        >
                          {isPublic === undefined
                            ? "Giữ nguyên (Không đổi)"
                            : isPublic
                              ? "Đặt thành Công khai (Public)"
                              : "Đặt thành Riêng tư (Private)"}
                        </p>
                      </div>
                    </div>

                    <div
                      className="pl-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Controller
                        control={control}
                        name="isPublic"
                        render={({ field }) => (
                          <Switch
                            checked={!!field.value}
                            onCheckedChange={(val) => field.onChange(val)}
                            className="data-[state=checked]:bg-primary scale-110"
                          />
                        )}
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* --- TAB: MOOD VIDEO (Visual Canvas) --- */}
                <TabsContent
                  value="mood"
                  className="space-y-6 mt-0 animate-in fade-in slide-in-from-right-4 duration-300 outline-none"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
                        <Video className="size-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground uppercase">
                          Visual Canvas
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Background video experience for selected tracks.
                          Manual selection here overrides any automatic
                          assignment.
                        </p>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "card-base p-4 space-y-2 rounded-lg",
                        "bg-gradient-to-r from-primary/8 via-transparent to-transparent",
                      )}
                    >
                      <div className="flex items-center gap-2 text-primary">
                        <Sparkles className="size-4" aria-hidden="true" />
                        <h5 className="text-xs font-black uppercase tracking-widest">
                          Smart Selection
                        </h5>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Leave blank to keep existing assignments. Use the picker
                        below to assign or remove a Mood Video for all selected
                        tracks.
                      </p>
                    </div>

                    <Controller
                      name="moodVideoId"
                      control={control}
                      render={({ field }) => (
                        <MoodVideoPicker
                          value={field.value ?? null}
                          onChange={field.onChange}
                        />
                      )}
                    />
                  </div>
                </TabsContent>

                {/* --- TAB: ALBUM --- */}
                <TabsContent
                  value="album"
                  className="space-y-5 mt-0 animate-in fade-in slide-in-from-right-4 duration-300 outline-none"
                >
                  <div className="space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                      Gán vào Album
                    </Label>
                    <div className="p-2 bg-background border border-input rounded-xl focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-sm">
                      <Controller
                        control={control}
                        name="albumId"
                        render={({ field }) => (
                          <Suspense fallback={<WaveformBars active />}>
                            <AlbumSelector
                              value={field.value || ""}
                              onChange={field.onChange}
                            />
                          </Suspense>
                        )}
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="text-destructive font-bold h-auto p-0 hover:underline text-xs"
                        onClick={() =>
                          setValue("albumId", null, { shouldDirty: true })
                        }
                      >
                        Gỡ khỏi album hiện tại
                      </Button>
                    </div>

                    <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-medium leading-relaxed flex gap-3 items-start">
                      <Disc className="size-4 shrink-0 mt-0.5" />
                      <p>
                        Các bài hát sẽ được di chuyển vào Album mới. <br />
                        <span className="opacity-70">
                          Lưu ý: Track Number có thể cần sắp xếp lại thủ công.
                        </span>
                      </p>
                    </div>
                  </div>
                </TabsContent>

                {/* --- TAB: LEGAL --- */}
                <TabsContent
                  value="legal"
                  className="space-y-6 mt-0 animate-in fade-in slide-in-from-right-4 duration-300 outline-none"
                >
                  <div className="space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                      Copyright Notice
                    </Label>
                    <div className="bg-background p-2 border border-input rounded-xl focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-sm">
                      <Controller
                        control={control}
                        name="copyright"
                        render={({ field }) => (
                          <Textarea
                            {...field}
                            placeholder="© 2024 Artist Name. All rights reserved."
                            className="min-h-[80px] bg-transparent border-none resize-none"
                          />
                        )}
                      />
                    </div>
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="size-4 shrink-0" />
                      <p className="text-[11px] font-medium leading-tight">
                        Sẽ <strong>thay thế</strong> bản quyền cũ.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                      ISRC Code
                    </Label>
                    <div className="bg-background p-2 border border-input rounded-xl focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-sm">
                      <Controller
                        control={control}
                        name="isrc"
                        render={({ field }) => (
                          <Input
                            {...field}
                            placeholder="USRC17607839"
                            className="bg-transparent border-none font-mono uppercase"
                          />
                        )}
                      />
                    </div>
                    <div className="flex items-start gap-2 text-muted-foreground/55 px-1">
                      <Info
                        className="size-3 mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      <p className="text-[10px] leading-relaxed">
                        International Standard Recording Code (optional).
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </div>

            {/* FOOTER */}
            <DialogFooter className="px-5 py-4 border-t bg-muted/10 gap-3 shrink-0 flex-col-reverse sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isPending}
                className="font-bold border-input bg-background hover:bg-accent hover:text-foreground w-full sm:w-auto h-10 shadow-sm"
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="font-bold shadow-md px-6 transition-all active:scale-95 w-full sm:w-auto h-10 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 size-4" />
                )}
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </Tabs>
        </form>
      </DialogContent>
    </Dialog>
  );
};
export default BulkEditModal;
