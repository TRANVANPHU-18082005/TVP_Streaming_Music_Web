interface ApiErrorResponse {
  response?: {
    data?: {
      message?: string;
      errorCode?: string;
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
  { id: 1, label: "8+ chars", regex: /.{8,}/ },
  { id: 2, label: "Number", regex: /\d/ },
  { id: 3, label: "Uppercase", regex: /[A-Z]/ },
  { id: 4, label: "Special char", regex: /[^A-Za-z0-9]/ },
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
      fullName: "", // Thay fullName bằng username nếu schema của bạn là username
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
        label: "Enter Password",
        color: "bg-gray-700",
        textColor: "text-gray-500",
      };
    if (strengthScore <= 2)
      return { label: "Weak", color: "bg-red-500", textColor: "text-red-400" };
    if (strengthScore === 3)
      return {
        label: "Medium",
        color: "bg-yellow-500",
        textColor: "text-yellow-400",
      };
    return {
      label: "Strong",
      color: "bg-emerald-500",
      textColor: "text-emerald-400",
    };
  }, [strengthScore]);

  const isMatch =
    confirmPasswordValue.length > 0 && passwordValue === confirmPasswordValue;

  // 3. Handle Submit
  const handleRegister = async (data: RegisterInput) => {
    try {
      await authApi.register(data);

      toast.success("Account created successfully!", {
        description: "Please check your email to verify your account.",
      });

      // Chuyển hướng sang trang OTP, mang theo email
      navigate("/verify-otp", { state: { email: data.email } });
    } catch (err: unknown) {
      const error = err as ApiErrorResponse;
      const msg = error.response?.data?.message || "Registration failed";

      // Map lỗi server vào input
      if (
        msg.toLowerCase().includes("email") ||
        msg.toLowerCase().includes("tồn tại")
      ) {
        setError("email", { type: "manual", message: msg });
      } else if (
        msg.toLowerCase().includes("name") ||
        msg.toLowerCase().includes("username")
      ) {
        // Lưu ý: Check xem schema bạn dùng key là 'username' hay 'fullName' để setError đúng field
        setError("fullName", { type: "manual", message: msg });
      } else {
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
