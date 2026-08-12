import User from "../models/User";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import { generateTokens } from "../utils/token";
import { sendEmail } from "../utils/sendEmail";
import { registerOtpEmail, resendOtpEmail, forgotPasswordEmail } from "../utils/emailTemplates";
import jwt from "jsonwebtoken";
import config from "../config/env";
import { generateUniqueSlug } from "../utils/slug";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import interactionService from "./interaction.service";
import { cacheRedis } from "../config/redis";
import UserIdentity, { AuthProviderType } from "../models/UserIdentity";
import { AuthErrorCode } from "../types/auth.types";
import { APP_CONFIG } from "../config/constants";


class AuthService {
  // --- HELPER: Session Management ---
  async saveSession(userId: string, refreshToken: string, rememberMe: boolean = false) {
    const hashedToken = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const ttl = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60; // 30 ngày hoặc 7 ngày (giây)
    const sessionKey = `session:${userId}:${hashedToken}`;

    await cacheRedis.setex(sessionKey, ttl, "1");
    // O(1) Session Tracking cho tính năng Revocation
    await cacheRedis.sadd(`user_sessions:${userId}`, sessionKey);
    await cacheRedis.expire(`user_sessions:${userId}`, 30 * 24 * 60 * 60); // Ngăn rò rỉ bộ nhớ
  }

