import { ERROR_CODES } from "@/config/errorCodes";

export type AppErrorKind =
  | "network"
  | "timeout"
  | "canceled"
  | "offline"
  | "unauthorized"
  | "forbidden"
  | "locked"
  | "not_found"
  | "validation"
  | "conflict"
  | "too_large"
  | "rate_limited"
  | "server"
  | "starting"
  | "unknown";

export interface FieldError {
  field: string;
  message: string;
}

export interface AppError {
  kind: AppErrorKind;
  status?: number;
  errorCode?: string;
  message: string;
  fieldErrors: FieldError[];
  data?: unknown;
  /** Thử lại có khả năng thành công (mạng, timeout, server, đang khởi động, rate limit) */
  retryable: boolean;
}

export const DEFAULT_MESSAGES: Record<AppErrorKind, string> = {
  network: "Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.",
  timeout: "Máy chủ phản hồi quá lâu. Vui lòng thử lại.",
  canceled: "Yêu cầu đã bị hủy.",
  offline: "Bạn đang offline. Vui lòng kiểm tra kết nối internet.",
  unauthorized: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  forbidden: "Bạn không có quyền thực hiện thao tác này.",
  locked: "Tài khoản của bạn đã bị khóa.",
  not_found: "Không tìm thấy nội dung bạn yêu cầu.",
  validation: "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.",
  conflict: "Dữ liệu đã tồn tại hoặc đang xung đột.",
  too_large: "Tệp hoặc dữ liệu vượt quá dung lượng cho phép.",
  rate_limited: "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.",
  server: "Máy chủ đang gặp sự cố. Vui lòng thử lại sau.",
  starting: "Hệ thống đang khởi động. Vui lòng thử lại sau ít giây.",
  unknown: "Đã có lỗi xảy ra. Vui lòng thử lại.",
};

const RETRYABLE: ReadonlySet<AppErrorKind> = new Set([
  "network",
  "timeout",
  "offline",
  "rate_limited",
  "server",
  "starting",
]);

function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function kindFromStatus(
  status: number,
  errorCode: string | undefined,
  hasFieldErrors: boolean,
): AppErrorKind {
  if (errorCode === ERROR_CODES.ACCOUNT_LOCKED) return "locked";
  if (errorCode === ERROR_CODES.SERVICE_STARTING) return "starting";
  if (errorCode === ERROR_CODES.RATE_LIMITED) return "rate_limited";
  if (errorCode === ERROR_CODES.FILE_TOO_LARGE) return "too_large";
  if (errorCode === ERROR_CODES.VALIDATION_ERROR || hasFieldErrors) {
    return "validation";
  }
  switch (status) {
    case 400:
    case 422:
      return "validation";
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 408:
    case 504:
      return "timeout";
    case 409:
      return "conflict";
    case 413:
      return "too_large";
    case 429:
      return "rate_limited";
    default:
      return status >= 500 ? "server" : "unknown";
  }
}

function build(kind: AppErrorKind, partial: Partial<AppError> = {}): AppError {
  return {
    kind,
    message: partial.message || DEFAULT_MESSAGES[kind],
    fieldErrors: partial.fieldErrors ?? [],
    retryable: RETRYABLE.has(kind),
    status: partial.status,
    errorCode: partial.errorCode,
    data: partial.data,
  };
}

/** Body JSON từ backend hoặc payload `rejectWithValue` của Redux thunk. */
function isApiErrorBody(body: unknown): body is {
  success?: boolean;
  code?: number;
  errorCode?: string;
  message?: string;
  errors?: unknown;
  data?: unknown;
} {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.errorCode === "string" ||
    b.success === false ||
    (typeof b.message === "string" && typeof b.code === "number")
  );
}

/**
 * Chuẩn hóa mọi lỗi (AxiosError, Error thường, string...) về `AppError`.
 * Ưu tiên message tiếng Việt từ backend; nếu không có thì dùng câu mặc định theo `kind`.
 */
export function parseApiError(err: unknown): AppError {
  if (err && typeof err === "object" && "kind" in err && "fieldErrors" in err) {
    return err as AppError; // đã được parse
  }

  const e = err as any;

  if (
    e?.isCanceled ||
    e?.code === "ERR_CANCELED" ||
    e?.name === "CanceledError" ||
    e?.name === "AbortError"
  ) {
    return build("canceled");
  }

  const response = e?.response;
  const rawBody = response?.data;
  const body = isApiErrorBody(rawBody)
    ? rawBody
    : !response && isApiErrorBody(e)
      ? e
      : rawBody;

  if (!response && !isApiErrorBody(e)) {
    if (e?.code === "ECONNABORTED" || e?.code === "ETIMEDOUT") {
      return build(isBrowserOffline() ? "offline" : "timeout");
    }
    if (isBrowserOffline()) return build("offline");
    if (e?.code === "ERR_NETWORK" || e?.request) return build("network");
    return build("unknown");
  }

  const status: number =
    response?.status ?? (typeof body?.code === "number" ? body.code : 0);
  const isJson = body !== null && typeof body === "object";

  const errorCode: string | undefined = isJson ? body.errorCode : undefined;
  const fieldErrors: FieldError[] =
    isJson && Array.isArray(body.errors)
      ? body.errors
          .filter((x: any) => x && typeof x === "object" && x.field)
          .map((x: any) => ({
            // Zod ở backend trả path dạng "body.title" -> chuẩn hóa về "title"
            field: String(x.field).replace(/^(body|query|params)\./, ""),
            message: String(x.message ?? ""),
          }))
      : [];

  const kind = kindFromStatus(status, errorCode, fieldErrors.length > 0);
  // Body không phải JSON (HTML từ proxy/gateway) -> dùng câu mặc định
  const serverMessage =
    isJson && typeof body.message === "string" && body.message.trim()
      ? body.message
      : undefined;

  return build(kind, {
    status,
    errorCode,
    message: serverMessage,
    fieldErrors,
    data: isJson ? body.data : undefined,
  });
}

export const isNotFoundError = (err: unknown) =>
  parseApiError(err).kind === "not_found";
