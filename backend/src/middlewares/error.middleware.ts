import { Request, Response, NextFunction } from "express";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let { statusCode, message, errorCode } = err; // <-- Lấy thêm errorCode

  // Nếu lỗi không phải là ApiError (VD: Lỗi cú pháp code, lỗi mongo...), mặc định là 500
  if (!(err instanceof ApiError)) {
    statusCode = statusCode || httpStatus.INTERNAL_SERVER_ERROR;
    message = message || "Internal Server Error";
  }
  if (err.errorCode === "ACCOUNT_LOCKED" || err.message?.includes("khóa")) {
    res.clearCookie("refreshToken"); // <--- THÊM DÒNG NÀY
  }
  const response = {
    success: false, // Thêm cờ này cho chuẩn format
    code: statusCode,
    errorCode: errorCode, // <-- Trả về cho Frontend dùng (quan trọng)
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  };

  // Log lỗi ra console nếu là dev
  if (process.env.NODE_ENV === "development") {
    console.error("💥 ERROR:", err);
  }

  res.status(statusCode).json(response);
};
