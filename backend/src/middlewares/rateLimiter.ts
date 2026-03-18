import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { cacheRedis } from "../config/redis";
import httpStatus from "http-status";

/**
 * 1. API LIMITER CHUNG
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    code: 429,
    message: "Quá nhiều request từ IP này, vui lòng thử lại sau 15 phút.",
  },
});

/**
 * 2. AUTH LIMITER
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(httpStatus.TOO_MANY_REQUESTS).json({
      code: httpStatus.TOO_MANY_REQUESTS,
      message: "Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút.",
    });
  },
  skipSuccessfulRequests: true,
});

/**
 * 3. OTP LIMITER
 */
export const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(httpStatus.TOO_MANY_REQUESTS).json({
      code: httpStatus.TOO_MANY_REQUESTS,
      message: "Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau 1 giờ.",
    });
  },
});

/**
 * 4. INTERACTION LIMITER (Mới thêm - Dành cho Like/Follow)
 * Mục đích: Chống spam "Ting ting" thông báo và bảo vệ tài nguyên Redis/DB.
 */
export const interactionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 phút
  max: 30, // Cho phép 30 lần tương tác (Like/Follow) mỗi phút
  standardHeaders: true,
  legacyHeaders: false,
  // 🚀 TỐI ƯU: Lưu số lần đếm vào Redis thay vì bộ nhớ RAM của Node.js
  store: new RedisStore({
    // @ts-expect-error - ioredis compatibility
    sendCommand: (...args: string[]) => cacheRedis.call(...args),
    prefix: "rl:interaction:",
  }),
  // Định danh theo userId nếu đã login, nếu không thì dùng IP
  keyGenerator: (req: any) => req.user?._id?.toString() || req.ip,
  handler: (req, res) => {
    res.status(httpStatus.TOO_MANY_REQUESTS).json({
      code: httpStatus.TOO_MANY_REQUESTS,
      message:
        "Thao tác quá nhanh! Vui lòng đợi một chút để tiếp tục tương tác.",
    });
  },
});
