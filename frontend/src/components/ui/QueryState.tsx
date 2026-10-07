import { type ReactNode } from "react";
import { LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MusicResult, {
  LoadingState,
  type MusicResultProps,
} from "@/components/ui/Result";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { AUTH_PATHS } from "@/config/paths";
import { parseApiError, type AppError } from "@/utils/apiError";

/** Phần tối thiểu của UseQueryResult mà QueryState cần (hỗ trợ cả useInfiniteQuery). */
export interface QueryLike<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  fetchStatus?: "fetching" | "paused" | "idle";
  refetch: () => unknown;
}

type ResultOverrides = Partial<
  Omit<MusicResultProps, "variant" | "size" | "className" | "onRetry">
>;

export interface QueryStateProps<T> {
  query: QueryLike<T>;
  /** Skeleton riêng của page. Mặc định: LoadingState */
  skeleton?: ReactNode;
  /** Trả về true nếu data rỗng -> hiện `empty` */
  isEmpty?: (data: T) => boolean;
  /** Props cho MusicResult khi rỗng (variant mặc định "empty") */
  empty?: ResultOverrides & { variant?: MusicResultProps["variant"] };
  /** Tuỳ biến khi 404 (vd: nút "Quay lại") */
  notFound?: ResultOverrides;
  /** Nút quay lại cho các trạng thái lỗi */
  onBack?: () => void;
  size?: MusicResultProps["size"];
  className?: string;
  /** Cho phép render children kể cả khi lỗi nền nhưng đã có data (mặc định true) */
  keepDataOnError?: boolean;
  children: ReactNode | ((data: T) => ReactNode);
}

/**
 * Map `AppError.kind` -> cấu hình MusicResult. Export để page tự dựng UI khi cần.
 */
// eslint-disable-next-line react-refresh/only-export-components -- helper dùng chung với QueryErrorResult
export function resolveErrorResult(
  appError: AppError,
  handlers: { onRetry?: () => void; onLogin?: () => void },
): MusicResultProps {
  const { onRetry, onLogin } = handlers;
  switch (appError.kind) {
    case "network":
    case "offline":
    case "timeout":
      return {
        variant: "error-network",
        description:
          appError.kind === "timeout" ? appError.message : undefined,
        onRetry,
      };
    case "not_found":
      return { variant: "not-found" };
    case "forbidden":
    case "locked":
      return { variant: "no-permission", description: appError.message };
    case "unauthorized":
      return {
        variant: "custom",
        icon: LogIn,
        wave: "--warning",
        title: "Cần đăng nhập",
        description: appError.message,
        action: onLogin
          ? { label: "Đăng nhập", icon: LogIn, onClick: onLogin, variant: "primary" }
          : undefined,
        onRetry,
      };
    case "rate_limited":
      return { variant: "rate-limited", description: appError.message, onRetry };
    case "starting":
      return { variant: "service-starting", onRetry };
    case "server":
      return { variant: "error-server", description: appError.message, onRetry };
    default:
      return { variant: "error", description: appError.message, onRetry };
  }
}

export interface QueryErrorResultProps {
  /** Lỗi từ useQuery (`error`). Không có lỗi + `missing` => coi như 404 */
  error?: unknown;
  onRetry?: () => void;
  onBack?: () => void;
  /** Dữ liệu rỗng dù không có lỗi (vd: API trả null) -> hiện "không tìm thấy" */
  missing?: boolean;
  notFound?: ResultOverrides;
  size?: MusicResultProps["size"];
  className?: string;
}

/**
 * Hiển thị lỗi tải dữ liệu theo loại (mạng, 404, 403, 5xx, rate limit...).
 * Dùng cho page đã có sẵn bố cục loading/offline riêng; thay cho
 * `<MusicResult variant="error" ... />` chung chung.
 */
export function QueryErrorResult({
  error,
  onRetry,
  onBack,
  missing,
  notFound,
  size,
  className,
}: QueryErrorResultProps) {
  const navigate = useNavigate();
  const appError: AppError =
    error !== undefined && error !== null
      ? parseApiError(error)
      : parseApiError({ response: { status: missing ? 404 : 0 } });
  const base = resolveErrorResult(appError, {
    onRetry: appError.kind === "not_found" ? undefined : onRetry,
    onLogin: () => navigate(AUTH_PATHS.LOGIN),
  });
  const extra = appError.kind === "not_found" ? notFound : undefined;
  return (
    <MusicResult
      {...base}
      {...extra}
      size={size}
      className={className}
      onBack={onBack ?? base.onBack}
    />
  );
}

/**
 * Thứ tự: loading -> offline chưa có data -> error -> empty -> children.
 * Thay cho logic `isLoading / !isOnline / isError` tự viết ở từng page.
 */
export function QueryState<T>({
  query,
  skeleton,
  isEmpty,
  empty,
  notFound,
  onBack,
  size = "lg",
  className,
  keepDataOnError = true,
  children,
}: QueryStateProps<T>) {
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const { data, isLoading, isError, error, fetchStatus, refetch } = query;
  const hasData = data !== undefined && data !== null;

  const retry = () => {
    void refetch();
  };

  if (isLoading) {
    return <>{skeleton ?? <LoadingState size={size} className={className} />}</>;
  }

  // Offline và chưa có dữ liệu để hiển thị (query bị tạm dừng bởi onlineManager)
  if (!hasData && (!online || fetchStatus === "paused")) {
    return (
      <MusicResult
        variant="error-network"
        size={size}
        className={className}
        onRetry={retry}
        onBack={onBack}
      />
    );
  }

  if (isError && !(keepDataOnError && hasData)) {
    const appError = parseApiError(error);
    const base = resolveErrorResult(appError, {
      onRetry: appError.kind === "not_found" ? undefined : retry,
      onLogin: () => navigate(AUTH_PATHS.LOGIN),
    });
    const extra = appError.kind === "not_found" ? notFound : undefined;
    return (
      <MusicResult
        {...base}
        {...extra}
        size={size}
        className={className}
        onBack={onBack ?? base.onBack}
      />
    );
  }

  if (hasData && isEmpty?.(data as T)) {
    const { variant = "empty", ...rest } = empty ?? {};
    return <MusicResult variant={variant} size={size} className={className} {...rest} />;
  }

  // Query đã xong nhưng không có data (vd: enabled=false) -> không render gì
  if (!hasData && typeof children === "function") return null;

  return <>{typeof children === "function" ? children(data as T) : children}</>;
}

export default QueryState;
