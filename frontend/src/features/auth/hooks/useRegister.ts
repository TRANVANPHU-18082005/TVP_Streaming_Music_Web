interface ApiErrorResponse {
  response?: {
    data?: {
      message?: string;
      errorCode?: string;
      errors?: Array<{ field: string; message: string }>;
    };
  };
}
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// API & Schema
import authApi from "@/features/auth/api/authApi";
import { registerSchema, type RegisterInput } from "../schemas/auth.schema";

// Constants cho Password Strength
const PASSWORD_REQUIREMENTS = [
  { id: 1, label: "8+ ký tự", regex: /.{8,}/ },
  { id: 2, label: "Số", regex: /\d/ },
  { id: 3, label: "Chữ cái viết hoa", regex: /[A-Z]/ },
  { id: 4, label: "Ký tự đặc biệt", regex: /[^A-Za-z0-9]/ },
];

// Interface cho lỗi API (để tránh dùng any)

export const useRegister = () => {
  const navigate = useNavigate();

  // State UI local
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false); // Để hiện checklist khi focus password

  // 1. Setup Form
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema) as any,
    mode: "onBlur", // Validate khi rời ô input
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const { watch, setError } = form;
  const passwordValue = watch("password", "");
  const confirmPasswordValue = watch("confirmPassword", "");

  // 2. Logic Tính độ mạnh mật khẩu (Real-time)
  const requirementsStatus = useMemo(() => {
    return PASSWORD_REQUIREMENTS.map((req) => ({
      ...req,
      met: req.regex.test(passwordValue || ""),
    }));
  }, [passwordValue]);

  const strengthScore = requirementsStatus.filter((r) => r.met).length;

  // Helper lấy màu và text cho thanh độ mạnh
  const strengthInfo = useMemo(() => {
    if (strengthScore === 0)
      return {
        label: "Nhập mật khẩu",
        color: "bg-gray-700",
        textColor: "text-gray-500",
      };
    if (strengthScore <= 2)
      return { label: "Yếu", color: "bg-red-500", textColor: "text-red-400" };
    if (strengthScore === 3)
      return {
        label: "Trung bình",
        color: "bg-yellow-500",
        textColor: "text-yellow-400",
      };
    return {
      label: "Mạnh",
      color: "bg-emerald-500",
      textColor: "text-emerald-400",
    };
  }, [strengthScore]);

  const isMatch =
    confirmPasswordValue.length > 0 && passwordValue === confirmPasswordValue;

  // 3. Handle Submit
  const handleRegister = async (data: RegisterInput) => {
    try {
      console.log(data);
      await authApi.register(data);

      toast.success("Đăng ký thành công!", {
        description: "Vui lòng kiểm tra email để xác thực tài khoản.",
      });

      navigate("/verify-otp", { state: { email: data.email } });
    } catch (err: unknown) {
      const error = err as ApiErrorResponse;
      console.log("Error register: ", error);
      const dataError = error.response?.data;
      const msg = dataError?.message || "Đăng ký thất bại";

      if (dataError?.errors && Array.isArray(dataError.errors)) {
        // Tự động map tất cả lỗi Zod từ backend trả về vào đúng field tương ứng
        dataError.errors.forEach((errDetail) => {
          // errDetail.field thường có dạng "body.email", "body.password"...
          const fieldParts = errDetail.field.split(".");
          const fieldName = fieldParts[fieldParts.length - 1] as keyof RegisterInput;
          setError(fieldName, { type: "manual", message: errDetail.message });
        });
      } else {
        // Lỗi logic khác (Rate limit, lỗi máy chủ) -> Show thông báo
        toast.error(msg);
      }
    }
  };

  const toggleShowPassword = () => setShowPassword(!showPassword);

  return {
    form, // Trả về cả instance form
    onSubmit: form.handleSubmit(handleRegister),

    // UI Helpers
    showPassword,
    toggleShowPassword,
    isFocused,
    setIsFocused,
    passwordValue,
    confirmPasswordValue,
    requirementsStatus,
    strengthScore,
    strengthInfo,
    isMatch,
  };
};
