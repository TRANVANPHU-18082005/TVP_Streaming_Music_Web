import React, { useEffect, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { X, Save, Loader2, Disc3, Globe, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Components (lazy to reduce bundle)
const CoverUpload = lazy(() => import("./CoverUpload"));
const GeneralInfoSection = lazy(() => import("./GeneralInfoSection"));
const RelationSection = lazy(() => import("./RelationSection"));
const LegalInfoSection = lazy(() => import("./LegalInfoSection"));
import { Button } from "@/components/ui/button";

// Logic
import { useAlbumForm } from "@/features/album/hooks/useAlbumForm";
import { Form } from "@/components/ui/form";
import { IAlbum } from "@/features";

interface AlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  albumToEdit?: IAlbum | null;
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

  // Scrollbar compensation + Escape key + cleanup
  useEffect(() => {
    if (!isOpen) return;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isBusy) onClose();
    };
    document.addEventListener("keydown", handler);

    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
      document.removeEventListener("keydown", handler);
    };
  }, [isOpen, isBusy, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-black/65 backdrop-blur-sm"
            onClick={!isBusy ? onClose : undefined}
          />

          <motion.div
            key="album-modal-content"
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99, y: 6 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-6xl bg-card border border-border shadow-2xl flex flex-col h-[95vh] md:h-[85vh] rounded-xl overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            {/* HEADER */}
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

            {/* BODY */}
            <div className="flex-1 overflow-y-auto p-6 bg-background custom-scrollbar">
              <Form {...form}>
                <form
                  id="album-form"
                  onSubmit={handleSubmit}
                  className="flex flex-col lg:flex-row gap-8"
                >
                  <div className="w-full lg:w-[320px] shrink-0 space-y-8">
                    <Suspense fallback={<div className="p-4">...</div>}>
                      <CoverUpload form={form} />
                    </Suspense>
                    <div className="h-px bg-border/50 w-full hidden lg:block" />
                    <Suspense fallback={<div className="p-4">...</div>}>
                      <RelationSection form={form} />
                    </Suspense>
                  </div>

                  <div className="flex-1 space-y-8 lg:border-l lg:border-border/50 lg:pl-8">
                    <Suspense fallback={<div className="p-4">...</div>}>
                      <GeneralInfoSection form={form} />
                    </Suspense>
                    <div className="h-px bg-border/50 w-full" />
                    <Suspense fallback={<div className="p-4">...</div>}>
                      <LegalInfoSection form={form} />
                    </Suspense>
                  </div>
                </form>
              </Form>
            </div>

            {/* FOOTER */}
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default AlbumModal;
