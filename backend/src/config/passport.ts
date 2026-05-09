import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import dotenv from "dotenv";
import AuthService from "../services/auth.service"; // Import Service chúng ta vừa viết
import logger from "./logger";

// 1. Load biến môi trường
dotenv.config();

// 2. Kiểm tra an toàn (Fail Fast)
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error(
    "❌ Thiếu GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET trong file .env",
  );
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // URL này phải khớp y hệt những gì bạn đăng ký trên Google Console
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
      passReqToCallback: true, // Để sau này có thể lấy req nếu cần
    },
    async (req, accessToken, refreshToken, profile, done) => {
      logger.info("Google Profile Received: %s", profile.id);

      try {
        // 3. Gọi Service để xử lý logic nghiệp vụ (Tìm, Tạo, hoặc Gộp tài khoản)
        const user = await AuthService.loginWithGoogle(profile);

        logger.info("Google Auth Success for: %s", user.email);

        // 4. Trả user về cho Controller (googleCallbackHandler)
        return done(null, user);
      } catch (error) {
        logger.error("Google Auth Error:", error);
        return done(error, undefined);
      }
    },
  ),
);

// Lưu ý: Vì chúng ta dùng JWT (session: false) nên không cần serializeUser/deserializeUser

// Facebook Strategy (optional; enable only if env vars present)
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL:
          process.env.FACEBOOK_CALLBACK_URL || "/api/auth/facebook/callback",
        profileFields: ["id", "emails", "name", "displayName", "photos"],
        passReqToCallback: true,
      },
      async (
        req: any,
        accessToken: any,
        refreshToken: any,
        profile: any,
        done: any,
      ) => {
        console.log("🔥 Facebook Profile Received:", profile.id);

        try {
          const user = await AuthService.loginWithFacebook(profile);

          console.log("✅ Facebook Auth Success for:", user.email);

          return done(null, user);
        } catch (error) {
          console.error("❌ Facebook Auth Error:", error);
          return done(error, undefined);
        }
      },
    ),
  );
} else {
  logger.warn(
    "FACEBOOK_APP_ID or FACEBOOK_APP_SECRET not set; Facebook login disabled",
  );
}
