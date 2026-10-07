import { Request, Response, NextFunction } from "express";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import logger from "../config/logger";
import { redactLogValue } from "../utils/logRedact";
import { clearRefreshTokenCookie } from "../utils/token";
import { isDev } from "../config/env";

export interface NormalizedError {
  statusCode: number;
  message: string;
  errorCode?: string;
  errors?: Array<{ field: string; message: string }>;
  data?: unknown;
}

const INTERNAL_MESSAGE = "Lỗi máy chủ, vui lòng thử lại sau.";

/**
 * Chuẩn hóa mọi loại lỗi (ApiError, Mongoose, Multer, body-parser, CORS...)
 * về một dạng thống nhất để Frontend dựa vào `errorCode`.
 * `hideInternal`: ẩn message kỹ thuật của lỗi 500 không lường trước (production).
 */
export function normalizeError(err: any, hideInternal: boolean): NormalizedError {
  if (err instanceof ApiError) {
    return {
      statusCode: err.statusCode,
      message: err.message,
      errorCode: err.errorCode,
      errors: err.errors,
      data: err.data,
    };
  }

  // Mongoose: ObjectId sai định dạng
  if (err?.name === "CastError") {
    return {
      statusCode: httpStatus.BAD_REQUEST,
      message: "ID không hợp lệ",
      errorCode: "INVALID_ID",
    };
  }

  // Mongoose: validation schema
  if (err?.name === "ValidationError" && err?.errors) {
    const errors = Object.values(err.errors as Record<string, any>).map(
      (e: any) => ({
        field: String(e?.path ?? ""),
        message: String(e?.message ?? "Giá trị không hợp lệ"),
      }),
    );
    return {
      statusCode: httpStatus.BAD_REQUEST,
      message: "Dữ liệu không hợp lệ",
      errorCode: "VALIDATION_ERROR",
      errors,
    };
  }

  // Mongo: duplicate key
  if (err?.code === 11000) {
    const keys = Object.keys(err.keyPattern ?? err.keyValue ?? {});
    return {
      statusCode: httpStatus.CONFLICT,
      message: "Dữ liệu đã tồn tại",
      errorCode: "DUPLICATE_RESOURCE",
      ...(keys.length && {
        errors: keys.map((field) => ({ field, message: "Giá trị đã tồn tại" })),
      }),
    };
  }

  // Multer
  if (err?.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return {
        statusCode: httpStatus.REQUEST_ENTITY_TOO_LARGE,
        message: "Tệp tải lên vượt quá dung lượng cho phép",
        errorCode: "FILE_TOO_LARGE",
      };
    }
    return {
      statusCode: httpStatus.BAD_REQUEST,
      message: "Tệp tải lên không hợp lệ",
      errorCode: "UPLOAD_ERROR",
    };
  }

  // body-parser (express.json / urlencoded)
  if (err?.type === "entity.too.large") {
    return {
      statusCode: httpStatus.REQUEST_ENTITY_TOO_LARGE,
      message: "Dữ liệu gửi lên quá lớn",
      errorCode: "PAYLOAD_TOO_LARGE",
    };
  }
  if (err?.type === "entity.parse.failed") {
    return {
      statusCode: httpStatus.BAD_REQUEST,
      message: "Dữ liệu gửi lên không hợp lệ",
      errorCode: "INVALID_JSON",
    };
  }

  // CORS
  if (err?.message === "Not allowed by CORS") {
    return {
      statusCode: httpStatus.FORBIDDEN,
      message: "Nguồn truy cập không được phép",
      errorCode: "CORS_NOT_ALLOWED",
    };
  }

  const statusCode: number = err?.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
  const isServerError = statusCode >= 500;
  return {
    statusCode,
    message:
      isServerError && hideInternal
        ? INTERNAL_MESSAGE
        : err?.message || "Internal Server Error",
    errorCode: err?.errorCode ?? (isServerError ? "INTERNAL_ERROR" : undefined),
    errors: err?.errors,
    data: err?.data,
  };
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (res.headersSent) return next(err);

  if (err?.errorCode === "ACCOUNT_LOCKED") {
    clearRefreshTokenCookie(res);
  }

  const { statusCode, message, errorCode, errors, data } = normalizeError(
    err,
    !isDev(),
  );

  const response = {
    success: false, // Thêm cờ này cho chuẩn format
    code: statusCode,
    errorCode, // Trả về cho Frontend dùng (quan trọng)
    message,
    ...(errors && { errors }), // Thêm chi tiết lỗi nếu có
    ...(data !== undefined && data !== null && { data }), // Thêm custom data (VD: providers)
    ...(isDev() && { stack: err?.stack }),
  };

  if (isDev()) {
    logger.error("Request failed", { err: redactLogValue(err) });
  }

  res.status(statusCode).json(response);
};

/** JSON 404 cho /api/* không tồn tại (đặt sau khi mount routes, trước errorHandler). */
export const apiNotFound = (req: Request, _res: Response, next: NextFunction) => {
  next(
    new ApiError(
      httpStatus.NOT_FOUND,
      "Không tìm thấy API",
      "ROUTE_NOT_FOUND",
    ),
  );
};
