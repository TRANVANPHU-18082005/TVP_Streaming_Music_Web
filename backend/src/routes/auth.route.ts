import express from "express";
import passport from "passport";
import * as authController from "../controllers/auth.controller";
import { protect } from "../middlewares/auth.middleware";
import validate from "../middlewares/validate"; // Middleware quan trọng nhất
import { authLimiter, otpLimiter } from "../middlewares/rateLimiter";
import { requireSameOrigin } from "../middlewares/csrf.middleware";
import config from "../config/env";

// Import Zod Schemas (Đã define ở các bước trước)
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validations/auth.validation";

const router = express.Router();

// ==========================================
// 1. SOCIAL AUTH (Google & Facebook)
// ==========================================
router.get("/google", authController.googleAuth);

router.get("/google/callback", (req: any, res: any, next: any) => {
  console.log("[DEBUG] Google callback query:", req.query);

  // 1. Kiểm tra nếu người dùng chủ động bấm Hủy / Từ chối cấp quyền từ Google
  if (
    req.query.error === "access_denied" ||
    req.query.error === "user_cancelled" ||
    req.query.error === "consent_required"
  ) {
    console.warn("[WARN] Google login cancelled by user.");
    return res.redirect(`${config.clientUrl}/login?error=OAUTH_USER_CANCELLED&provider=google`);
  }

  // 2. Kiểm tra các lỗi khác trả về từ nhà cung cấp Google
  if (req.query.error) {
    console.error("[ERROR] Google provider error:", req.query.error, req.query.error_description);
    return res.redirect(
      `${config.clientUrl}/login?error=OAUTH_PROVIDER_ERROR&provider=google&reason=${encodeURIComponent(
        req.query.error_description || req.query.error || "Lỗi từ Google"
      )}`
    );
  }

  // 3. Trao đổi token và xác thực qua Passport
  passport.authenticate(
    "google",
    {
      session: false,
      failureRedirect: `${config.clientUrl}/login?error=OAUTH_ERROR&provider=google`,
    },
    (err: any, user: any, info: any) => {
      if (err) {
        console.error("[ERROR] Google auth error:", err);
        const errorCode =
          err.errorCode || (err.name === "TokenError" ? "OAUTH_TOKEN_EXCHANGE_FAILED" : "OAUTH_ERROR");
        const reason = err.message || "Xác thực Google thất bại";
        return res.redirect(
          `${config.clientUrl}/login?error=${encodeURIComponent(errorCode)}&provider=google&reason=${encodeURIComponent(reason)}`
        );
      }

      if (!user) {
        return res.redirect(
          `${config.clientUrl}/login?error=OAUTH_ERROR&provider=google&reason=${encodeURIComponent(
            "Không thể xác thực thông tin tài khoản Google"
          )}`
        );
      }

      req.user = user;
      return authController.googleCallbackHandler(req, res);
    }
  )(req, res, next);
});

// Facebook Social Auth
router.get("/facebook", authController.facebookAuth);

router.get("/facebook/callback", (req: any, res: any, next: any) => {
  console.log("[DEBUG] Facebook callback query:", req.query);

  // 1. Kiểm tra nếu người dùng chủ động bấm Hủy / Từ chối cấp quyền từ Facebook
  if (
    req.query.error === "access_denied" ||
    req.query.error_reason === "user_denied" ||
    req.query.error === "user_cancelled" ||
    String(req.query.error_code) === "200"
  ) {
    console.warn("[WARN] Facebook login cancelled by user.");
    return res.redirect(`${config.clientUrl}/login?error=OAUTH_USER_CANCELLED&provider=facebook`);
  }

  // 2. Kiểm tra các lỗi khác trả về từ nhà cung cấp Facebook
  if (req.query.error) {
    console.error("[ERROR] Facebook provider error:", req.query.error, req.query.error_description);
    return res.redirect(
      `${config.clientUrl}/login?error=OAUTH_PROVIDER_ERROR&provider=facebook&reason=${encodeURIComponent(
        req.query.error_description || req.query.error || "Lỗi từ Facebook"
      )}`
    );
  }

  // 3. Trao đổi token và xác thực qua Passport (Custom callback)
  passport.authenticate(
    "facebook",
    {
      session: false,
      failureRedirect: `${config.clientUrl}/login?error=OAUTH_ERROR&provider=facebook`,
    },
    (err: any, user: any, info: any) => {
      if (err) {
        console.error("[ERROR] Facebook auth error:", err);
        const errorCode =
          err.errorCode || (err.name === "TokenError" ? "OAUTH_TOKEN_EXCHANGE_FAILED" : "OAUTH_ERROR");
        const reason = err.message || "Xác thực Facebook thất bại";
        return res.redirect(
          `${config.clientUrl}/login?error=${encodeURIComponent(errorCode)}&provider=facebook&reason=${encodeURIComponent(reason)}`
        );
      }

      if (!user) {
        return res.redirect(
          `${config.clientUrl}/login?error=OAUTH_ERROR&provider=facebook&reason=${encodeURIComponent(
            "Không thể xác thực thông tin tài khoản Facebook"
          )}`
        );
      }

      req.user = user;
      return authController.facebookCallbackHandler(req, res);
    }
  )(req, res, next);
});

// ==========================================
// 2. SOCIAL AUTH EXCHANGE
// ==========================================
router.post("/social/exchange", authController.exchangeSocialCode);

// ==========================================
// 3. AUTHENTICATION (Rate Limit + Validation)
// ==========================================

// Register: Giới hạn request + Validate Body
router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  authController.register,
);

// Login: Giới hạn request + Validate Body
router.post("/login", authLimiter, validate(loginSchema), authController.login);

// Verify Email (OTP)
// Validate query (nếu link) hoặc body (nếu form) tùy FE
router.post(
  "/verify-email",
  validate(verifyEmailSchema),
  authController.verifyEmail,
);

// Refresh Token
router.post(
  "/refresh-token",
  // enforce origin/referrer check (production only) to mitigate CSRF
  requireSameOrigin,
  // validate(refreshTokenSchema),
  authController.refreshAccessToken,
);

// Logout (also protected by origin check to reduce CSRF risk for cookie-based logout)
router.post("/logout", requireSameOrigin, authController.logout);

// ==========================================
// 4. PASSWORD & OTP MANAGEMENT
// ==========================================

// Resend OTP: Rate Limit chặt hơn (otpLimiter)
router.post("/resend-otp", otpLimiter, authController.resendOtp);

// Forgot Password
router.post(
  "/forgot-password",
  otpLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);

// Reset Password — Hỗ trợ cả /reset-password (token trong body) và /reset-password/:token (token trên URL)
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  authController.resetPassword,
);
router.post(
  "/reset-password/:token",
  validate(resetPasswordSchema),
  authController.resetPassword,
);

// ==========================================
// 5. USER INFO
// ==========================================
router.get("/me", protect, authController.getMe);

// ==========================================
// 6. IDENTITY LINKING (Enterprise Standard)
// ==========================================
router.get("/identities", protect, authController.getIdentities);
router.post("/link-provider", protect, authController.linkProvider);
router.delete("/unlink-provider/:provider", protect, authController.unlinkProvider);

export default router;
