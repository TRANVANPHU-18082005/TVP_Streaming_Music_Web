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

export type AuthProviderType = "password" | "google" | "facebook" | "github" | "apple" | "microsoft";

export interface UserIdentity {
  _id: string;
  user_id: string;
  provider: AuthProviderType;
  provider_user_id?: string;
  provider_email?: string;
  provider_email_verified: boolean;
  createdAt: string;
}

export enum AuthErrorCode {
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  ACCOUNT_NOT_FOUND = "ACCOUNT_NOT_FOUND",
  ACCOUNT_DISABLED = "ACCOUNT_DISABLED",
  ACCOUNT_LOCKED = "ACCOUNT_LOCKED",
  EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED",
  LOGIN_METHOD_REQUIRED = "LOGIN_METHOD_REQUIRED",
  IDENTITY_ALREADY_LINKED = "IDENTITY_ALREADY_LINKED",
  PROVIDER_EMAIL_NOT_VERIFIED = "PROVIDER_EMAIL_NOT_VERIFIED",
  CANNOT_UNLINK_LAST_PROVIDER = "CANNOT_UNLINK_LAST_PROVIDER",
  TOO_MANY_ATTEMPTS = "TOO_MANY_ATTEMPTS",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  INVALID_REFRESH_TOKEN = "INVALID_REFRESH_TOKEN",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
}

