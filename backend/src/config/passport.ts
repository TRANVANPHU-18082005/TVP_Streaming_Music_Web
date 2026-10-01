import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import config from "./env";
import AuthService from "../services/auth.service"; // Import Service chúng ta vừa viết
import logger from "./logger";

// Google is optional. requiredInProd does not include these keys, and local
// login works without them. Register the strategy only when both are set so
// a missing env cannot throw before the process listens.
if (config.googleOAuthEnabled) {
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
        logger.info("Google profile received", { providerId: profile.id });

        try {
          // 3. Gọi Service để xử lý logic nghiệp vụ (Tìm, Tạo, hoặc Gộp tài khoản)
          const user = await AuthService.loginWithGoogle(profile);

          logger.info("Google auth success", { userId: String(user._id) });

          // 4. Trả user về cho Controller (googleCallbackHandler)
          return done(null, user);
        } catch (error) {
          logger.error("Google auth error", {
            name: error instanceof Error ? error.name : "Error",
            message:
              error instanceof Error ? error.message : "Google auth failed",
          });
          return done(error, undefined);
        }
      },
    ),
  );
} else {
  logger.warn(
    "GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set; Google login disabled",
  );
}

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
        logger.info("Facebook profile received", { providerId: profile.id });

        try {
          const user = await AuthService.loginWithFacebook(profile);

          logger.info("Facebook auth success", { userId: String(user._id) });

          return done(null, user);
        } catch (error) {
          logger.error("Facebook auth error", {
            name: error instanceof Error ? error.name : "Error",
            message:
              error instanceof Error ? error.message : "Facebook auth failed",
          });
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
