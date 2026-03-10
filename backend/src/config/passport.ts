import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import AuthService from "../services/auth.service"; // Import Service chúng ta vừa viết

// 1. Load biến môi trường
dotenv.config();

// 2. Kiểm tra an toàn (Fail Fast)
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error(
    "❌ Thiếu GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET trong file .env"
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
      console.log("🔥 Google Profile Received:", profile.id);

      try {
        // 3. Gọi Service để xử lý logic nghiệp vụ (Tìm, Tạo, hoặc Gộp tài khoản)
        const user = await AuthService.loginWithGoogle(profile);

        console.log("✅ Google Auth Success for:", user.email);

        // 4. Trả user về cho Controller (googleCallbackHandler)
        return done(null, user);
      } catch (error) {
        console.error("❌ Google Auth Error:", error);
        return done(error, undefined);
      }
    }
  )
);

// Lưu ý: Vì chúng ta dùng JWT (session: false) nên không cần serializeUser/deserializeUser