  async removeSession(userId: string, refreshToken: string) {
    const hashedToken = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const sessionKey = `session:${userId}:${hashedToken}`;
    await cacheRedis.del(sessionKey);
    await cacheRedis.srem(`user_sessions:${userId}`, sessionKey);
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
      // Enterprise check: Kiểm tra trong bảng UserIdentity để nhận diện chính xác phương thức đã liên kết
      const identities = await UserIdentity.find({ user_id: existingUser._id });
      if (identities.length > 0) {
        const hasPassword = identities.some((i) => i.provider === "password");
        if (!hasPassword) {
          const providers = identities
            .map((i) => (i.provider === "google" ? "Google" : i.provider === "facebook" ? "Facebook" : i.provider))
            .join(" và ");
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Dữ liệu không hợp lệ",
            AuthErrorCode.VALIDATION_ERROR,
            true,
            "",
            [{ field: "email", message: `Email này đã được đăng ký tài khoản qua ${providers}. Vui lòng tiếp tục đăng nhập!` }]
          );
        }
      } else if (existingUser.authProvider === "google" || existingUser.authProvider === "facebook") {
        const providerName = existingUser.authProvider === "google" ? "Google" : "Facebook";
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Dữ liệu không hợp lệ",
          AuthErrorCode.VALIDATION_ERROR,
          true,
          "",
          [{ field: "email", message: `Email này đã được đăng ký tài khoản qua ${providerName}. Vui lòng tiếp tục đăng nhập!` }]
        );
      }

      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Dữ liệu không hợp lệ",
        AuthErrorCode.VALIDATION_ERROR,
        true,
        "",
        [{ field: "email", message: "Email này đã được sử dụng trong hệ thống. Vui lòng đăng nhập!" }]
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const lockedKey = `otp_locked:${cleanEmail}`;
    const isLocked = await cacheRedis.get(lockedKey);
    if (isLocked) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Bạn đã nhập sai mã OTP quá 5 lần. Hệ thống đã khóa xác thực tạm thời trong 15 phút. Vui lòng thử lại sau.",
        AuthErrorCode.OTP_LOCKED_TEMPORARILY
      );
    }

    const redisKey = `pending_reg:${cleanEmail}`;
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
      "Xác thực tài khoản - TVP Streaming Music",
      registerOtpEmail(otp, fullName),
    );

    return { email };
  }

  // 2. Xác thực OTP
  async verifyEmail(email: string, otp: string) {
    // 1. Defense-in-depth: Validate đầu vào & làm sạch dữ liệu
    if (!email || !otp) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Vui lòng cung cấp đầy đủ email và mã xác thực OTP.",
        AuthErrorCode.MISSING_CREDENTIALS
      );
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Mã OTP không hợp lệ. Mã xác thực phải bao gồm đúng 6 chữ số.",
        AuthErrorCode.INVALID_OTP_FORMAT
      );
    }

    // 2. Kiểm tra khóa tạm thời do nhập sai quá nhiều lần (Brute-force protection)
    const lockedKey = `otp_locked:${cleanEmail}`;
    const isLocked = await cacheRedis.get(lockedKey);
    if (isLocked) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Bạn đã nhập sai mã OTP quá nhiều lần. Khóa xác thực tạm thời trong 15 phút để bảo mật. Vui lòng thử lại sau.",
        AuthErrorCode.OTP_LOCKED_TEMPORARILY
      );
    }

    // 3. Kiểm tra xem User đã được xác thực trước đó trong hệ thống chưa (Chống Race Condition)
    const existingUser = await User.findOne({ email: cleanEmail }).select("+password +isVerified +role");
    if (existingUser && existingUser.isVerified) {
      await cacheRedis.del(`pending_reg:${cleanEmail}`);
      await cacheRedis.del(`otp_attempts:${cleanEmail}`);
      throw new ApiError(
        httpStatus.CONFLICT,
        "Email này đã được xác thực và kích hoạt thành công trước đó. Vui lòng quay lại trang đăng nhập!",
        AuthErrorCode.EMAIL_ALREADY_VERIFIED,
        true,
        "",
        [{ field: "email", message: "Email này đã được sử dụng và xác thực trong hệ thống." }]
      );
    }

    const attemptsKey = `otp_attempts:${cleanEmail}`;
    const redisKey = `pending_reg:${cleanEmail}`;
    const pendingDataStr = await cacheRedis.get(redisKey);

    // 4. LUỒNG CHÍNH: Xử lý dữ liệu đăng ký lưu trong Redis Cache
    if (pendingDataStr) {
      const pendingData = JSON.parse(pendingDataStr);
      const hashedOTP = crypto.createHash("sha256").update(cleanOtp).digest("hex");

      // Nếu sai mã OTP -> Tăng đếm lần sai & kiểm tra giới hạn
      if (pendingData.otp !== hashedOTP) {
        const attempts = await cacheRedis.incr(attemptsKey);
        if (attempts === 1) await cacheRedis.expire(attemptsKey, 900); // TTL 15 phút
        if (attempts >= 5) {
          await cacheRedis.setex(lockedKey, 900, "1");
          throw new ApiError(
            httpStatus.FORBIDDEN,
            "Bạn đã nhập sai mã OTP quá 5 lần. Hệ thống đã khóa xác thực tạm thời trong 15 phút.",
            AuthErrorCode.OTP_LOCKED_TEMPORARILY
          );
        }
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Mã OTP không chính xác. Bạn còn ${5 - attempts} lần thử.`,
          AuthErrorCode.INVALID_OTP
        );
      }

      // Khi OTP đúng -> Tạo hoặc cập nhật User thành đã xác thực
      const username = await generateUniqueSlug(User, pendingData.fullName, undefined, "username");
      let user = existingUser;

      if (user) {
        // Nếu user đã tồn tại (ở trạng thái chưa xác thực) -> Cập nhật thông tin mới nhất
        user.fullName = pendingData.fullName;
        user.username = user.username || username;
        user.password = pendingData.password;
        user.isVerified = true;
        user.authProvider = "local";
        user.verificationCode = undefined;
        user.verificationCodeExpires = undefined;
        await user.save();
      } else {
        // Tạo mới hoàn toàn
        user = await User.create({
          fullName: pendingData.fullName,
          username,
          email: pendingData.email,
          password: pendingData.password,
          isVerified: true,
          authProvider: "local",
        });
      }

      // Đảm bảo liên kết định danh (UserIdentity)
      const existingPwdId = await UserIdentity.findOne({ user_id: user._id, provider: "password" });
      if (!existingPwdId) {
        await UserIdentity.create({
          user_id: user._id,
          provider: "password",
          provider_user_id: pendingData.email,
          provider_email: pendingData.email,
          provider_email_verified: true,
        });
      }

      // Dọn dẹp cache
      await cacheRedis.del(redisKey);
      await cacheRedis.del(attemptsKey);
      await cacheRedis.del(lockedKey);
      await cacheRedis.del(`account_locked:${cleanEmail}`);

      const { accessToken, refreshToken } = generateTokens(
        user._id.toString(),
        user.role,
      );

      await this.saveSession(user._id.toString(), refreshToken);

      return { user, accessToken, refreshToken };
    }

    // 5. LUỒNG FALLBACK: Nếu key Redis đã hết hạn hoặc không tìm thấy, kiểm tra DB (MongoDB)
    const userFallback = await User.findOne({ email: cleanEmail }).select(
      "+verificationCode +verificationCodeExpires +role +isVerified +password"
    );

    if (!userFallback || !userFallback.verificationCode) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Phiên xác thực đã hết hạn (15 phút) hoặc không tìm thấy yêu cầu đăng ký cho email này. Vui lòng đăng ký lại!",
        "REGISTRATION_EXPIRED_OR_NOT_FOUND"
      );
    }

    // Kiểm tra thời hạn mã OTP trong DB
    if (
      userFallback.verificationCodeExpires &&
      userFallback.verificationCodeExpires < new Date()
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Mã OTP đã hết hạn. Vui lòng nhấn 'Gửi lại mã' để nhận OTP mới.",
        "OTP_EXPIRED"
      );
    }

    // Kiểm tra khớp OTP (hỗ trợ cả mã lưu plain và hashed)
    const hashedInputOtp = crypto.createHash("sha256").update(cleanOtp).digest("hex");
    const isOtpMatch =
      userFallback.verificationCode === cleanOtp ||
      userFallback.verificationCode === hashedInputOtp;

    if (!isOtpMatch) {
      const attempts = await cacheRedis.incr(attemptsKey);
      if (attempts === 1) await cacheRedis.expire(attemptsKey, 900);
      if (attempts >= 5) {
        await cacheRedis.setex(lockedKey, 900, "1");
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "Bạn đã nhập sai mã OTP quá 5 lần. Hệ thống đã khóa xác thực tạm thời trong 15 phút.",
          "OTP_LOCKED_TEMPORARILY"
        );
      }
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Mã OTP không chính xác. Bạn còn ${5 - attempts} lần thử.`,
        "INVALID_OTP"
      );
    }

    // Xác thực thành công trong Fallback
    userFallback.isVerified = true;
    userFallback.verificationCode = undefined;
    userFallback.verificationCodeExpires = undefined;
    await userFallback.save();

    const existingPwdId = await UserIdentity.findOne({ user_id: userFallback._id, provider: "password" });
    if (!existingPwdId) {
      await UserIdentity.create({
        user_id: userFallback._id,
        provider: "password",
        provider_user_id: userFallback.email,
        provider_email: userFallback.email,
        provider_email_verified: true,
      });
    }

    // Dọn dẹp cache
    await cacheRedis.del(attemptsKey);
    await cacheRedis.del(lockedKey);
    await cacheRedis.del(`account_locked:${cleanEmail}`);

    const { accessToken, refreshToken } = generateTokens(
      userFallback._id.toString(),
      userFallback.role,
    );

    await this.saveSession(userFallback._id.toString(), refreshToken);

    return { user: userFallback, accessToken, refreshToken };
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
      await bcrypt.compare(password, APP_CONFIG.DUMMY_HASH).catch(() => { });

      const attempts = await cacheRedis.incr(attemptsKey);
      if (attempts === 1) await cacheRedis.expire(attemptsKey, 900); // 15 phút
      if (attempts >= 5) await cacheRedis.setex(lockedKey, 900, "1");

      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        "Email hoặc mật khẩu không đúng",
      );
    }

    // Enterprise Identity Linking check: Kiểm tra xem user có Identity password không
    const pwdIdentity = await UserIdentity.findOne({ user_id: user._id, provider: "password" });
    if (!pwdIdentity) {
      const allIdentities = await UserIdentity.find({ user_id: user._id });
      if (allIdentities.length > 0) {
        const providers = allIdentities.map((i) => i.provider);
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Tài khoản của bạn đang sử dụng mạng xã hội để đăng nhập. Vui lòng tiếp tục với phương thức tương ứng.",
          AuthErrorCode.LOGIN_METHOD_REQUIRED,
          true,
          "",
          undefined,
          { providers }
        );
      } else if (!user.password || user.password.trim() === "") {
        // Legacy OAuth user chưa chạy migration
        const fallbackProvider = user.authProvider === "google" ? "google" : "facebook";
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Tài khoản của bạn đang sử dụng mạng xã hội để đăng nhập. Vui lòng tiếp tục với Google hoặc Facebook.",
          AuthErrorCode.LOGIN_METHOD_REQUIRED,
          true,
          "",
          undefined,
          { providers: [fallbackProvider] }
        );
      }
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
      await cacheRedis.srem(`user_sessions:${userId}`, sessionKey);
      await this.saveSession(user._id.toString(), refreshToken);

      return { accessToken, refreshToken, user };
    } catch (error) {
      throw new ApiError(httpStatus.FORBIDDEN, "Phiên đăng nhập hết hạn");
    }
  }

  // 5. Gửi lại OTP (Rate Limit)
  async resendOtp(email: string) {
    const cleanEmail = email.trim().toLowerCase();
    const lockedKey = `otp_locked:${cleanEmail}`;
    const isLocked = await cacheRedis.get(lockedKey);
    if (isLocked) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Bạn đã nhập sai mã OTP quá 5 lần. Hệ thống đã khóa xác thực tạm thời trong 15 phút. Vui lòng thử lại sau.",
        AuthErrorCode.OTP_LOCKED_TEMPORARILY
      );
    }

    const redisKey = `pending_reg:${cleanEmail}`;
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

      sendEmail(
        email,
        "Mã OTP mới - TVP Streaming Music",
        resendOtpEmail(otp, pendingData.fullName),
      ).catch(console.error);

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

    sendEmail(
      email,
      "Mã OTP mới - TVP Streaming Music",
      resendOtpEmail(otp, user.fullName),
    ).catch(console.error);

    return { message: "Đã gửi lại OTP" };
  }

  // 6. Login Google (Enterprise Identity Linking & Auto-Link)
  async loginWithGoogle(profile: any) {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Không tìm thấy Email từ tài khoản Google của bạn. Vui lòng cấp quyền truy cập Email.",
        AuthErrorCode.OAUTH_EMAIL_MISSING
      );
    }

    // Bước 1: Tìm trong bảng UserIdentity trước
    const existingIdentity = await UserIdentity.findOne({
      provider: "google",
      provider_user_id: profile.id,
    });

    if (existingIdentity) {
      const user = await User.findById(existingIdentity.user_id);
      if (user) {
        user.lastLogin = new Date();
        await user.save();
        return user;
      }
    }

    // Bước 2: Tìm User theo email trong hệ thống
    let user = await User.findOne({ email });

    if (!user) {
      // User chưa tồn tại -> Tạo mới User & Google Identity
      const displayName = profile.displayName || email.split("@")[0];
      const username = await generateUniqueSlug(User, displayName, undefined, "username");
      user = await User.create({
        username,
        fullName: displayName,
        email,
        avatar: profile.photos?.[0]?.value || "",
        googleId: profile.id, // Giữ để tương thích ngược
        authProvider: "google",
        isVerified: true,
        role: "user",
        lastLogin: new Date(),
      });

      await UserIdentity.create({
        user_id: user._id,
        provider: "google",
        provider_user_id: profile.id,
        provider_email: email,
        provider_email_verified: true,
      });

      return user;
    }

    // Bước 3: User đã tồn tại theo email -> Kiểm tra điều kiện Auto-Link
    const isEmailVerified = profile._json?.email_verified !== false && profile.emails?.[0]?.verified !== false;
    if (!isEmailVerified) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Email từ Google chưa được xác minh (unverified). Không thể liên kết vào tài khoản.",
        AuthErrorCode.PROVIDER_EMAIL_NOT_VERIFIED
      );
    }

    if (!user.isActive) {
      throw new ApiError(httpStatus.FORBIDDEN, "Tài khoản đang bị khóa.", AuthErrorCode.ACCOUNT_LOCKED);
    }

    // Thực hiện Auto-Link: Thêm Google Identity cho user cũ
    await UserIdentity.create({
      user_id: user._id,
      provider: "google",
      provider_user_id: profile.id,
      provider_email: email,
      provider_email_verified: true,
    });

    if (!user.googleId) user.googleId = profile.id;
    user.lastLogin = new Date();
    await user.save();

    return user;
  }

  // 6b. Login Facebook (Enterprise Identity Linking & Auto-Link)
  async loginWithFacebook(profile: any) {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Không tìm thấy Email từ tài khoản Facebook của bạn. Vui lòng cấp quyền truy cập Email hoặc sử dụng tài khoản có liên kết Email.",
        AuthErrorCode.OAUTH_EMAIL_MISSING
      );
    }

    // Bước 1: Tìm trong bảng UserIdentity trước
    const existingIdentity = await UserIdentity.findOne({
      provider: "facebook",
      provider_user_id: profile.id,
    });

    if (existingIdentity) {
      const user = await User.findById(existingIdentity.user_id);
      if (user) {
        user.lastLogin = new Date();
        await user.save();
        return user;
      }
    }

    // Bước 2: Tìm User theo email trong hệ thống
    let user = await User.findOne({ email });

    if (!user) {
      // User chưa tồn tại -> Tạo mới User & Facebook Identity
      const displayName =
        profile.displayName ||
        `${profile.name?.givenName || ""} ${profile.name?.familyName || ""}`.trim() ||
        email.split("@")[0];
      const username = await generateUniqueSlug(User, displayName, undefined, "username");
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
        lastLogin: new Date(),
      });

      await UserIdentity.create({
        user_id: user._id,
        provider: "facebook",
        provider_user_id: profile.id,
        provider_email: email,
        provider_email_verified: true,
      });

      return user;
    }

    // Bước 3: User đã tồn tại theo email -> Kiểm tra điều kiện Auto-Link
    const isEmailVerified = profile._json?.email_verified !== false && profile.emails?.[0]?.verified !== false;
    if (!isEmailVerified) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Email từ Facebook chưa được xác minh (unverified). Không thể liên kết vào tài khoản.",
        AuthErrorCode.PROVIDER_EMAIL_NOT_VERIFIED
      );
    }

    if (!user.isActive) {
      throw new ApiError(httpStatus.FORBIDDEN, "Tài khoản đang bị khóa.", AuthErrorCode.ACCOUNT_LOCKED);
    }

    // Thực hiện Auto-Link: Thêm Facebook Identity cho user cũ
    await UserIdentity.create({
      user_id: user._id,
      provider: "facebook",
      provider_user_id: profile.id,
      provider_email: email,
      provider_email_verified: true,
    });

    if (!user.facebookId) user.facebookId = profile.id;
    user.lastLogin = new Date();
    await user.save();

    return user;
  }

  // 7. Forgot Password (Anti-Enumeration, Rate Limit, Validate)
  async forgotPassword(email: string) {
    // 1. Validate & sanitize input
    if (!email || typeof email !== "string") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Vui lòng cung cấp địa chỉ email.",
        AuthErrorCode.MISSING_CREDENTIALS
      );
    }
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Địa chỉ email không hợp lệ.",
        AuthErrorCode.VALIDATION_ERROR
      );
    }

    // 2. Rate Limit TRƯỚC khi query DB (chống spam, timing attack)
    const rateLimitKey = `reset_limit:${cleanEmail}`;
    const isLimited = await cacheRedis.get(rateLimitKey);
    if (isLimited) {
      const ttl = await cacheRedis.ttl(rateLimitKey);
      throw new ApiError(
        httpStatus.TOO_MANY_REQUESTS,
        `Vui lòng đợi ${ttl > 0 ? ttl : 60} giây trước khi yêu cầu gửi lại.`,
        AuthErrorCode.RATE_LIMITED
      );
    }

    const user = await User.findOne({ email: cleanEmail }).select("+password +isVerified +isActive +authProvider");

    // 3. ANTI-ENUMERATION: Luôn trả về cùng một response bất kể email có tồn tại hay không
    // nhưng vẫn kiểm tra nội bộ để xử lý logic
    const ANTI_ENUM_MSG = "Nếu email hợp lệ và được đăng ký bằng mật khẩu, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.";

    if (!user) {
      // Đặt rate limit kể cả khi email không tồn tại (chống enumeration bằng timing)
      await cacheRedis.setex(rateLimitKey, 60, "1");
      return { message: ANTI_ENUM_MSG };
    }

    // 4. Kiểm tra tài khoản Social (không thể reset password)
    const pwdIdentity = await UserIdentity.findOne({ user_id: user._id, provider: "password" });
    if (!pwdIdentity) {
      // Tài khoản chỉ dùng OAuth -> không có password để reset
      await cacheRedis.setex(rateLimitKey, 60, "1");
      return { message: ANTI_ENUM_MSG }; // Không tiết lộ việc account tồn tại
    }

    // 5. Kiểm tra tài khoản active
    if (user.isActive === false) {
      await cacheRedis.setex(rateLimitKey, 60, "1");
      return { message: ANTI_ENUM_MSG }; // Không tiết lộ thông tin
    }

    // 6. Tạo reset token an toàn (32 bytes random hex)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    // 7. Lưu vào Redis với TTL 10 phút (lưu cả email để xác minh thêm)
    const resetKey = `pwd_reset:${hashedToken}`;
    const resetPayload = JSON.stringify({ userId: user._id.toString(), email: cleanEmail });
    await cacheRedis.setex(resetKey, 600, resetPayload); // 10 phút
    await cacheRedis.setex(rateLimitKey, 60, "1"); // Rate limit 1 phút

    const resetUrl = `${config.clientUrl}/reset-password/${resetToken}`;

    try {
      await sendEmail(
        user.email,
        "Đặt lại mật khẩu - TVP Streaming Music",
        forgotPasswordEmail(resetUrl, user.fullName),
      );
      return { message: ANTI_ENUM_MSG };
    } catch (error) {
      // Rollback: Xóa token nếu gửi mail thất bại
      await cacheRedis.del(resetKey);
      await cacheRedis.del(rateLimitKey);
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Hệ thống gặp sự cố khi gửi email. Vui lòng thử lại sau vài phút.",
        AuthErrorCode.NETWORK_ERROR
      );
    }
  }

  // 8. Reset Password (Validate Token, Check Reuse, Revoke Sessions)
  async resetPassword(token: string, newPassword: string) {
    // 1. Validate input
    if (!token || typeof token !== "string" || token.trim().length === 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Token đặt lại mật khẩu không hợp lệ hoặc đã bị thiếu.",
        AuthErrorCode.RESET_TOKEN_INVALID
      );
    }
    if (!newPassword || typeof newPassword !== "string") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Vui lòng cung cấp mật khẩu mới.",
        AuthErrorCode.MISSING_CREDENTIALS
      );
    }

    // 2. Validate độ mạnh mật khẩu (defense-in-depth ngoài Zod)
    const passwordErrors: string[] = [];
    if (newPassword.length < 8) passwordErrors.push("ít nhất 8 ký tự");
    if (!/\d/.test(newPassword)) passwordErrors.push("ít nhất 1 chữ số");
    if (!/[A-Z]/.test(newPassword)) passwordErrors.push("ít nhất 1 chữ in hoa");
    if (!/[^A-Za-z0-9]/.test(newPassword)) passwordErrors.push("ít nhất 1 ký tự đặc biệt");
    if (passwordErrors.length > 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Mật khẩu phải có ${passwordErrors.join(", ")}.`,
        AuthErrorCode.VALIDATION_ERROR,
        true,
        "",
        [{ field: "newPassword", message: `Mật khẩu phải có ${passwordErrors.join(", ")}.` }]
      );
    }

    // 3. Kiểm tra độ dài tối đa (chống DoS)
    if (newPassword.length > 128) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Mật khẩu không được vượt quá 128 ký tự.",
        AuthErrorCode.VALIDATION_ERROR
      );
    }

    // 4. Xác minh token từ Redis
    const cleanToken = token.trim();
    const hashedToken = crypto.createHash("sha256").update(cleanToken).digest("hex");
    const resetKey = `pwd_reset:${hashedToken}`;
    const resetPayloadStr = await cacheRedis.get(resetKey);

    if (!resetPayloadStr) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn (10 phút). Vui lòng gửi lại yêu cầu.",
        AuthErrorCode.RESET_TOKEN_EXPIRED
      );
    }

    // 5. Parse payload và xác minh cấu trúc
    let resetPayload: { userId: string; email: string };
    try {
      resetPayload = JSON.parse(resetPayloadStr);
      if (!resetPayload.userId || !resetPayload.email) throw new Error("Invalid payload");
    } catch {
      // Payload cũ chỉ lưu userId dạng string (legacy)
      resetPayload = { userId: resetPayloadStr, email: "" };
    }

    // 6. Tìm user và kiểm tra trạng thái
    const user = await User.findById(resetPayload.userId).select("+password +isActive +role");
    if (!user) {
      await cacheRedis.del(resetKey); // Dọn dẹp token rác
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Tài khoản không còn tồn tại trong hệ thống.",
        AuthErrorCode.ACCOUNT_NOT_FOUND
      );
    }

    if (user.isActive === false) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ hỗ trợ.",
        AuthErrorCode.ACCOUNT_NOT_ACTIVE
      );
    }

    // 7. Kiểm tra email khớp (nếu payload mới có email)
    if (resetPayload.email && user.email !== resetPayload.email) {
      await cacheRedis.del(resetKey);
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Token không khớp với tài khoản. Vui lòng yêu cầu lại.",
        AuthErrorCode.RESET_TOKEN_INVALID
      );
    }

    // 8. Chống tái sử dụng mật khẩu cũ (Password Reuse Prevention)
    if (user.password) {
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Mật khẩu mới không được trùng với mật khẩu hiện tại. Vui lòng chọn mật khẩu khác.",
          AuthErrorCode.SAME_PASSWORD_ERROR
        );
      }
    }

    // 9. Cập nhật mật khẩu mới (pre-save hook sẽ hash)
    user.password = newPassword;
    await user.save();

    // 10. Đảm bảo liên kết Identity password tồn tại
    const existingPwdId = await UserIdentity.findOne({ user_id: user._id, provider: "password" });
    if (!existingPwdId) {
      await UserIdentity.create({
        user_id: user._id,
        provider: "password",
        provider_user_id: user.email,
        provider_email: user.email,
        provider_email_verified: true,
      });
    }

    // 11. Xóa reset token khỏi Redis (one-time use)
    await cacheRedis.del(resetKey);

    // 12. Thu hồi TOÀN BỘ phiên đăng nhập cũ (Force re-login) bằng O(1) Tracking Set
    try {
      const userSessionsKey = `user_sessions:${resetPayload.userId}`;
      const sessionKeys = await cacheRedis.smembers(userSessionsKey);

      if (sessionKeys.length > 0) {
        await cacheRedis.del(...sessionKeys);
      }
      // Dọn dẹp key theo dõi
      await cacheRedis.del(userSessionsKey);
    } catch (err) {
      // Không throw - session expiry không nên block flow reset password
      console.error("[ResetPassword] Lỗi khi thu hồi session:", err);
    }

    return { message: "Đặt lại mật khẩu thành công! Vui lòng đăng nhập bằng mật khẩu mới." };
  }

  // 9. Lấy danh sách Identities của user
  async getIdentities(userId: string) {
    const identities = await UserIdentity.find({ user_id: userId }).select(
      "provider provider_email provider_email_verified createdAt"
    );
    return identities;
  }

  // 10. Liên kết thêm provider (Link Provider)
  async linkProvider(userId: string, provider: AuthProviderType, providerUserId: string, providerEmail: string) {
    const existing = await UserIdentity.findOne({ provider, provider_user_id: providerUserId });
    if (existing) {
      if (existing.user_id.toString() === userId) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Tài khoản này đã được liên kết từ trước.", AuthErrorCode.IDENTITY_ALREADY_LINKED);
      }
      throw new ApiError(httpStatus.BAD_REQUEST, "Tài khoản mạng xã hội này đã được liên kết với một người dùng khác.", AuthErrorCode.IDENTITY_ALREADY_LINKED);
    }

    const newIdentity = await UserIdentity.create({
      user_id: userId,
      provider,
      provider_user_id: providerUserId,
      provider_email: providerEmail,
      provider_email_verified: true,
    });

    if (provider === "google") {
      await User.updateOne({ _id: userId }, { $set: { googleId: providerUserId } });
    } else if (provider === "facebook") {
      await User.updateOne({ _id: userId }, { $set: { facebookId: providerUserId } });
    }

    return newIdentity;
  }

  // 11. Hủy liên kết provider (Unlink Provider)
  async unlinkProvider(userId: string, provider: AuthProviderType) {
    const identities = await UserIdentity.find({ user_id: userId });
    if (identities.length <= 1) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Không thể hủy liên kết phương thức đăng nhập cuối cùng. Bạn phải luôn có ít nhất 1 cách đăng nhập.",
        AuthErrorCode.CANNOT_UNLINK_LAST_PROVIDER
      );
    }

    const target = identities.find((i) => i.provider === provider);
    if (!target) {
      throw new ApiError(httpStatus.NOT_FOUND, "Phương thức liên kết không tồn tại trong tài khoản của bạn.");
    }

    await UserIdentity.deleteOne({ _id: target._id });

    // Cập nhật legacy fields trên User để giữ đồng bộ
    if (provider === "google") {
      await User.updateOne({ _id: userId }, { $unset: { googleId: 1 } });
    } else if (provider === "facebook") {
      await User.updateOne({ _id: userId }, { $unset: { facebookId: 1 } });
    }

    return { message: `Đã hủy liên kết ${provider} thành công.` };
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
