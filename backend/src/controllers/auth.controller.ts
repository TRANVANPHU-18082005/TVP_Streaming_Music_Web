import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import passport from "passport";
import httpStatus from "http-status"; // Import thêm enum status
import catchAsync from "../utils/catchAsync";
import AuthService from "../services/auth.service";
import {
  generateTokens,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} from "../utils/token";
import logger from "../config/logger";
import config from "../config/env";
import User, { IUser } from "../models/User";
import crypto from "crypto";
import { cacheRedis } from "../config/redis";

// 1. Google Auth (Start)
export const googleAuth = passport.authenticate("google", {
  scope: ["profile", "email"],
  session: false,
});

// 2. Google Callback (End)
export const googleCallbackHandler = async (req: Request, res: Response) => {
  const user: any = req.user;

  if (!user) {
    return res.redirect(`${config.clientUrl}/login?error=auth_failed`);
  }

  const { accessToken, refreshToken } = generateTokens(
    user._id.toString(),
    user.role,
  );

  await AuthService.saveSession(user._id.toString(), refreshToken);
  
  // BẢO MẬT: Không đẩy thẳng token lên URL.
  // Dùng Code Exchange pattern.
  const authCode = crypto.randomBytes(32).toString("hex");
  await cacheRedis.setex(
    `social_auth:${authCode}`,
    60,
    JSON.stringify({ accessToken, refreshToken, userId: user._id.toString() })
  );

  logger.info(`Generated social auth code for user=${user._id}`);
  res.redirect(`${config.clientUrl}/auth/google/callback?code=${authCode}`);
};

// 2b. Social Code Exchange (Mới thêm)
export const exchangeSocialCode = catchAsync(async (req: Request, res: Response) => {
  const { code } = req.body;
  if (!code) return res.status(httpStatus.BAD_REQUEST).json({ message: "Thiếu code" });

  const redisKey = `social_auth:${code}`;
  const dataStr = await cacheRedis.get(redisKey);

  if (!dataStr) {
    return res.status(httpStatus.BAD_REQUEST).json({ message: "Code không hợp lệ hoặc đã hết hạn" });
  }

  const { accessToken, refreshToken, userId } = JSON.parse(dataStr);
  await cacheRedis.del(redisKey); // Đảm bảo code chỉ dùng 1 lần

  const user = await User.findById(userId);
  if (!user) return res.status(httpStatus.NOT_FOUND).json({ message: "User không tồn tại" });

  setRefreshTokenCookie(res, refreshToken);

  res.status(httpStatus.OK).json({
    success: true,
    data: {
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        avatar: user.avatar,
      },
    },
  });
});

// Facebook Auth (Start)
export const facebookAuth = passport.authenticate("facebook", {
  scope: ["email"],
  session: false,
});

// Facebook Callback (End)
export const facebookCallbackHandler = async (req: Request, res: Response) => {
  const user: any = req.user;

  if (!user) {
    return res.redirect(`${config.clientUrl}/login?error=auth_failed`);
  }

  const { accessToken, refreshToken } = generateTokens(
    user._id.toString(),
    user.role,
  );

  await AuthService.saveSession(user._id.toString(), refreshToken);
  
  // BẢO MẬT: Dùng Code Exchange pattern
  const authCode = crypto.randomBytes(32).toString("hex");
  await cacheRedis.setex(
    `social_auth:${authCode}`,
    60,
    JSON.stringify({ accessToken, refreshToken, userId: user._id.toString() })
  );

  logger.info(`Generated social auth code for user=${user._id}`);
  res.redirect(`${config.clientUrl}/auth/facebook/callback?code=${authCode}`);
};

// 3. Register
export const register = catchAsync(async (req: Request, res: Response) => {
  const user = await AuthService.register(req.body);

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Đăng ký thành công. Vui lòng kiểm tra email.",
    data: {
      email: user.email,
    },
  });
});

