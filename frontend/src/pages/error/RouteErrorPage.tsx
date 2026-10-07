import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";
import { Home, RefreshCw } from "lucide-react";
import MusicResult from "@/components/ui/Result";
import { cn } from "@/lib/utils";
import { isChunkLoadError } from "@/utils/chunkError";

interface RouteErrorPageProps {
  /** true khi dùng ở route gốc (không có layout bao quanh) */
  fullScreen?: boolean;
}

/**
 * `errorElement` cho React Router. Bắt lỗi render, lỗi loader và lỗi tải lazy chunk
 * để layout (Header, Player) vẫn còn khi một page bị crash.
 */
export default function RouteErrorPage({ fullScreen = false }: RouteErrorPageProps) {
  const error = useRouteError();
  const navigate = useNavigate();

  if (import.meta.env.DEV) {
    console.error("[RouteErrorPage]", error);
  }

  const reload = () => window.location.reload();
  const goHome = () => navigate("/");

  const chunkError = isChunkLoadError(error);
  const status = isRouteErrorResponse(error) ? error.status : undefined;

  let content;
  if (chunkError) {
    content = (
      <MusicResult
        variant="custom"
        icon={RefreshCw}
        wave="--warning"
        size="lg"
        title="Phiên bản mới đã sẵn sàng"
        description="Không thể tải trang này vì ứng dụng vừa được cập nhật. Vui lòng tải lại trang."
        action={{ label: "Tải lại trang", icon: RefreshCw, onClick: reload, variant: "primary" }}
        secondaryAction={{ label: "Về trang chủ", icon: Home, onClick: goHome, variant: "ghost" }}
        className="border-solid"
      />
    );
  } else if (status === 404) {
    content = (
      <MusicResult
        variant="not-found"
        size="lg"
        onBack={() => navigate(-1)}
        secondaryAction={{ label: "Về trang chủ", icon: Home, onClick: goHome, variant: "ghost" }}
      />
    );
  } else if (status === 401 || status === 403) {
    content = (
      <MusicResult
        variant="no-permission"
        size="lg"
        secondaryAction={{ label: "Về trang chủ", icon: Home, onClick: goHome, variant: "ghost" }}
      />
    );
  } else {
    content = (
      <MusicResult
        variant="error"
        size="lg"
        title="Trang gặp sự cố"
        description="Đã có lỗi không mong muốn khi hiển thị trang này. Bạn có thể tải lại hoặc quay về trang chủ."
        action={{ label: "Tải lại trang", icon: RefreshCw, onClick: reload, variant: "primary" }}
        secondaryAction={{ label: "Về trang chủ", icon: Home, onClick: goHome, variant: "ghost" }}
      />
    );
  }

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-xl items-center justify-center p-4",
        fullScreen ? "min-h-screen bg-background text-foreground" : "min-h-[60vh]",
      )}
    >
      <div className="w-full">{content}</div>
    </div>
  );
}
