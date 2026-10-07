import type { NextFunction, Request, Response } from "express";
import { ROUTES_MOUNTED_KEY } from "../health/readiness";

/**
 * Trước khi `/api` routes được mount (server đã listen nhưng Mongo/Redis chưa
 * sẵn sàng), trả JSON 503 để Frontend hiển thị "đang khởi động" thay vì 404 HTML.
 * Không áp dụng cho /api/health và /api/ready (đã đăng ký trước middleware này).
 */
export const serviceStartingGuard = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.app.get(ROUTES_MOUNTED_KEY) === true) return next();
  res.set("Retry-After", "5");
  res.status(503).json({
    success: false,
    code: 503,
    errorCode: "SERVICE_STARTING",
    message: "Hệ thống đang khởi động, vui lòng thử lại sau ít giây.",
  });
};
