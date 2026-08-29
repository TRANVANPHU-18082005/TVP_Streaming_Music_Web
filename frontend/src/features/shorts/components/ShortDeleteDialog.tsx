import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShortDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  shortTitle?: string;
  isLoading?: boolean;
}

export const ShortDeleteDialog = ({
  open,
  onClose,
  onConfirm,
  shortTitle,
  isLoading = false,
}: ShortDeleteDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-destructive/15 border border-destructive/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <DialogTitle>Xác nhận xóa Short</DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-relaxed">
            Bạn có chắc chắn muốn xóa{" "}
            {shortTitle ? (
              <>
                Short <strong className="text-foreground">"{shortTitle}"</strong>
              </>
            ) : (
              "Short này"
            )}
            ? Hành động này <strong className="text-destructive">không thể hoàn tác</strong>.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 sm:flex-none"
          >
            Hủy bỏ
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 sm:flex-none gap-2"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Đang xóa...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Xóa Short
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
