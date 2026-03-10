import { z } from "zod";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validations/auth.validation";

// Input DTOs (Dùng cho Request Body)
export type RegisterDTO = z.infer<typeof registerSchema>["body"];
export type LoginDTO = z.infer<typeof loginSchema>["body"];
export type RefreshTokenDTO = z.infer<typeof refreshTokenSchema>["body"];
export type ForgotPasswordDTO = z.infer<typeof forgotPasswordSchema>["body"];
export type ResetPasswordDTO = z.infer<typeof resetPasswordSchema>["body"];

// Response DTOs (Dùng để trả về Client - giúp FE biết sẽ nhận được gì)
export interface AuthResponseDTO {
  user: {
    _id: string;
    email: string;
    fullName: string;
    role: string;
    avatar?: string;
  };
  accessToken: string;
  refreshToken: string;
}
