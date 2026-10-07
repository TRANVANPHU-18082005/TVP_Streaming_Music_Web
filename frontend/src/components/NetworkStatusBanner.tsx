import { useEffect, useRef } from "react";
import { RefreshCw, WifiOff, Radio } from "lucide-react";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useSocket } from "@/hooks/useSocket";
import { cn } from "@/lib/utils";

type BannerKind = "offline" | "socket-failed" | null;

/**
 * Banner trạng thái kết nối. Hiện khi:
 * - Mất mạng (navigator offline)
 * - Socket realtime đã bỏ cuộc sau nhiều lần reconnect (kèm nút thử lại)
 * Khi có mạng trở lại, hiện toast "Đã kết nối lại".
 */
export function NetworkStatusBanner({ className }: { className?: string }) {
  const online = useOnlineStatus();
  const { status, reconnect } = useSocket();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      toast.success("Đã kết nối lại", { id: "network-restored" });
    }
  }, [online]);

  const kind: BannerKind = !online
    ? "offline"
    : status === "failed"
      ? "socket-failed"
      : null;

  if (!kind) return null;

  const Icon = kind === "offline" ? WifiOff : Radio;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed left-1/2 bottom-24 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2",
        "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur",
        "border-amber-500/30 bg-background/95 text-foreground",
        className,
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-tight">
          {kind === "offline"
            ? "Mất kết nối mạng"
            : "Mất kết nối thời gian thực"}
        </p>
        <p className="text-xs text-muted-foreground">
          {kind === "offline"
            ? "Một số tính năng tạm thời không khả dụng."
            : "Chat phòng, thông báo và bảng xếp hạng trực tiếp tạm ngưng cập nhật."}
        </p>
      </div>
      {kind === "socket-failed" && (
        <button
          type="button"
          onClick={reconnect}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Thử kết nối lại
        </button>
      )}
    </div>
  );
}

export default NetworkStatusBanner;
