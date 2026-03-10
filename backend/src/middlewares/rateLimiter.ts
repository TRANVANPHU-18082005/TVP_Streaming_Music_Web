import rateLimit from "express-rate-limit";
import httpStatus from "http-status";

/**
 * 1. API LIMITER CHUNG (Code cũ của bạn)
 * Áp dụng cho toàn bộ các route bắt đầu bằng /api
 * Mục đích: Chống DDOS nhẹ, ngăn crawl dữ liệu quá nhanh.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100, // Giới hạn 100 request
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 429,
    message: "Quá nhiều request từ IP này, vui lòng thử lại sau 15 phút.",
  },
});

/**
 * 2. AUTH LIMITER (Nghiêm ngặt vừa phải)
 * Áp dụng cho: Login, Register
 * Mục đích: Chống Brute-force password.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10, // Chỉ cho sai 10 lần mỗi IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(httpStatus.TOO_MANY_REQUESTS).json({
      code: httpStatus.TOO_MANY_REQUESTS,
      message: "Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút.",
    });
  },
  // Tùy chọn: Nếu đăng nhập thành công thì không tính vào giới hạn
  // Giúp user thật không bị chặn oan nếu họ nhớ ra pass
  skipSuccessfulRequests: true,
});

/**
 * 3. OTP LIMITER (Rất nghiêm ngặt)
 * Áp dụng cho: Resend OTP, Forgot Password
 * Mục đích: Chống Spam email/SMS, tiết kiệm chi phí hệ thống.
 */
export const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 3, // Chỉ cho gửi 3 lần mỗi giờ
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(httpStatus.TOO_MANY_REQUESTS).json({
      code: httpStatus.TOO_MANY_REQUESTS,
      message: "Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau 1 giờ.",
    });
  },
});
