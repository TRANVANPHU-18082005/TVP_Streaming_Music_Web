import jwt from "jsonwebtoken";
import { Response } from "express";
import config, { isProd } from "../config/env";

// 1. Hàm tạo Token (Cho phép tùy chỉnh thời gian hết hạn của Refresh Token)
export const generateTokens = (
  userId: string,
  role: string,
  rememberMe: boolean = false, // <--- Thêm tham số này
) => {
  const accessToken = jwt.sign({ id: userId, role }, config.jwtSecret!, {
    expiresIn: "15m",
  });

  // Nếu remember -> 30 ngày, Không -> 7 ngày
  const refreshExpiresIn = rememberMe ? "30d" : "7d";

  const refreshToken = jwt.sign({ id: userId }, config.jwtRefreshSecret!, {
    expiresIn: refreshExpiresIn,
  });

  return { accessToken, refreshToken };
};

// 2. Hàm set Cookie (Cho phép tùy chỉnh maxAge)
export const setRefreshTokenCookie = (
  res: Response,
  token: string,
  rememberMe: boolean = false, // <--- Thêm tham số này
) => {
  // Tính mili-giây: 30 ngày hoặc 7 ngày
  const oneDay = 24 * 60 * 60 * 1000;
  const maxAge = rememberMe ? 30 * oneDay : 7 * oneDay;
  // For cross-origin OAuth flows we prefer 'none' in production (requires Secure).
  // For local development use 'lax' to be more permissive without HTTPS.
  const sameSiteOption: "lax" | "strict" | "none" = isProd() ? "none" : "lax";

  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: isProd(),
    sameSite: sameSiteOption,
    maxAge: maxAge, // <--- Động theo biến này
  });
};

// Clear cookie with same attributes as setRefreshTokenCookie to ensure removal
export const clearRefreshTokenCookie = (res: Response) => {
  const sameSiteOption: "lax" | "strict" | "none" = isProd() ? "none" : "lax";

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: isProd(),
    sameSite: sameSiteOption,
  });
};
