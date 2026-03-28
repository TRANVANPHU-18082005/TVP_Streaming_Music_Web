// src/features/auth/hooks/useLogin.ts
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAppDispatch } from "@/store/hooks";
import { loginUser } from "../slice/authSlice";
import { loginSchema, type LoginInput } from "../schemas/auth.schema";

export const useLogin = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const onSubmit = async (data: LoginInput) => {
    // Dispatch thunk thay vì gọi trực tiếp API
    const resultAction = await dispatch(loginUser(data));

    if (loginUser.fulfilled.match(resultAction)) {
      const { user } = resultAction.payload;

      // 1. Xử lý chuyển hướng đặc biệt
      if (user.mustChangePassword) {
        toast.warning("Yêu cầu bảo mật", {
          description: "Vui lòng đổi mật khẩu mới.",
        });
        return navigate("/force-change-password");
      }

      toast.success("Welcome back!", {
        description: `Logged in as ${user.fullName}`,
      });
      navigate("/");
    } else {
      // 2. Xử lý lỗi tập trung
      const errorPayload = resultAction.payload as any;
      handleAuthError(errorPayload, form, navigate);
    }
  };

  return {
    form,
    showPassword,
    toggleShowPassword: () => setShowPassword((prev) => !prev),
    onSubmit: form.handleSubmit(onSubmit),
  };
};

/**
 * Helper xử lý lỗi tập trung - Chuẩn Production
 */
const handleAuthError = (error: any, form: any, navigate: any) => {
  const errorCode = error.errorCode;
  const message = error.message || "Đăng nhập thất bại";

  switch (errorCode) {
    case "ACCOUNT_LOCKED":
      toast.error("Tài khoản đã bị khóa", {
        description: message,
        action: {
          label: "Hỗ trợ",
          onClick: () => (window.location.href = "mailto:support@musichub.com"),
        },
      });
      break;
    case "UNVERIFIED_ACCOUNT":
      toast.warning("Tài khoản chưa xác thực");
      navigate("/verify-otp", {
        state: { email: error.data?.email, isResend: true },
      });
      break;
    default:
      toast.error("Lỗi", { description: message });
      // Focus và đánh dấu lỗi đỏ cho Input
      form.setError("email", { type: "manual" });
      form.setError("password", { type: "manual" });
  }
};
