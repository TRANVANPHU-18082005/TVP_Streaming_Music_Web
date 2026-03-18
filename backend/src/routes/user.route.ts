import express from "express";
import { protect, authorize } from "../middlewares/auth.middleware";
import validate from "../middlewares/validate"; // Middleware validate request
import * as userController from "../controllers/user.controller";

// Import các Schema validation đã viết trước đó
import {
  updateProfileSchema,
  changePasswordSchema,
  getUsersSchema,
  adminUpdateUserSchema,
  // Giả sử bạn tái sử dụng registerSchema hoặc tạo schema riêng cho admin create
  adminCreateUserSchema,
} from "../validations/user.validation";
import { toggleFollowSchema } from "../validations/follow.validate";
import { uploadImages } from "../config/upload";

const router = express.Router();

// ==========================================
// 🟢 PUBLIC ROUTES
// ==========================================

// Xem profile người khác (VD: /users/123/profile)
// (Cho phép optional auth để check follow status)
router.get(
  "/:id/profile",
  // Có thể thêm middleware 'optionalAuth' nếu muốn check follow cho guest login
  // Ở đây dùng logic trong controller để handle req.user nếu có
  userController.getPublicProfile,
);

// ==========================================
// 🟠 PRIVATE ROUTES (User Logged In)
// ==========================================
router.use(protect); // Áp dụng bảo vệ cho tất cả route bên dưới

// Update Profile bản thân
router.patch(
  "/profile",
  uploadImages.single("avatar"),
  validate(updateProfileSchema), // Validate body
  userController.updateProfile,
);

// Đổi mật khẩu
router.post(
  "/change-password",
  validate(changePasswordSchema),
  userController.changePassword,
);

// ==========================================
// 🔴 ADMIN ONLY ROUTES
// ==========================================
// Middleware check quyền Admin cho cụm dưới
router.use(authorize("admin"));

// Lấy danh sách users (có filter/search)
router.get("/", validate(getUsersSchema), userController.getUsers);

// Tạo User mới (bởi Admin)
router.post(
  "/",
  uploadImages.single("avatar"),
  validate(adminCreateUserSchema),
  userController.createUser,
);

// Update User bất kỳ (Ban/Unban, Verify, Role...)
// Thay thế cho route 'block' cũ -> Linh hoạt hơn
router.patch(
  "/:id",
  uploadImages.single("avatar"),
  validate(adminUpdateUserSchema),
  userController.updateUser,
);
router.post("/:id/block", userController.toggleBlock);

// Xóa User (Hard Delete)
// Validate ID qua middleware nếu cần (thường adminUpdateUserSchema đã có validate params id)
router.delete("/:id", userController.deleteUser);

export default router;
