import React from "react";
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
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Components Selector
import { AlbumSelector } from "@/features/album/components/AlbumSelector";
import { GenreSelector } from "@/features/genre/components/GenreSelector";
import { TagInput } from "@/components/ui/tag-input";
import {
  BulkTrackFormValues,
  bulkTrackSchema,
} from "@/features/track/schemas/track.schema";

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onSubmit: (data: BulkTrackFormValues) => void;
  isPending: boolean;
  initialTab?: "metadata" | "album";
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
    useForm<BulkTrackFormValues>({
      resolver: zodResolver(bulkTrackSchema),
      defaultValues: {
        tags: [],
        isPublic: undefined, // undefined = không thay đổi
        albumId: undefined,
      },
    });

  const isPublic = watch("isPublic");

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
              <TabsList className="grid w-full grid-cols-2 bg-muted h-11 p-1 rounded-lg">
                <TabsTrigger
                  value="metadata"
                  className="gap-2 text-xs sm:text-sm font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-md transition-all"
                >
                  <Tags className="size-3.5 sm:size-4" /> Metadata
                </TabsTrigger>
                <TabsTrigger
                  value="album"
                  className="gap-2 text-xs sm:text-sm font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-md transition-all"
                >
                  <Disc className="size-3.5 sm:size-4" /> Album
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
                          <GenreSelector
                            value={field.value}
                            onChange={field.onChange}
                            className="border-none"
                          />
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
                          <AlbumSelector
                            value={field.value || ""}
                            onChange={field.onChange}
                          />
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
