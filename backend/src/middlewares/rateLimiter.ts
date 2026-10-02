import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { cacheRedis } from "../config/redis";
import httpStatus from "http-status";

function redisStore(prefix: string) {
  return new RedisStore({
    // @ts-expect-error - ioredis call() matches the RedisStore command client
    sendCommand: (...args: string[]) => cacheRedis.call(...args),
    prefix,
  });
}

/**
 * 1. API LIMITER CHUNG
 * Production shares one counter per IP across Fly machines.
 * Other environments keep the counter in this process. A shared Upstash key
 * survives nodemon restarts, and the liveness test fills `rl:api:127.0.0.1`,
 * so every local API call stays 429 until that 15-minute key expires.
 */
const apiLimitStore =
  process.env.NODE_ENV === "production"
    ? { store: redisStore("rl:api:"), passOnStoreError: true as const }
    : {};

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  ...apiLimitStore,
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
  store: redisStore("rl:auth:"),
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    res.status(httpStatus.TOO_MANY_REQUESTS).json({
      code: httpStatus.TOO_MANY_REQUESTS,
      message: "Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút.",
    });
  },
});

/**
 * 3. OTP LIMITER
 */
export const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore("rl:otp:"),
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
  store: redisStore("rl:interaction:"),
  // Định danh theo userId nếu đã login, nếu không thì dùng IP
  keyGenerator: (req: any) => {
    if (req.user?._id) return `user:${req.user._id}`;
    return `ip:${ipKeyGenerator(req)}`;
  },
  handler: (req, res) => {
    res.status(httpStatus.TOO_MANY_REQUESTS).json({
      code: httpStatus.TOO_MANY_REQUESTS,
      message:
        "Thao tác quá nhanh! Vui lòng đợi một chút để tiếp tục tương tác.",
    });
  },
});
