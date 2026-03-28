import { Request, Response } from "express";
import passport from "passport";
import httpStatus from "http-status"; // Import thêm enum status
import catchAsync from "../utils/catchAsync";
import AuthService from "../services/auth.service";
import { generateTokens, setRefreshTokenCookie } from "../utils/token";
import { IUser } from "../models/User";

// 1. Google Auth (Start)
export const googleAuth = passport.authenticate("google", {
  scope: ["profile", "email"],
  session: false,
});

// 2. Google Callback (End)
export const googleCallbackHandler = async (req: Request, res: Response) => {
  const user: any = req.user;

  if (!user) {
    return res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
  }

  const { accessToken, refreshToken } = generateTokens(user._id, user.role);

  user.refreshToken = refreshToken;
  await user.save();
  setRefreshTokenCookie(res, refreshToken);

  res.redirect(`${process.env.CLIENT_URL}/auth/google?token=${accessToken}`);
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
  if (currentUserId) {
    await AuthService.logout(currentUserId);
  }
  res.clearCookie("refreshToken");
  res.status(httpStatus.OK).json({
    success: true,
    message: "Đăng xuất thành công",
  });
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
