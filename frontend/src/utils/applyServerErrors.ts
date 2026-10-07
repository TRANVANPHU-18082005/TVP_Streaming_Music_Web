import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { parseApiError, type AppError } from "@/utils/apiError";

export interface ApplyServerErrorsOptions {
  /**
   * Map tên field của backend -> tên field của form
   * (vd: { password: "newPassword" }). Field không có trong map giữ nguyên.
   */
  fieldMap?: Record<string, string>;
  /** Danh sách field hợp lệ của form. Field lạ sẽ được đưa vào root.serverError. */
  knownFields?: ReadonlyArray<string>;
  /** Focus vào field lỗi đầu tiên */
  shouldFocus?: boolean;
}

export interface ApplyServerErrorsResult {
  appError: AppError;
  /** true nếu có ít nhất một lỗi được gán vào field cụ thể */
  handledFields: boolean;
  /** Message cần hiển thị chung (toast / banner) khi không gán được vào field */
  rootMessage?: string;
}

/**
 * Gán lỗi VALIDATION_ERROR của backend (`errors: [{ field, message }]`) vào react-hook-form.
 * Lỗi không gắn được vào field nào (hoặc không phải validation) được đưa vào
 * `root.serverError` và trả về trong `rootMessage` để caller toast / hiển thị.
 */
export function applyServerErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  options: ApplyServerErrorsOptions = {},
): ApplyServerErrorsResult {
  const appError = parseApiError(err);
  const { fieldMap = {}, knownFields, shouldFocus = true } = options;

  let handledFields = false;
  const orphanMessages: string[] = [];

  for (const { field, message } of appError.fieldErrors) {
    const name = fieldMap[field] ?? field;
    const isKnown = !knownFields || knownFields.includes(name.split(".")[0]);
    if (isKnown) {
      setError(
        name as Path<T>,
        { type: "server", message },
        { shouldFocus: shouldFocus && !handledFields },
      );
      handledFields = true;
    } else {
      orphanMessages.push(message);
    }
  }

  if (appError.kind === "canceled") return { appError, handledFields };

  // Không có lỗi theo field (vd: 401 sai mật khẩu, 429, mất mạng) hoặc field lạ
  if (!handledFields || orphanMessages.length > 0) {
    const rootMessage = orphanMessages.length
      ? orphanMessages.join(" ")
      : appError.message;
    setError("root.serverError" as Path<T>, {
      type: "server",
      message: rootMessage,
    });
    return { appError, handledFields, rootMessage };
  }

  return { appError, handledFields };
}
