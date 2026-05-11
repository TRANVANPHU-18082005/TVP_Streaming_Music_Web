import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import config from "./env";
import AuthService from "../services/auth.service"; // Import Service chúng ta vừa viết
import logger from "./logger";

// 2. Kiểm tra an toàn (Fail Fast)
if (!config.googleClientId || !config.googleClientSecret) {
  throw new Error(
    "❌ Thiếu GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET trong cấu hình",
  );
}
passport.use(
  new GoogleStrategy(
    {
      clientID: config.googleClientId,
      clientSecret: config.googleClientSecret,
      // URL này phải khớp y hệt những gì bạn đăng ký trên Google Console
      callbackURL: config.googleCallbackUrl || "/api/auth/google/callback",
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
if (config.facebookAppId && config.facebookAppSecret) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: config.facebookAppId,
        clientSecret: config.facebookAppSecret,
        callbackURL: config.facebookCallbackUrl || "/api/auth/facebook/callback",
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
