import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import config from "../config/env";
import httpStatus from "http-status";
import ApiError from "../utils/ApiError";
import catchAsync from "../utils/catchAsync";
import UserModel, { IUser } from "../models/User"; // Đổi tên import model thành UserModel để tránh trùng tên

// --- SỬA LẠI KHAI BÁO TYPE ---
// Thay vì sửa Request, ta sửa interface User của Express
declare global {
  namespace Express {
    // Merge interface User rỗng của Express với IUser của bạn
    interface User extends IUser {}
  }
}

/**
 * 1. PROTECT (BẮT BUỘC LOGIN)
 */
export const protect = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next(
        new ApiError(httpStatus.UNAUTHORIZED, "Vui lòng đăng nhập để truy cập")
      );
    }

    try {
      const decoded: any = jwt.verify(token, config.jwtSecret!);

      // Every authenticated request loads the user so a role change or
      // lock applies on the next call. This repository has no timing, trace,
      // or load measurement that shows the lookup is a hot path, so it stays
      // uncached. Do not add a cache without that measurement and an
      // invalidation path for role and isActive.
      const currentUser = await UserModel.findById(decoded.id).populate(
        "artistProfile"
      ); // Dùng UserModel
      if (!currentUser) {
        return next(
          new ApiError(
            httpStatus.UNAUTHORIZED,
            "Tài khoản sở hữu token này không còn tồn tại"
          )
        );
      }
      // Locked accounts use ApiError so errorHandler owns the refresh cookie.
      if (!currentUser.isActive) {
        return next(
          new ApiError(
            httpStatus.FORBIDDEN,
            "Tài khoản của bạn đã bị khóa.",
            "ACCOUNT_LOCKED",
          ),
        );
      }
      // Gán user vào request
      // Lúc này TS hiểu req.user có kiểu là Express.User (cũng là IUser)
      req.user = currentUser;
      next();
    } catch (error) {
      return next(
        new ApiError(
          httpStatus.UNAUTHORIZED,
          "Token không hợp lệ hoặc đã hết hạn"
        )
      );
    }
  }
);

/**
 * 2. OPTIONAL AUTH (KHÔNG BẮT BUỘC)
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    req.user = undefined;
    return next();
  }

  try {
    const decoded: any = jwt.verify(token, config.jwtSecret!);
    // Same uncached read as protect. No measured hot path in this repository.
    const currentUser = await UserModel.findById(decoded.id).populate(
      "artistProfile"
    );

    // Inactive accounts stay anonymous so public routes keep working.
    req.user = currentUser && currentUser.isActive ? currentUser : undefined;
  } catch (error) {
    req.user = undefined;
  }

  next();
};

/**
 * 3. AUTHORIZE (PHÂN QUYỀN)
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Bây giờ req.user đã chuẩn Type, không cần ép kiểu 'as any' nữa
    // req.user?.role sẽ tự động gợi ý code
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new ApiError(
          httpStatus.FORBIDDEN,
          "Bạn không có quyền thực hiện hành động này"
        )
      );
    }
    next();
  };
};