// 4. Verify Email
export const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  // Lấy otp từ query hoặc body tùy thiết kế FE (Validation schema của bạn dùng query? Kiểm tra lại)
  // Trong schema trước bạn define: query: { token: ... } -> nên lấy từ req.query
  // Nhưng ở đây bạn dùng req.body.otp -> Hãy thống nhất.
  // Code dưới đây hỗ trợ cả hai cho linh hoạt
  const email = req.body.email || req.query.email;
  const otp = req.body.otp || req.query.token;

  const result = await AuthService.verifyEmail(email, otp);

  setRefreshTokenCookie(res, result.refreshToken);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Xác thực thành công!",
    data: {
      accessToken: result.accessToken,
      user: {
        id: result.user._id,
        username: result.user.username,
        fullName: result.user.fullName,
        role: result.user.role,
        email: result.user.email,
        avatar: result.user.avatar,
      },
    },
  });
});

// 5. Login
export const login = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.login(req.body);

  // Case: Chưa verify
  if (result.status === "UNVERIFIED") {
    return res.status(httpStatus.FORBIDDEN).json({
      success: false,
      errorCode: "UNVERIFIED_ACCOUNT",
      message: "Tài khoản chưa được xác thực",
      data: {
        email: result.user.email,
      },
    });
  }

  // Case: Success
  setRefreshTokenCookie(res, result.refreshToken!, req.body.rememberMe);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Đăng nhập thành công",
    data: {
      accessToken: result.accessToken,
      user: {
        id: result.user._id,
        email: result.user.email,
        username: result.user.username,
        fullName: result.user.fullName,
        role: result.user.role,
        avatar: result.user.avatar,
      },
    },
  });
});

// 6. Refresh Token
export const refreshAccessToken = catchAsync(
  async (req: Request, res: Response) => {
    const cookieToken = req.cookies.refreshToken; // Hoặc req.body.refreshToken
    const result = await AuthService.refreshToken(cookieToken);

    setRefreshTokenCookie(res, result.refreshToken);

    res.status(httpStatus.OK).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        user: {
          id: result.user._id,
          username: result.user.username,
          email: result.user.email,
          fullName: result.user.fullName,
          role: result.user.role,
          avatar: result.user.avatar,
        },
      },
    });
  },
);

// 7. Get Me
export const getMe = (req: Request, res: Response) => {
  res.status(httpStatus.OK).json({
    success: true,
    data: req.user,
  });
};

// 8. Logout
export const logout = catchAsync(async (req: Request, res: Response) => {
  const currentUserId = req.user
    ? (req.user as IUser)._id.toString()
    : undefined;

  // If we have an authenticated user, revoke server-side refresh token
  const cookieToken = req.cookies?.refreshToken;

  if (currentUserId) {
    await AuthService.logout(currentUserId, cookieToken);
  } else {
    // Fallback: try to decode refresh cookie and revoke that session server-side
    if (cookieToken) {
      try {
        const decoded: any = jwt.verify(cookieToken, config.jwtRefreshSecret!);
        const cookieUserId = decoded?.id;
        if (cookieUserId) await AuthService.logout(cookieUserId, cookieToken);
      } catch (err) {
        // ignore invalid token — still proceed to clear cookie
      }
    }
  }

  // Clear client cookie in all cases (use helper to match cookie attributes)
  clearRefreshTokenCookie(res);
  res
    .status(httpStatus.OK)
    .json({ success: true, message: "Đăng xuất thành công" });
});

// 9. Resend OTP
export const resendOtp = catchAsync(async (req: Request, res: Response) => {
  await AuthService.resendOtp(req.body.email);
  res.status(httpStatus.OK).json({
    success: true,
    message: "Đã gửi lại mã xác thực vào email",
  });
});

// 10. Forgot Password
export const forgotPassword = catchAsync(
  async (req: Request, res: Response) => {
    await AuthService.forgotPassword(req.body.email);
    res.status(httpStatus.OK).json({
      success: true,
      message: "Vui lòng kiểm tra email để đặt lại mật khẩu.",
    });
  },
);

// 11. Reset Password
export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  // Lưu ý: req.body.newPassword phải khớp với validation schema
  await AuthService.resetPassword(
    req.body.token || req.params.token,
    req.body.newPassword,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại.",
  });
});
