import User from "../models/User";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import { generateTokens } from "../utils/token";
import { sendEmail } from "../utils/sendEmail";
import jwt from "jsonwebtoken";
import config from "../config/env";
import { generateUniqueSlug } from "../utils/slug";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import interactionService from "./interaction.service";
import { cacheRedis } from "../config/redis";

// Hash giả hợp lệ (cost 10) để chống Timing Attack
const DUMMY_HASH = "$2b$10$2b102b102b102b102b102uX/fakestringtofoolhacker...";

class AuthService {
  // --- HELPER: Session Management ---
  async saveSession(userId: string, refreshToken: string, rememberMe: boolean = false) {
    const hashedToken = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const ttl = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60; // 30 ngày hoặc 7 ngày (giây)
    await cacheRedis.setex(`session:${userId}:${hashedToken}`, ttl, "1");
  }

  async removeSession(userId: string, refreshToken: string) {
    const hashedToken = crypto.createHash("sha256").update(refreshToken).digest("hex");
    await cacheRedis.del(`session:${userId}:${hashedToken}`);
  }

  // --- HELPER: Tạo OTP 6 số ---
  private generateSecureOTP(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  // 1. Đăng ký
  async register(data: any) {
    const { fullName, email, password } = data;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.authProvider === "google") {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Dữ liệu không hợp lệ",
          "VALIDATION_ERROR",
          true,
          "",
          [{ field: "email", message: "Email này đã đăng ký bằng Google." }]
        );
      }
      throw new ApiError(
        httpStatus.BAD_REQUEST, 
        "Dữ liệu không hợp lệ",
        "VALIDATION_ERROR",
        true,
        "",
        [{ field: "email", message: "Email đã được sử dụng" }]
      );
    }

    const redisKey = `pending_reg:${email}`;
    const existingPendingStr = await cacheRedis.get(redisKey);
    if (existingPendingStr) {
      const existingPending = JSON.parse(existingPendingStr);
      const ONE_MINUTE = 60 * 1000;
      if (existingPending.lastOtpSentAt && Date.now() - existingPending.lastOtpSentAt < ONE_MINUTE) {
        throw new ApiError(
          httpStatus.TOO_MANY_REQUESTS,
          "Vui lòng đợi 1 phút trước khi đăng ký lại",
        );
      }
    }

    const otp = this.generateSecureOTP();
    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

    const pendingUser = {
      fullName,
      email,
      password,
      otp: hashedOTP,
      lastOtpSentAt: Date.now()
    };

    await cacheRedis.setex(redisKey, 900, JSON.stringify(pendingUser)); // 15 phút

    // Fire & Forget email
    sendEmail(
      email,
      "🎵 Xác thực tài khoản MusicHub",
      `
  <div style="
    background:#0f0f0f;
    padding:40px 20px;
    font-family:Arial,sans-serif;
    color:#fff;
  ">
    <div style="
      max-width:500px;
      margin:auto;
      background:#181818;
      border-radius:20px;
      overflow:hidden;
      border:1px solid #2a2a2a;
      box-shadow:0 0 30px rgba(0,255,200,0.15);
    ">
      
      <div style="
        background:linear-gradient(135deg,#00ffcc,#7c3aed);
        padding:30px;
        text-align:center;
      ">

        <!-- LOGO -->
        <img
          src="https://res.cloudinary.com/dc5rfjnn5/image/upload/v1770807338/LOGO_o4n02n.png"
          alt="MusicHub Logo"
          width="90"
          style="
            margin-bottom:16px;
            border-radius:20px;
          "
        />

        <h1 style="
          margin:0;
          font-size:32px;
          color:white;
        ">
          🎧 MusicHub
        </h1>

        <p style="
          margin-top:10px;
          color:rgba(255,255,255,0.9);
        ">
          Đắm chìm trong âm nhạc
        </p>
      </div>

      <div style="padding:35px;">
        <h2 style="
          margin-top:0;
          color:#ffffff;
          text-align:center;
        ">
          Mã xác thực của bạn
        </h2>

        <p style="
          color:#b3b3b3;
          text-align:center;
          line-height:1.6;
        ">
          Sử dụng mã OTP bên dưới để hoàn tất đăng ký tài khoản.
        </p>

        <div style="
          margin:30px auto;
          width:fit-content;
          background:#0f0f0f;
          border:2px dashed #00ffcc;
          border-radius:16px;
          padding:20px 40px;
        ">
          <span style="
            font-size:40px;
            font-weight:bold;
            letter-spacing:8px;
            color:#00ffcc;
          ">
            ${otp}
          </span>
        </div>

        <p style="
          color:#777;
          text-align:center;
          font-size:14px;
        ">
          OTP sẽ hết hạn sau 15 phút.
        </p>
      </div>

      <div style="
        border-top:1px solid #2a2a2a;
        padding:20px;
        text-align:center;
        color:#666;
        font-size:12px;
      ">
        © 2026 MusicHub • Feel The Beat
      </div>
    </div>
  </div>
  `,
    );

    return { email };
  }

  // 2. Xác thực OTP
  async verifyEmail(email: string, otp: string) {
    const redisKey = `pending_reg:${email}`;
    const pendingDataStr = await cacheRedis.get(redisKey);

    if (pendingDataStr) {
      const pendingData = JSON.parse(pendingDataStr);
      const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

      if (pendingData.otp !== hashedOTP) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Mã OTP không đúng");
      }

      const username = await generateUniqueSlug(User, pendingData.fullName, "username");

      const user = await User.create({
        fullName: pendingData.fullName,
        username,
        email: pendingData.email,
        password: pendingData.password,
        isVerified: true,
        authProvider: "local",
      });

      await cacheRedis.del(redisKey);

      const { accessToken, refreshToken } = generateTokens(
        user._id.toString(),
        user.role,
      );

      await this.saveSession(user._id.toString(), refreshToken);

      return { user, accessToken, refreshToken };
    }

    // Fallback cho luồng cũ (nếu có user chưa xác thực lưu trong MongoDB)
    const user = await User.findOne({
      email,
      verificationCode: otp,
    }).select("+verificationCodeExpires +role +isVerified");

    if (!user)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Mã OTP không đúng hoặc email sai (Phiên bản đăng ký đã hết hạn)",
      );

    if (
      user.verificationCodeExpires &&
      user.verificationCodeExpires < new Date()
    ) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Mã OTP đã hết hạn");
    }

    const { accessToken, refreshToken } = generateTokens(
      user._id.toString(),
      user.role,
    );

    await this.saveSession(user._id.toString(), refreshToken);

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;

    await user.save();

    return { user, accessToken, refreshToken };
  }

  // 3. Đăng nhập Form (Chống Brute-force & Timing Attack)
  async login(data: any) {
    const { email, password, rememberMe } = data;

    // 1. Kiểm tra Account Lockout trong Redis
    const lockedKey = `account_locked:${email}`;
    const isLocked = await cacheRedis.get(lockedKey);
    if (isLocked) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Tài khoản đang bị khóa tạm thời do nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.",
        "ACCOUNT_LOCKED_TEMPORARILY"
      );
    }

    const user = await User.findOne({ email }).select(
      "+password +isVerified +isActive +role",
    );

    const attemptsKey = `login_attempts:${email}`;

    // CHỐNG TIMING ATTACK & BRUTE-FORCE:
    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH).catch(() => { });

      const attempts = await cacheRedis.incr(attemptsKey);
      if (attempts === 1) await cacheRedis.expire(attemptsKey, 900); // 15 phút
      if (attempts >= 5) await cacheRedis.setex(lockedKey, 900, "1");

      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        "Email hoặc mật khẩu không đúng",
      );
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      const attempts = await cacheRedis.incr(attemptsKey);
      if (attempts === 1) await cacheRedis.expire(attemptsKey, 900); // 15 phút
      if (attempts >= 5) await cacheRedis.setex(lockedKey, 900, "1");

      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        "Email hoặc mật khẩu không đúng",
      );
    }

    // Đăng nhập thành công -> Xóa biến đếm sai
    await cacheRedis.del(attemptsKey);

    // Check trạng thái
    if (!user.isVerified) return { status: "UNVERIFIED", user };
    if (!user.isActive) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Tài khoản bị khóa",
        "ACCOUNT_LOCKED",
      );
    }

    const { accessToken, refreshToken } = generateTokens(
      user._id.toString(),
      user.role,
      rememberMe,
    );

    // Lưu session vào Redis thay vì update MongoDB
    await this.saveSession(user._id.toString(), refreshToken, rememberMe);

    user.lastLogin = new Date(); // Update Last Login
    await user.save();

    return { status: "SUCCESS", user, accessToken, refreshToken };
  }

  // 4. Refresh Token (Token Rotation)
  async refreshToken(cookieToken: string) {
    if (!cookieToken)
      throw new ApiError(httpStatus.UNAUTHORIZED, "Không có token");

    try {
      const decoded: any = jwt.verify(cookieToken, config.jwtRefreshSecret!);
      const userId = decoded.id;

      const user = await User.findById(userId).select(
        "+isActive +role",
      );

      const hashedToken = crypto.createHash("sha256").update(cookieToken).digest("hex");
      const sessionKey = `session:${userId}:${hashedToken}`;
      const sessionExists = await cacheRedis.get(sessionKey);

      // Token Reuse Detection / Invalid session
      if (!user || !sessionExists) {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "Token không hợp lệ hoặc phiên đã hết hạn (Reuse detected)",
        );
      }

      if (!user.isActive)
        throw new ApiError(httpStatus.FORBIDDEN, "Tài khoản bị khóa");

      const { accessToken, refreshToken } = generateTokens(
        user._id.toString(),
        user.role,
      );

      // Token Rotation: Xóa token cũ, lưu token mới trong Redis
      await cacheRedis.del(sessionKey);
      await this.saveSession(user._id.toString(), refreshToken);

      return { accessToken, refreshToken, user };
    } catch (error) {
      throw new ApiError(httpStatus.FORBIDDEN, "Phiên đăng nhập hết hạn");
    }
  }

  // 5. Gửi lại OTP (Rate Limit)
  async resendOtp(email: string) {
    const redisKey = `pending_reg:${email}`;
    const pendingDataStr = await cacheRedis.get(redisKey);

    const ONE_MINUTE = 60 * 1000;

    if (pendingDataStr) {
      const pendingData = JSON.parse(pendingDataStr);

      if (pendingData.lastOtpSentAt && Date.now() - pendingData.lastOtpSentAt < ONE_MINUTE) {
        throw new ApiError(
          httpStatus.TOO_MANY_REQUESTS,
          "Vui lòng đợi 1 phút trước khi gửi lại",
        );
      }

      const otp = this.generateSecureOTP();
      const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

      pendingData.otp = hashedOTP;
      pendingData.lastOtpSentAt = Date.now();

      await cacheRedis.setex(redisKey, 900, JSON.stringify(pendingData));

      sendEmail(email, "Mã OTP mới", `<h1>Mã mới: ${otp}</h1>`).catch(
        console.error,
      );

      return { message: "Đã gửi lại OTP" };
    }

    // Fallback luồng cũ
    const user = await User.findOne({ email });
    if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User không tồn tại hoặc phiên đăng ký đã hết hạn (15 phút)");
    if (user.isVerified)
      throw new ApiError(httpStatus.BAD_REQUEST, "Đã xác thực rồi");

    if (
      user.lastOtpSentAt &&
      Date.now() - new Date(user.lastOtpSentAt).getTime() < ONE_MINUTE
    ) {
      throw new ApiError(
        httpStatus.TOO_MANY_REQUESTS,
        "Vui lòng đợi 1 phút trước khi gửi lại",
      );
    }

    const otp = this.generateSecureOTP();
    user.verificationCode = otp;
    user.verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
    user.lastOtpSentAt = new Date(); // Update time

    await user.save();

    sendEmail(email, "Mã OTP mới", `<h1>Mã mới: ${otp}</h1>`).catch(
      console.error,
    );

    return { message: "Đã gửi lại OTP" };
  }

  // 6. Login Google (Logic Link Account)
  async loginWithGoogle(profile: any) {
    const email = profile.emails?.[0]?.value;
    if (!email) throw new ApiError(httpStatus.BAD_REQUEST, "Không tìm thấy Email từ Google");

    let user = await User.findOne({
      $or: [{ googleId: profile.id }, { email: email }],
    });

    if (user) {
      // BẢO MẬT: Chống Account Takeover (Không auto-link)
      if (user.authProvider !== "google") {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Email này đã được đăng ký bằng phương thức khác. Vui lòng đăng nhập bằng mật khẩu.",
        );
      }

      user.lastLogin = new Date();
      await user.save();

      return user;
    }

    // Nếu user mới hoàn toàn
    const displayName = profile.displayName || email.split("@")[0];
    const username = await generateUniqueSlug(User, displayName, "username");
    const randomPassword = crypto.randomBytes(16).toString("hex");

    user = await User.create({
      username,
      fullName: displayName,
      email,
      avatar: profile.photos?.[0]?.value || "",
      googleId: profile.id,
      authProvider: "google",
      isVerified: true,
      role: "user",
      password: randomPassword,
      lastLogin: new Date(),
    });

    return user;
  }

  // 6b. Login Facebook (Logic Link Account)
  async loginWithFacebook(profile: any) {
    const email = profile.emails?.[0]?.value;
    if (!email) throw new ApiError(httpStatus.BAD_REQUEST, "Không tìm thấy Email từ Facebook");

    let user = await User.findOne({
      $or: [{ facebookId: profile.id }, { email: email }],
    });

    if (user) {
      // BẢO MẬT: Chống Account Takeover (Không auto-link)
      if (user.authProvider !== "facebook") {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Email này đã được đăng ký bằng phương thức khác. Vui lòng đăng nhập bằng mật khẩu.",
        );
      }

      user.lastLogin = new Date();
      await user.save();

      return user;
    }

    // Nếu user mới hoàn toàn
    const displayName =
      profile.displayName ||
      `${profile.name?.givenName || ""} ${profile.name?.familyName || ""}`.trim() ||
      email.split("@")[0];
    const username = await generateUniqueSlug(User, displayName, "username");
    const randomPassword = crypto.randomBytes(16).toString("hex");

    const avatarUrl = `https://graph.facebook.com/${profile.id}/picture?type=large`;

    user = await User.create({
      username,
      fullName: displayName,
      email,
      avatar: avatarUrl,
      facebookId: profile.id,
      authProvider: "facebook",
      isVerified: true,
      role: "user",
      password: randomPassword,
      lastLogin: new Date(),
    });

    return user;
  }

  // 7. Forgot Password (Rate Limit & Anti-Enumeration)
  async forgotPassword(email: string) {
    const user = await User.findOne({ email });

    // ANTI-ENUMERATION: Trả về thành công ảo nếu email không tồn tại hoặc là tài khoản social
    if (!user || user.authProvider === "google" || user.authProvider === "facebook") {
      return { message: "Nếu email hợp lệ, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu." };
    }

    // Rate Limit (60s) bằng Redis thay vì MongoDB
    const rateLimitKey = `reset_limit:${email}`;
    const isLimited = await cacheRedis.get(rateLimitKey);
    if (isLimited) {
      throw new ApiError(
        httpStatus.TOO_MANY_REQUESTS,
        "Vui lòng đợi 1 phút trước khi gửi lại",
      );
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // LƯU TOKEN VÀO REDIS (Thay vì DB)
    const resetKey = `pwd_reset:${hashedToken}`;
    await cacheRedis.setex(resetKey, 600, user._id.toString()); // Hết hạn 10 phút
    await cacheRedis.setex(rateLimitKey, 60, "1"); // Rate limit 1 phút

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    const message = `
      <h1>Yêu cầu đổi mật khẩu</h1>
      <p>Click vào link dưới đây (Hết hạn sau 10 phút):</p>
      <a href="${resetUrl}" style="padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Đặt lại mật khẩu</a>
    `;

    try {
      await sendEmail(user.email, "Đặt lại mật khẩu", message);
      return { message: "Nếu email hợp lệ, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu." };
    } catch (error) {
      await cacheRedis.del(resetKey);
      await cacheRedis.del(rateLimitKey);
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Lỗi gửi mail service",
      );
    }
  }

  // 8. Reset Password (Hoàn thiện)
  async resetPassword(token: string, newPassword: string) {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const resetKey = `pwd_reset:${hashedToken}`;

    // Lấy userId từ Redis
    const userId = await cacheRedis.get(resetKey);

    if (!userId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Link không hợp lệ hoặc đã hết hạn",
      );
    }

    const user = await User.findById(userId);
    if (!user) throw new ApiError(httpStatus.BAD_REQUEST, "User không tồn tại");

    user.password = newPassword;
    await user.save(); // Lưu password (đã hash qua schema pre-save)

    // Xóa reset token khỏi Redis
    await cacheRedis.del(resetKey);

    // BẢO MẬT: Thu hồi toàn bộ session đăng nhập cũ bằng cách xóa các key Redis
    try {
      const sessionKeys = await cacheRedis.keys(`session:${userId}:*`);
      if (sessionKeys.length > 0) {
        await cacheRedis.del(...sessionKeys);
      }
    } catch (err) {
      console.error("Lỗi khi thu hồi session:", err);
    }

    return { message: "Đổi mật khẩu thành công" };
  }
  async logout(userId: string, specificToken?: string) {
    // Dọn dẹp Redis Interaction để tránh lệch data cho user sau
    await interactionService.clearUserCache(userId);

    // Thu hồi refresh token trong Redis session
    if (specificToken) {
      await this.removeSession(userId, specificToken);
    }
  }
}

export default new AuthService();
