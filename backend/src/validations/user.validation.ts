import { z } from "zod";

// --- HELPERS ---
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ");
const passwordRule = z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự");
const emailRule = z.string().trim().email("Email không hợp lệ").toLowerCase();

const usernameRule = z
  .string()
  .trim()
  .min(3, "Username tối thiểu 3 ký tự")
  .max(30, "Username tối đa 30 ký tự")
  .regex(
    /^[a-z0-9_]+$/,
    "Username chỉ được chứa chữ thường, số và dấu gạch dưới",
  );

// --- 1. USER ACTIONS (Người dùng tự thao tác) ---

export const updateProfileSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2).max(50).optional(),
    username: usernameRule.optional(),
    bio: z.string().max(500).optional(),

    // User KHÔNG ĐƯỢC tự đổi email ở đây (thường phải qua quy trình riêng verify lại)
    // avatar, social links...
    avatar: z.string().url().optional().or(z.literal("")),
    facebook: z.string().url().optional().or(z.literal("")),
    instagram: z.string().url().optional().or(z.literal("")),
  }),
});

export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại"),
      newPassword: passwordRule,
      confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu mới"),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: "Mật khẩu xác nhận không khớp",
      path: ["confirmPassword"],
    }),
});

// --- 2. ADMIN ACTIONS (Admin quản lý) ---

export const getUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    keyword: z.string().trim().optional(),
    role: z.enum(["user", "artist", "admin"]).optional(),
    isActive: z.enum(["true", "false"]).optional(),
    isVerified: z.enum(["true", "false"]).optional(),
    sort: z.enum(["newest", "oldest", "popular", "name"]).default("newest"),
  }),
});

export const getUserDetailSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

// 🔥 [FIX] Admin Create User: Phải là Body, không có Params ID
export const adminCreateUserSchema = z.object({
  body: z.object({
    // Các trường bắt buộc khi tạo mới
    fullName: z.string().trim().min(2, "Họ tên là bắt buộc").max(50),
    email: emailRule, // ✅ Bắt buộc
    password: passwordRule, // ✅ Bắt buộc

    // Các trường tùy chọn (có default value bên Controller/Model)
    role: z.enum(["user", "artist", "admin"]).optional(),
    isActive: z.boolean().optional(),
    bio: z.string().optional(),
  }),
});

// 🔥 [FIX] Admin Update User: Thêm Email & Password
export const adminUpdateUserSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    fullName: z.string().trim().min(2).max(50).optional(),
    // ✅ Admin được quyền sửa Email (Controller phải check duplicate)
    email: emailRule.optional(),
    // ✅ Admin được quyền Reset Password cho user (không cần pass cũ)
    password: passwordRule.optional(),
    role: z.enum(["user", "artist", "admin"]).optional(),
  }),
});

// --- TYPES ---
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>["body"];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>["body"];
export type UserFilterInput = z.infer<typeof getUsersSchema>["query"];
export type AdminCreateUserInput = z.infer<
  typeof adminCreateUserSchema
>["body"];
export type AdminUpdateUserInput = z.infer<
  typeof adminUpdateUserSchema
>["body"];
