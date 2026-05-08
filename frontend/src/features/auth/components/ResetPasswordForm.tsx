import React, { useState, useMemo } from "react";
import { Lock, Eye, EyeOff, Disc, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import authApi from "@/features/auth/api/authApi";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/features/auth/schemas/auth.schema";
import type { ApiErrorResponse } from "@/types";

// --- CONSTANTS ---
const PASSWORD_REQUIREMENTS = [
  { id: 1, label: "8+ chars", regex: /.{8,}/ },
  { id: 2, label: "Number", regex: /\d/ },
  { id: 3, label: "Uppercase", regex: /[A-Z]/ },
  { id: 4, label: "Special char", regex: /[^A-Za-z0-9]/ },
];

// --- UI COMPONENTS (Giữ nguyên style của bạn) ---

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "neon" | "ghost";
  isLoading?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = "neon",
  isLoading,
  ...props
}) => {
  const variants = {
    neon: "bg-white text-black hover:bg-gray-100 shadow-lg shadow-white/5 border border-transparent",
    ghost: "bg-transparent text-gray-400 hover:text-white hover:bg-white/5",
  };
  return (
    <button
      className={cn(
        "relative group w-full h-12 rounded-2xl font-semibold text-sm transition-all duration-300 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden flex items-center justify-center",
        variants[variant],
        className,
      )}
      {...props}
    >
      <span className="relative flex items-center justify-center gap-2">
        {isLoading && <Disc className="animate-spin h-4 w-4" />}
        {children}
      </span>
    </button>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon: React.ElementType;
  label: string;
  error?: boolean;
}

const InputField = React.forwardRef<HTMLInputElement, InputProps>(
  ({ icon: Icon, className, label, id, error, ...props }, ref) => (
    <div className="relative group w-full">
      <div
        className={cn(
          "absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500",
          error && "from-red-500/30 to-red-500/30 opacity-100",
        )}
      />
      <div className="relative w-full">
        <div
          className={cn(
            "absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none transition-colors duration-300",
            error
              ? "text-red-400"
              : "text-gray-400 group-focus-within:text-white",
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
        <input
          ref={ref}
          id={id}
          className={cn(
            "w-full h-12 bg-white/5 hover:bg-white/10 rounded-2xl border text-white pl-11 pr-4 outline-none placeholder:text-gray-500 text-sm font-medium transition-all duration-300 shadow-inner shadow-black/20 backdrop-blur-sm",
            error
              ? "border-red-500/50 focus:border-red-500 placeholder:text-red-300/30"
              : "border-white/5 focus:border-white/20",
            className,
          )}
          placeholder={label}
          {...props}
        />
      </div>
    </div>
  ),
);
InputField.displayName = "InputField";

// --- MAIN COMPONENT ---

const ResetPasswordForm = () => {
  const { token } = useParams(); // Lấy token từ URL (/reset-password/:token)
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // 1. Setup Form
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema) as any,
    mode: "onChange",
  });

  const passwordValue = watch("password", "");
  const confirmPasswordValue = watch("confirmPassword", "");

  // 2. Logic Check Strength (Dùng useMemo)
  const requirementsStatus = useMemo(() => {
    return PASSWORD_REQUIREMENTS.map((req) => ({
      ...req,
      met: req.regex.test(passwordValue || ""),
    }));
  }, [passwordValue]);

  const strengthScore = requirementsStatus.filter((r) => r.met).length;

  // Logic màu sắc
  const getStrengthColor = () => {
    if (strengthScore === 0) return "text-gray-500";
    if (strengthScore <= 2) return "text-red-400";
    if (strengthScore === 3) return "text-yellow-400";
    return "text-emerald-400";
  };

  // 3. Submit Handler
  const onSubmit = async (data: ResetPasswordInput) => {
    if (!token) {
      toast.error("Invalid or missing token.");
      return;
    }

    try {
      // Gọi API Reset Password
      await authApi.resetPassword(token, data.password);

      toast.success("Password reset successful!", {
        description: "You can now login with your new password.",
      });

      // Chuyển về trang login
      navigate("/login");
    } catch (err: unknown) {
      const error = err as ApiErrorResponse;
      toast.error(error.response?.data?.message || "Failed to reset password.");
    }
  };

  return (
    <div className="animate-fade-in-up">
      <div className="mb-8 text-center lg:text-left">
        <h1 className="text-3xl font-bold mb-3 tracking-tight text-white">
          Set new password
        </h1>
        <p className="text-gray-400 text-sm">
          Create a new password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Password Input */}
        <div className="relative">
          <InputField
            id="password"
            label="New Password"
            icon={Lock}
            type={showPassword ? "text" : "password"}
            error={!!errors.password}
            {...register("password")}
            onFocus={() => setIsFocused(true)}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-[14px] text-gray-500 hover:text-white transition-colors z-20 outline-none"
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Strength Meter (Hiển thị khi focus hoặc có value) */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-500 ease-in-out bg-black/20 rounded-2xl",
            isFocused || passwordValue
              ? "max-h-[300px] opacity-100 p-3"
              : "max-h-0 opacity-0 p-0",
          )}
        >
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Strength
            </span>
            <span
              className={cn(
                "text-[10px] font-bold uppercase transition-colors duration-300",
                getStrengthColor(),
              )}
            >
              {strengthScore <= 2
                ? "Weak"
                : strengthScore === 3
                  ? "Medium"
                  : "Strong"}
            </span>
          </div>

          {/* Progress Bars */}
          <div className="flex gap-1 h-1 mb-3 w-full bg-gray-800/50 rounded-full overflow-hidden">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={cn(
                  "flex-1 transition-all duration-500 ease-out",
                  strengthScore >= step
                    ? strengthScore <= 2
                      ? "bg-red-500"
                      : strengthScore === 3
                        ? "bg-yellow-500"
                        : "bg-emerald-500"
                    : "bg-transparent",
                )}
              />
            ))}
          </div>

          {/* Requirements List */}
          <div className="grid grid-cols-2 gap-2">
            {requirementsStatus.map((req) => (
              <div
                key={req.id}
                className="flex items-center gap-2 text-xs transition-colors duration-300"
              >
                {req.met ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                ) : (
                  <div className="w-3 h-3 rounded-full border border-gray-600/50 shrink-0" />
                )}
                <span className={req.met ? "text-gray-200" : "text-gray-500"}>
                  {req.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Confirm Password */}
        <div className="relative">
          <InputField
            id="confirmPassword"
            label="Confirm Password"
            icon={Lock}
            type="password"
            error={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
          {confirmPasswordValue.length > 0 && (
            <div className="absolute right-4 top-[14px]">
              {passwordValue === confirmPasswordValue ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <Button
            type="submit"
            isLoading={isSubmitting}
            // Disable nếu đang gửi hoặc form chưa valid (optional: bỏ disabled để show error on submit)
            disabled={isSubmitting}
            className="shadow-xl shadow-indigo-500/20"
          >
            Reset Password
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ResetPasswordForm;
