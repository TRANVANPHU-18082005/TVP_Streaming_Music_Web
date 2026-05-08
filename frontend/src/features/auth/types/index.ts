import { IUser } from "@/features/user";

// ✅ Dữ liệu trả về từ backend
export interface AuthDto<TUser> {
  accessToken: string;
  refreshToken: string;
  user: TUser;
}

// ✅ Mô tả user trong hệ thống

// ✅ Redux slice state
export interface AuthState<TUser = IUser> {
  token: string | null;
  user: TUser | null;
  isAuthChecking: boolean;
}

// ✅ Request/Response dạng API
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe: boolean;
}
export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
}
export interface ForgetPasswordRequest {
  email: string;
}
export interface ForgetPasswordResponse {
  email: string;
}
// Các type cũ giữ nguyên (LoginRequest, RegisterRequest...)

// Type cho Đổi mật khẩu
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Type cho Claim Profile (Nhận tài khoản ảo)
export interface ClaimProfileRequest {
  newEmail: string;
  newPassword: string;
}
export type LoginResponse = AuthDto<IUser>;
export type RegisterResponse = AuthDto<IUser>;
export type RefreshResponse = AuthDto<IUser>;
