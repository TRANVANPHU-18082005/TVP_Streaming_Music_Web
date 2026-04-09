import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Save, Loader2, Disc3, Globe, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

// Components
import CoverUpload from "./CoverUpload";
import GeneralInfoSection from "./GeneralInfoSection";
import RelationSection from "./RelationSection";
import LegalInfoSection from "./LegalInfoSection";
import { Button } from "@/components/ui/button";

// Logic
import { useAlbumForm } from "@/features/album/hooks/useAlbumForm";
import { Album } from "@/features/album/types";
import { Form } from "@/components/ui/form";

interface AlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  albumToEdit?: Album | null;
  onSubmit: (data: FormData) => Promise<void>;
  isPending: boolean;
}

const AlbumModal: React.FC<AlbumModalProps> = ({
  isOpen,
  onClose,
  albumToEdit,
  onSubmit,
  isPending,
}) => {
  // AlbumFormModal.tsx
  const { form, handleSubmit, isSubmitting } = useAlbumForm(
    albumToEdit
      ? {
          mode: "edit",
          albumToEdit,
          onSubmit,
        }
      : {
          mode: "create",
          onSubmit,
        },
  );
  const isPublic = form.watch("isPublic");
  const isBusy = isPending || isSubmitting;

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-background/90 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Container Modal (Chuẩn Pro: Vuông vức hơn, viền mảnh) */}
      <div className="relative w-full max-w-6xl bg-card border border-border shadow-2xl flex flex-col h-[95vh] md:h-[85vh] rounded-xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* --- HEADER (Cố định) --- */}
        <div className="shrink-0 px-6 py-4 border-b border-border bg-card flex justify-between items-center z-20">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Disc3 className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold leading-tight text-foreground">
                {albumToEdit
                  ? "Chỉnh sửa Thông tin Đĩa nhạc"
                  : "Phát hành Đĩa nhạc mới"}
              </h3>
              <p className="text-[13px] text-muted-foreground font-medium">
                {albumToEdit
                  ? `Đang sửa: ${albumToEdit.title}`
                  : "Studio Release Manager"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div
              className={cn(
                "hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-all cursor-pointer select-none font-bold text-[11px] uppercase tracking-widest",
                isPublic
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted/50 border-border text-muted-foreground hover:bg-muted",
              )}
              onClick={() =>
                form.setValue("isPublic", !isPublic, { shouldDirty: true })
              }
            >
              {isPublic ? (
                <Globe className="size-3.5" />
              ) : (
                <Lock className="size-3.5" />
              )}
              {isPublic ? "Công khai" : "Riêng tư"}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={isBusy}
              className="size-9 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="size-5" />
            </Button>
          </div>
        </div>

        {/* --- BODY FORM (Cuộn mượt mà) --- */}
        <div className="flex-1 overflow-y-auto p-6 bg-background custom-scrollbar">
          <Form {...form}>
            <form
              id="album-form"
              onSubmit={handleSubmit}
              className="flex flex-col lg:flex-row gap-8"
            >
              {/* LEFT COLUMN: 320px cố định (Chuẩn Sidebar) */}
              <div className="w-full lg:w-[320px] shrink-0 space-y-8">
                <CoverUpload form={form} />
                <div className="h-px bg-border/50 w-full hidden lg:block" />
                <RelationSection form={form} />
              </div>

              {/* RIGHT COLUMN: Flex-1 */}
              <div className="flex-1 space-y-8 lg:border-l lg:border-border/50 lg:pl-8">
                <GeneralInfoSection form={form} />
                <div className="h-px bg-border/50 w-full" />
                <LegalInfoSection form={form} />
              </div>
            </form>
          </Form>
        </div>

        {/* --- FOOTER (Cố định) --- */}
        <div className="shrink-0 px-6 py-4 border-t border-border bg-muted/20 flex justify-end gap-3 z-20">
          <Button
            variant="ghost"
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="font-semibold text-muted-foreground hover:text-foreground h-10 px-6 rounded-md"
          >
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            form="album-form"
            disabled={isBusy}
            className="h-10 px-8 rounded-md font-bold text-sm shadow-sm transition-all"
          >
            {isBusy ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <Save className="size-4 mr-2" />
            )}
            {albumToEdit ? "Lưu thay đổi" : "Phát hành"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AlbumModal;
