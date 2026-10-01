import { Request, Response, NextFunction } from "express";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import logger from "../config/logger";
import { redactLogValue } from "../utils/logRedact";
import { clearRefreshTokenCookie } from "../utils/token";
import { isDev } from "../config/env";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let { statusCode, message, errorCode } = err; // <-- Lấy thêm errorCode

  // Nếu lỗi không phải là ApiError (VD: Lỗi cú pháp code, lỗi mongo...), mặc định là 500
  if (!(err instanceof ApiError)) {
    statusCode = statusCode || httpStatus.INTERNAL_SERVER_ERROR;
    message = message || "Internal Server Error";
  }
  if (err.errorCode === "ACCOUNT_LOCKED") {
    clearRefreshTokenCookie(res);
  }
  const response = {
    success: false, // Thêm cờ này cho chuẩn format
    code: statusCode,
    errorCode: errorCode, // <-- Trả về cho Frontend dùng (quan trọng)
    message,
    ...(err.errors && { errors: err.errors }), // Thêm chi tiết lỗi nếu có
    ...(err.data && { data: err.data }), // Thêm custom data (VD: providers)
    ...(isDev() && { stack: err.stack }),
  };

  if (isDev()) {
    logger.error("Request failed", { err: redactLogValue(err) });
  }

  res.status(statusCode).json(response);
};
