// src/features/auth/hooks/useLogin.ts
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAppDispatch } from "@/store/hooks";
import { loginUser } from "../slice/authSlice";
import { loginSchema, type LoginInput } from "../schemas/auth.schema";

export const useLogin = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const [showPassword, setShowPassword] = useState(false);
  const [requiredProviders, setRequiredProviders] = useState<string[]>([]);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema) as any,
    mode: "onChange",
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const onSubmit = async (data: LoginInput) => {
    setRequiredProviders([]); // Reset state trước khi submit
    const resultAction = await dispatch(loginUser(data));
    if (loginUser.fulfilled.match(resultAction)) {
      const { user } = resultAction.payload;

      if (user.mustChangePassword) {
        toast.warning("Yêu cầu bảo mật", {
          description: "Vui lòng đổi mật khẩu mới.",
        });
        return navigate("/force-change-password");
      }

      toast.success("Xin chào!", {
        description: `Đã đăng nhập với tư cách ${user.fullName}`,
      });
      // Redirect về trang được yêu cầu (VD: /rooms/:code) hoặc trang chủ
      const nextUrl = searchParams.get("next");
      navigate(nextUrl && nextUrl.startsWith("/") ? nextUrl : "/");
    } else {
      const errorPayload = resultAction.payload as any;
      handleAuthError(errorPayload, form, navigate, setRequiredProviders);
    }
  };

  return {
    form,
    showPassword,
    toggleShowPassword: () => setShowPassword((prev) => !prev),
    onSubmit: form.handleSubmit(onSubmit),
    requiredProviders,
    resetRequiredProviders: () => setRequiredProviders([]),
  };
};

/**
 * Helper xử lý lỗi tập trung - Chuẩn Production & Enterprise
 */
const handleAuthError = (
  error: any,
  form: any,
  navigate: any,
  setRequiredProviders: (providers: string[]) => void
) => {
  const server = error?.response?.data ?? error;
  const errorCode = server?.errorCode ?? server?.data?.errorCode;
  const message = server?.message ?? error?.message ?? "Đăng nhập thất bại";

  switch (errorCode) {
    case "LOGIN_METHOD_REQUIRED": {
      const providers = server?.data?.providers || [];
      if (providers.length > 0) {
        setRequiredProviders(providers);
        toast.info("Yêu cầu phương thức xác thực", {
          description: "Vui lòng tiếp tục với tài khoản mạng xã hội đã liên kết.",
        });
        return;
      }
      toast.error("Lỗi xác thực", { description: message });
      break;
    }
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
      form.setError("email", { type: "manual" });
      form.setError("password", { type: "manual" });
  }
};

