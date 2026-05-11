import express from "express";
import passport from "passport";
import * as authController from "../controllers/auth.controller";
import { protect } from "../middlewares/auth.middleware";
import validate from "../middlewares/validate"; // Middleware quan trọng nhất
import { authLimiter, otpLimiter } from "../middlewares/rateLimiter";
import { requireSameOrigin } from "../middlewares/csrf.middleware";

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
// 1. SOCIAL AUTH (Google)
// ==========================================
router.get("/google", authController.googleAuth);

router.get("/google/callback", (req: any, res: any, next: any) => {
  // Log incoming query for debugging (code, state, hd, authuser, etc.)
  console.log("[DEBUG] Google callback query:", req.query);

  // Use custom callback to capture passport/oAuth errors (token exchange)
  passport.authenticate(
    "google",
    {
      session: false,
      failureRedirect: `${process.env.CLIENT_URL}/login?error=auth_failed`,
    },
    (err: any, user: any, info: any) => {
      if (err) {
        // Log detailed error info to help diagnose TokenError: Bad Request
        console.error("[ERROR] Google auth error:", err);
        if (err.statusCode) console.error("[ERROR] statusCode:", err.statusCode);
        if (err.data) console.error("[ERROR] data:", err.data);

        // Forward to client with generic failure (avoid leaking secrets)
        return res.redirect(
          `${process.env.CLIENT_URL}/login?error=auth_failed&reason=${encodeURIComponent(
            err.message || "oauth_error",
          )}`,
        );
      }

      // Attach user and continue to controller handler
      req.user = user;
      return authController.googleCallbackHandler(req, res);
    },
  )(req, res, next);
});

// Facebook Social Auth
router.get("/facebook", authController.facebookAuth);

router.get(
  "/facebook/callback",
  passport.authenticate("facebook", {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login?error=auth_failed`,
  }),
  authController.facebookCallbackHandler,
);

// ==========================================
// 2. AUTHENTICATION (Rate Limit + Validation)
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
  // validate(verifyEmailSchema), // Bật lên nếu schema khớp với body
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
// 3. PASSWORD & OTP MANAGEMENT
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

// Reset Password
// Lưu ý: Token nên gửi trong BODY để an toàn, nhưng nếu bạn thích để trên URL thì controller phải hỗ trợ req.params
router.post(
  "/reset-password", // Hoặc "/reset-password/:token" nếu thích kiểu cũ
  validate(resetPasswordSchema),
  authController.resetPassword,
);

// ==========================================
// 4. USER INFO
// ==========================================
router.get("/me", protect, authController.getMe);

export default router;
