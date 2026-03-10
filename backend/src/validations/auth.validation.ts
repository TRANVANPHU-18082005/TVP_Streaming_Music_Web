import { z } from "zod";

// --- HELPERS ---
const passwordRule = z
  .string()
  .min(6, "Mật khẩu phải có ít nhất 6 ký tự")
  .max(100);
const emailRule = z.string().trim().email("Email không hợp lệ").toLowerCase();

// --- SCHEMAS ---
export const registerSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2, "Họ tên quá ngắn").max(50),
    email: emailRule,
    password: passwordRule,
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: emailRule,
    password: z.string().min(1, "Vui lòng nhập mật khẩu"),
  }),
});

export const verifyEmailSchema = z.object({
  query: z.object({
    token: z.string().min(1, "Thiếu Token xác thực"),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailRule,
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Thiếu Token"),
    newPassword: passwordRule,
  }),
});

// --- TYPES ---
export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type LoginInput = z.infer<typeof loginSchema>["body"];
