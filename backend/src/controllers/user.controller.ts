import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import UserService from "../services/user.service";
import { UserFilterInput } from "../validations/user.validation";

// 1. PUBLIC: Xem profile (Check follow nếu đã login)
export const getPublicProfile = catchAsync(
  async (req: Request, res: Response) => {
    // req.user có thể undefined nếu chưa login (dùng optional chaining)
    const currentUserId = req.user ? req.user._id.toString() : undefined;

    const user = await UserService.getPublicProfile(
      req.params.id,
      currentUserId,
    );

    res.status(httpStatus.OK).json({
      success: true,
      data: user,
    });
  },
);

// 2. PRIVATE: Update Profile (User tự sửa)
export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const user = await UserService.updateProfile(
    req.user!._id.toString(),
    req.body,
    req.file,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Cập nhật hồ sơ thành công",
    data: user,
  });
});

// 3. PRIVATE: Change Password
export const changePassword = catchAsync(
  async (req: Request, res: Response) => {
    await UserService.changePassword(req.user!._id.toString(), req.body);

    res.status(httpStatus.OK).json({
      success: true,
      message: "Đổi mật khẩu thành công",
    });
  },
);

// 4. PRIVATE: Toggle Follow (Follow/Unfollow)
export const toggleFollow = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.toggleFollow(
    req.user!._id.toString(),
    req.params.id,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: result.isFollowing ? "Đã theo dõi" : "Đã hủy theo dõi",
    data: result,
  });
});

// --- ADMIN CONTROLLERS ---

// 5. ADMIN: Get List Users
export const getUsers = catchAsync(async (req: Request, res: Response) => {
  // Ép kiểu query sang FilterDTO
  const filter = req.query as unknown as UserFilterInput;

  const result = await UserService.getUsers(filter);

  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});

// 6. ADMIN: Create User
export const createUser = catchAsync(async (req: Request, res: Response) => {
  const user = await UserService.createUserByAdmin(req.body, req.file);

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Tạo tài khoản thành công",
    data: user,
  });
});

// 7. ADMIN: Update User (Ban/Unban/Verify/Change Role)
// Thay thế cho toggleBlock cũ -> Linh hoạt hơn
export const updateUser = catchAsync(async (req: Request, res: Response) => {
  const user = await UserService.updateUserByAdmin(
    req.params.id,
    req.body,
    req.file,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Cập nhật tài khoản thành công",
    data: user,
  });
});

// 8. ADMIN: Delete User (Hard Delete & Cleanup)
export const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.deleteUser(req.params.id);

  res.status(httpStatus.OK).json({
    success: true,
    message: result.message,
  });
});
// Admin: Block User
export const toggleBlock = catchAsync(async (req: Request, res: Response) => {
  const user = await UserService.toggleBlockUser(req.params.id);
  res.json({
    success: true,
    message: user.isActive ? "Đã mở khóa tài khoản" : "Đã khóa tài khoản",
    data: user,
  });
});
