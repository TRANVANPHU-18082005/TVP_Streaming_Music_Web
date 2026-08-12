import type {
  LoginResponse,
  RegisterResponse,
  RefreshResponse,
  LoginRequest,
  RegisterRequest,
  ChangePasswordRequest,
  ClaimProfileRequest,
  UserIdentity,
  AuthProviderType,
} from "@/features/auth/types";
import type { UserProfile } from "@/features/user";
import api from "@/lib/axios";
import type { ApiErrorResponse, ApiResponse } from "@/types";

const authApi = {
  // =================================================================
  // 🟢 PUBLIC ROUTES (Không cần Token)
  // =================================================================

  // 1. Đăng nhập
  login: async (payload: LoginRequest): Promise<ApiResponse<LoginResponse>> => {
    const res = await api.post<ApiResponse<LoginResponse>>(
      "/auth/login",
      payload
    );
    return res.data;
  },

  // 2. Đăng ký
  register: async (
    payload: RegisterRequest,
    secret?: string
  ): Promise<ApiResponse<RegisterResponse>> => {
    const res = await api.post<ApiResponse<RegisterResponse>>(
      `/auth/register${secret ? `/admin/${secret}` : ""}`,
      payload
    );
    return res.data;
  },

  // 3. Xác thực Email (OTP)
  verifyEmail: async (payload: {
    email: string;
    otp: string;
  }): Promise<ApiResponse<LoginResponse>> => {
    const res = await api.post<ApiResponse<LoginResponse>>(
      "/auth/verify-email",
      payload
    );
    return res.data;
  },

  // 4. Gửi lại mã OTP
  resendOtp: async (email: string): Promise<ApiResponse<void>> => {
    const res = await api.post<ApiResponse<void>>("/auth/resend-otp", {
      email,
    });
    return res.data;
  },

  // 5. Làm mới Access Token
  refreshAuth: async (): Promise<ApiResponse<RefreshResponse>> => {
    const res = await api.post<ApiResponse<RefreshResponse>>(
      "/auth/refresh-token"
    );

    return res.data;
  },

  // 6. Quên mật khẩu (Gửi mail)
  forgotPassword: async (email: string): Promise<ApiResponse<void>> => {
    const res = await api.post<ApiResponse<void>>("/auth/forgot-password", {
      email,
    });
    return res.data;
  },

  // 7. Đặt lại mật khẩu (Từ mail quên mật khẩu)
  resetPassword: async (
    token: string,
    password: string,
    confirmPassword?: string
  ): Promise<ApiResponse<void>> => {
    const res = await api.post<ApiResponse<void>>(
      `/auth/reset-password/${token}`,
      { newPassword: password, confirmPassword: confirmPassword ?? password }
    );
    return res.data;
  },

  // =================================================================
  // 🔒 PROTECTED ROUTES (Cần Token)
  // =================================================================

  // 8. Lấy thông tin bản thân (Me)
  // Support truyền token thủ công cho trường hợp vừa login xong hoặc Google Callback
  getMe: async (token?: string) => {
    const config = token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : {};
    const res = await api.get<ApiResponse<UserProfile>>("/auth/me", config);
    return res.data;
  },

  // 9. Đổi mật khẩu (Dùng cho cả Force Change Password)
  changePassword: async (
    payload: ChangePasswordRequest
  ): Promise<ApiResponse<void>> => {
    const res = await api.post<ApiResponse<void>>(
      "/users/change-password", // Lưu ý: Check lại route bên backend xem là /auth hay /users
      payload
    );
    return res.data;
  },

  // 10. Claim Profile (Dành cho tài khoản Shadow/Artist ảo)
  claimProfile: async (
    payload: ClaimProfileRequest
  ): Promise<ApiResponse<void>> => {
    const res = await api.post<ApiResponse<void>>(
      "/users/claim-profile",
      payload
    );
    return res.data;
  },

  // 11. Đăng xuất
  logout: async (): Promise<void> => {
    try {
      await api.post("/auth/logout");
    } catch (err: unknown) {
      const error = err as ApiErrorResponse;

      console.warn(error.response?.data?.message);
    }
  },

  // 12. Social Auth Code Exchange
  exchangeSocialCode: async (code: string): Promise<ApiResponse<LoginResponse>> => {
    const res = await api.post<ApiResponse<LoginResponse>>("/auth/social/exchange", { code });
    return res.data;
  },

  // 13. Lấy danh sách tài khoản liên kết (Identities)
  getIdentities: async (): Promise<ApiResponse<UserIdentity[]>> => {
    const res = await api.get<ApiResponse<UserIdentity[]>>("/auth/identities");
    return res.data;
  },

  // 14. Liên kết tài khoản mạng xã hội
  linkProvider: async (payload: { provider: AuthProviderType; providerUserId: string; providerEmail: string }): Promise<ApiResponse<UserIdentity>> => {
    const res = await api.post<ApiResponse<UserIdentity>>("/auth/link-provider", payload);
    return res.data;
  },

  // 15. Hủy liên kết tài khoản mạng xã hội
  unlinkProvider: async (provider: AuthProviderType): Promise<ApiResponse<{ message: string }>> => {
    const res = await api.delete<ApiResponse<{ message: string }>>(`/auth/unlink-provider/${provider}`);
    return res.data;
  },
};

export default authApi;
