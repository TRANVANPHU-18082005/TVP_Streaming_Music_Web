import { toast } from "sonner";
import { parseApiError, type AppError } from "@/utils/apiError";

const NETWORK_TOAST_ID = "network-error";

/**
 * Toast lỗi thống nhất. Giữ chữ ký cũ `handleError(err, defaultMessage)`.
 * - Bỏ qua request bị hủy.
 * - Lỗi mạng / offline gom thành một toast duy nhất (không spam).
 * - Lỗi có message từ backend: dùng message đó, nếu không dùng `defaultMessage`.
 * Trả về `AppError` để caller có thể xử lý tiếp (vd: gán lỗi vào form).
 */
export const handleError = (err: unknown, defaultMessage: string): AppError => {
  const appError = parseApiError(err);

  if (appError.kind === "canceled") return appError;

  if (appError.kind === "network" || appError.kind === "offline") {
    toast.error(appError.message, { id: NETWORK_TOAST_ID });
    return appError;
  }

  // Lỗi không xác định và không có phản hồi từ server: dùng message mặc định của caller.
  // Còn lại ưu tiên message từ server / câu mặc định theo loại lỗi.
  const useCaller =
    appError.kind === "unknown" && appError.status === undefined && !!defaultMessage;
  toast.error(useCaller ? defaultMessage : appError.message);
  return appError;
};
