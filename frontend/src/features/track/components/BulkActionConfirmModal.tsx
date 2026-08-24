import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";
import { TRACK_STATUS_OPTIONS, TrackStatus } from "../schemas/track.schema";

export type BulkActionType =
  | "delete"
  | "retry_transcode"
  | "retry_lyrics"
  | "retry_karaoke"
  | "retry_mood"
  | "retry_full"
  | "retry_ai"
  | "public"
  | "explicit"
  | "status"
  | "custom_retry";

export interface BulkActionConfig {
  type: BulkActionType;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  isDestructive?: boolean;
}

interface BulkActionConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data?: any) => void;
  config: BulkActionConfig | null;
  count: number;
  isPending: boolean;
}

export const BulkActionConfirmModal: React.FC<BulkActionConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  config,
  count,
  isPending,
}) => {
  const [status, setStatus] = useState<TrackStatus>("ready");
  const [errorReason, setErrorReason] = useState("");

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStatus("ready");
      setErrorReason("");
    }
  }, [isOpen]);

  if (!config) return null;

  const handleConfirm = () => {
    if (config.type === "status") {
      onConfirm({ status, errorReason: status === "failed" ? errorReason : undefined });
    } else {
      onConfirm();
    }
  };

  const renderContent = () => {
    if (config.type === "status") {
      return (
        <div className="space-y-4 py-4">
          <p className="text-sm text-foreground/80">
            Chọn trạng thái mới cho <strong>{count}</strong> bài hát đã chọn:
          </p>
          <div className="space-y-3">
            <label className="text-sm font-semibold block text-foreground">Trạng thái</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TrackStatus)}
              className="w-full p-2.5 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            >
              {TRACK_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {status === "failed" && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="text-sm font-semibold block text-foreground">Lý do lỗi (Tùy chọn)</label>
              <textarea
                value={errorReason}
                onChange={(e) => setErrorReason(e.target.value)}
                placeholder="Nhập lý do lỗi để hiển thị..."
                className="w-full p-2.5 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[80px] resize-none"
              />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4 py-4">
        {config.description ? (
          config.description
        ) : (
          <p className="text-sm text-foreground/80">
            Bạn có chắc chắn muốn thực hiện hành động này cho{" "}
            <strong>{count}</strong> bài hát đã chọn?
          </p>
        )}
        {config.isDestructive && (
          <div className="bg-destructive/10 p-3 rounded-lg border border-destructive/20 flex items-start gap-3">
            <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
            <span className="text-destructive font-bold text-xs">
              Cảnh báo: Hành động này không thể hoàn tác. Vui lòng xác nhận cẩn thận trước khi tiếp tục.
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isPending && !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-[450px] p-0 overflow-hidden border-border shadow-2xl ring-1 ring-black/5 rounded-2xl z-[100]">
        <DialogHeader className="px-6 py-5 border-b bg-muted/10 shrink-0">
          <DialogTitle className="text-lg font-bold text-foreground">
            {config.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-foreground/70">
            Đang áp dụng cho {count} bài hát.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6">
          {renderContent()}
        </div>

        <DialogFooter className="px-5 py-4 border-t bg-muted/10 gap-3 flex-col-reverse sm:flex-row">
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
            type="button"
            onClick={handleConfirm}
            disabled={isPending || (config.type === "status" && status === "failed" && errorReason.length > 500)}
            className={`font-bold shadow-md px-6 transition-all active:scale-95 w-full sm:w-auto h-10 ${
              config.isDestructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {config.confirmLabel || "Xác nhận"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
