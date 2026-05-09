import User from "../models/User";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import { generateTokens } from "../utils/token";
import { sendEmail } from "../utils/sendEmail";
import jwt from "jsonwebtoken";
import { generateUniqueSlug } from "../utils/slug";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import interactionService from "./interaction.service";

// Hash giả hợp lệ (cost 10) để chống Timing Attack
const DUMMY_HASH = "$2b$10$2b102b102b102b102b102uX/fakestringtofoolhacker...";

class AuthService {
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
          "Email này đã đăng ký bằng Google.",
        );
      }
      throw new ApiError(httpStatus.BAD_REQUEST, "Email đã được sử dụng");
    }

    const otp = this.generateSecureOTP();
    const otpExpires = Date.now() + 15 * 60 * 1000; // 15 phút
    const username = await generateUniqueSlug(User, fullName, "username");

    const user = await User.create({
      fullName,
      username,
      email,
      password,
      isVerified: false,
      verificationCode: otp,
      verificationCodeExpires: otpExpires,
      authProvider: "local",
      lastOtpSentAt: new Date(), // Init timestamp chặn spam
    });

    // Fire & Forget email
    sendEmail(email, "Mã xác thực", `<h1>Mã OTP: ${otp}</h1>`).catch((err) =>
      console.error("❌ Lỗi gửi mail register:", err),
    );

    return user;
  }

  // 2. Xác thực OTP
  async verifyEmail(email: string, otp: string) {
    const user = await User.findOne({
      email,
      verificationCode: otp,
    }).select("+verificationCodeExpires +role +isVerified");

    if (!user)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Mã OTP không đúng hoặc email sai",
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

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    user.refreshToken = refreshToken;

    await user.save();

    return { user, accessToken, refreshToken };
  }

  // 3. Đăng nhập Form (Chống Timing Attack)
  async login(data: any) {
    const { email, password, rememberMe } = data;

    const user = await User.findOne({ email }).select(
      "+password +isVerified +isActive +role",
    );

    // CHỐNG TIMING ATTACK:
    // Nếu user không tồn tại, vẫn thực hiện so sánh hash giả
    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH).catch(() => {});
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        "Email hoặc mật khẩu không đúng",
      );
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        "Email hoặc mật khẩu không đúng",
      );
    }

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

    user.refreshToken = refreshToken;
    user.lastLogin = new Date(); // Update Last Login
    await user.save();

    return { status: "SUCCESS", user, accessToken, refreshToken };
  }

  // 4. Refresh Token (Token Rotation)
  async refreshToken(cookieToken: string) {
    if (!cookieToken)
      throw new ApiError(httpStatus.UNAUTHORIZED, "Không có token");

    try {
      const decoded: any = jwt.verify(
        cookieToken,
        process.env.JWT_REFRESH_SECRET!,
      );

      const user = await User.findById(decoded.id).select(
        "+refreshToken +isActive +role",
      );

      // Token Reuse Detection
      if (!user || user.refreshToken !== cookieToken) {
        if (user) {
          user.refreshToken = undefined; // Hủy phiên
          await user.save();
        }
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "Token không hợp lệ (Reuse detected)",
        );
      }

      if (!user.isActive)
        throw new ApiError(httpStatus.FORBIDDEN, "Tài khoản bị khóa");

      const { accessToken, refreshToken } = generateTokens(
        user._id.toString(),
        user.role,
      );

      user.refreshToken = refreshToken; // Xoay vòng token
      await user.save();

      return { accessToken, refreshToken, user };
    } catch (error) {
      throw new ApiError(httpStatus.FORBIDDEN, "Phiên đăng nhập hết hạn");
    }
  }

  // 5. Gửi lại OTP (Rate Limit)
  async resendOtp(email: string) {
    const user = await User.findOne({ email });
    if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User không tồn tại");
    if (user.isVerified)
      throw new ApiError(httpStatus.BAD_REQUEST, "Đã xác thực rồi");

    // 🔥 RATE LIMIT: Chặn spam 1 phút/lần
    const ONE_MINUTE = 60 * 1000;
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
    if (!email) throw new Error("No email found from Google");

    let user = await User.findOne({
      $or: [{ googleId: profile.id }, { email: email }],
    });

    if (user) {
      // Nếu user đã tồn tại (do đăng ký local hoặc google trước đó)
      if (!user.googleId) {
        // Link account Google vào account Local
        user.googleId = profile.id;
        if (!user.avatar) user.avatar = profile.photos?.[0]?.value;
        if (!user.isVerified) user.isVerified = true;

        user.lastLogin = new Date();
        await user.save();
      }
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
    if (!email) throw new Error("No email found from Facebook");

    let user = await User.findOne({
      $or: [{ facebookId: profile.id }, { email: email }],
    });

    if (user) {
      // Nếu user đã tồn tại (do đăng ký local hoặc social trước đó)
      if (!user.facebookId) {
        // Link account Facebook vào account Local
        user.facebookId = profile.id;
        if (!user.avatar) user.avatar = profile.photos?.[0]?.value;
        if (!user.isVerified) user.isVerified = true;

        user.lastLogin = new Date();
        await user.save();
      }
      return user;
    }

    // Nếu user mới hoàn toàn
    const displayName =
      profile.displayName ||
      `${profile.name?.givenName || ""} ${profile.name?.familyName || ""}`.trim() ||
      email.split("@")[0];
    const username = await generateUniqueSlug(User, displayName, "username");
    const randomPassword = crypto.randomBytes(16).toString("hex");

    user = await User.create({
      username,
      fullName: displayName,
      email,
      avatar: profile.photos?.[0]?.value || "",
      facebookId: profile.id,
      authProvider: "facebook",
      isVerified: true,
      role: "user",
      password: randomPassword,
      lastLogin: new Date(),
    });

    return user;
  }

  // 7. Forgot Password (Rate Limit)
  async forgotPassword(email: string) {
    const user = await User.findOne({ email });
    if (!user) throw new ApiError(httpStatus.NOT_FOUND, "Email không tồn tại");

    if (user.authProvider === "google" || user.authProvider === "facebook") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Tài khoản social (Google/Facebook) không thể reset mật khẩu.",
      );
    }

    // Rate Limit
    const ONE_MINUTE = 60 * 1000;
    if (
      user.lastOtpSentAt &&
      Date.now() - new Date(user.lastOtpSentAt).getTime() < ONE_MINUTE
    ) {
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

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 phút
    user.lastOtpSentAt = new Date(); // Update time rate limit
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    const message = `
      <h1>Yêu cầu đổi mật khẩu</h1>
      <p>Click vào link dưới đây (Hết hạn sau 10 phút):</p>
      <a href="${resetUrl}" style="padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Đặt lại mật khẩu</a>
    `;

    try {
      await sendEmail(user.email, "Đặt lại mật khẩu", message);
      return { message: "Email đã được gửi" };
    } catch (error) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Lỗi gửi mail service",
      );
    }
  }

  // 8. Reset Password (Hoàn thiện)
  async resetPassword(token: string, newPassword: string) {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Link không hợp lệ hoặc đã hết hạn",
      );

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    // Thu hồi mọi token cũ để bắt đăng nhập lại (Security Best Practice)
    user.refreshToken = undefined;

    await user.save();
    return { message: "Đổi mật khẩu thành công" };
  }
  async logout(userId: string) {
    // Dọn dẹp Redis Interaction để tránh lệch data cho user sau
    await interactionService.clearUserCache(userId);

    // Thu hồi refresh token server-side: unset field trong DB
    try {
      await User.findByIdAndUpdate(userId, { $unset: { refreshToken: 1 } });
    } catch (err) {
      // Không block logout nếu việc cập nhật DB thất bại
      console.warn(
        "Warning: failed to unset refreshToken for user",
        userId,
        err,
      );
    }
  }
}

export default new AuthService();
