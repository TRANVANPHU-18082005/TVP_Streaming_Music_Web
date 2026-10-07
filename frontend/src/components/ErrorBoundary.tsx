import { Component, type ErrorInfo, type ReactNode } from "react";
import MusicResult from "@/components/ui/Result";
import { isChunkLoadError } from "@/utils/chunkError";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Tên widget để log / hiển thị tiêu đề lỗi */
  name?: string;
  /** Fallback tùy biến. Mặc định: MusicResult nhỏ có nút "Thử lại" */
  fallback?: (args: { error: Error; reset: () => void }) => ReactNode;
  /** Không render gì khi lỗi (widget phụ, không muốn chiếm chỗ) */
  silent?: boolean;
  /** Khi giá trị trong mảng đổi, boundary tự reset (vd: đổi trackId) */
  resetKeys?: ReadonlyArray<unknown>;
  size?: "sm" | "md" | "lg";
  className?: string;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

const sameKeys = (a?: ReadonlyArray<unknown>, b?: ReadonlyArray<unknown>) =>
  !!a && !!b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

/**
 * Bọc các widget độc lập (player, section ở Home, lyrics, chart...) để một widget
 * crash không làm trắng cả trang. Không thêm dependency (class component thuần).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error(`[ErrorBoundary${this.props.name ? `:${this.props.name}` : ""}]`, error, info);
    }
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prev: ErrorBoundaryProps) {
    if (this.state.error && !sameKeys(prev.resetKeys, this.props.resetKeys)) {
      this.reset();
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    const { children, fallback, silent, size = "md", className, name } = this.props;

    if (!error) return children;
    if (silent) return null;
    if (fallback) return fallback({ error, reset: this.reset });

    // Lỗi tải chunk: thử lại trong cùng trang sẽ không giúp, cần tải lại
    const chunk = isChunkLoadError(error);
    return (
      <MusicResult
        variant="error"
        size={size}
        className={className}
        title={name ? `Không thể hiển thị ${name}` : "Phần này gặp sự cố"}
        description={
          chunk
            ? "Ứng dụng vừa được cập nhật. Vui lòng tải lại trang."
            : "Đã có lỗi khi hiển thị nội dung. Bạn có thể thử lại."
        }
        action={{
          label: chunk ? "Tải lại trang" : "Thử lại",
          onClick: chunk ? () => window.location.reload() : this.reset,
          variant: "outline",
        }}
      />
    );
  }
}

export default ErrorBoundary;
