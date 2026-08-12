import { z } from "zod";
// hepers
const passwordValidation = z
  .string()
  .min(8, "Mật khẩu phải từ 8 ký tự")
  .max(128, "Mật khẩu không được vượt quá 128 ký tự")
  .regex(/\d/, "Mật khẩu phải chứa ít nhất 1 số")
  .regex(/[A-Z]/, "Mật khẩu phải chứa ít nhất 1 chữ cái viết hoa")
  .regex(/[^A-Za-z0-9]/, "Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt");

const emailValidation = z.string().trim().email("Email không hợp lệ").toLowerCase();

// --- SCHEMAS ---
// Schema Đăng nhập
export const loginSchema = z.object({
  body: z.object({
    email: emailValidation,
    password: z.string().min(1, "Vui lòng nhập mật khẩu").max(128, "Mật khẩu quá dài"),
    rememberMe: z.boolean().optional(), 
  }),
});

// Schema Đăng ký
export const registerSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(3, "Tên đầy đủ phải từ 3 ký tự trở lên").max(50, "Tên không được vượt quá 50 ký tự"),
    email: emailValidation,
    password: passwordValidation,
  }),
});



export const verifyEmailSchema = z.object({
  body: z.object({
    email: emailValidation,
    otp: z.string().length(6, "Mã OTP phải có đúng 6 số").regex(/^\d+$/, "Mã OTP chỉ chứa số"),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailValidation,
  }),
});

export const resetPasswordSchema = z.object({
  params: z.object({
    token: z.string().optional(),
  }).optional(),
  body: z.object({
    token: z.string().optional(),
    newPassword: passwordValidation,
    confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu"),
  }).refine((data) => !data.newPassword || !data.confirmPassword || data.newPassword === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  }),
});

// --- TYPES ---
export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type LoginInput = z.infer<typeof loginSchema>["body"];
