import { z } from "zod";

// Schema Đăng nhập
export const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu phải từ 6 ký tự"),
  rememberMe: z.boolean(), // <--- Thêm dòng này
});

const passwordValidation = z
  .string()
  .min(8, "Mật khẩu phải từ 8 ký tự")
  .regex(/\d/, "Mật khẩu phải chứa ít nhất 1 số")
  .regex(/[A-Z]/, "Mật khẩu phải chứa ít nhất 1 chữ cái viết hoa")
  .regex(/[^A-Za-z0-9]/, "Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt");

// Schema Đăng ký
export const registerSchema = z
  .object({
    fullName: z.string().min(3, "Tên phải từ 3 ký tự"),
    email: z.string().email("Email không hợp lệ"),
    password: passwordValidation,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu không khớp",
    path: ["confirmPassword"],
  });

// Schema OTP
export const otpSchema = z.object({
  otp: z.string().length(6, "Mã OTP phải có đúng 6 số"),
});
export const resetPasswordSchema = z
  .object({
    password: passwordValidation,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu không khớp",
    path: ["confirmPassword"],
  });
export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email không được để trống").email("Email không hợp lệ"),
});

// Export Type để dùng trong Form
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type OtpInput = z.infer<typeof otpSchema>;

