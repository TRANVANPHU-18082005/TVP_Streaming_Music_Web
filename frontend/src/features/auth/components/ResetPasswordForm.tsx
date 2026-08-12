import React, { useState, useMemo, useEffect } from "react";
import { Lock, Eye, EyeOff, Disc, CheckCircle2, XCircle, AlertTriangle, ArrowLeft, ShieldCheck } from "lucide-react";
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
import { PASSWORD_REQUIREMENTS } from "@/config/constants";



// Ánh xạ error code sang thông báo tiếng Việt
const ERROR_CODE_MESSAGES: Record<string, string> = {
  RESET_TOKEN_EXPIRED: "Link đặt lại mật khẩu đã hết hạn (10 phút). Vui lòng gửi lại yêu cầu mới.",
  RESET_TOKEN_INVALID: "Link đặt lại mật khẩu không hợp lệ. Vui lòng kiểm tra lại đường dẫn trong email.",
  SAME_PASSWORD_ERROR: "Mật khẩu mới không được trùng với mật khẩu hiện tại.",
  ACCOUNT_NOT_ACTIVE: "Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ hỗ trợ.",
  ACCOUNT_NOT_FOUND: "Tài khoản không còn tồn tại trong hệ thống.",
};

// --- UI COMPONENTS ---

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
            "w-full h-12 bg-white/5 hover:bg-white/10 rounded-2xl border text-white pl-11 pr-12 outline-none placeholder:text-gray-500 text-sm font-medium transition-all duration-300 shadow-inner shadow-black/20 backdrop-blur-sm",
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

// --- TOKEN INVALID STATE ---
const TokenInvalidState = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) => (
  <div className="animate-fade-in-up text-center">
    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30">
      <AlertTriangle className="w-10 h-10 text-red-400" />
    </div>
    <h2 className="text-2xl font-bold mb-3 tracking-tight text-white">
      Link không hợp lệ
    </h2>
    <p className="text-gray-400 text-sm mb-8 leading-relaxed max-w-sm mx-auto">
      {message}
    </p>
    <Button onClick={onRetry} className="max-w-xs mx-auto">
      Gửi lại yêu cầu đặt lại mật khẩu
    </Button>
  </div>
);

// --- SUCCESS STATE ---
const SuccessState = ({ countdown }: { countdown: number }) => (
  <div className="animate-fade-in-up text-center">
    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
      <ShieldCheck className="w-10 h-10 text-emerald-400" />
    </div>
    <h2 className="text-2xl font-bold mb-3 tracking-tight text-white">
      Đặt lại mật khẩu thành công!
    </h2>
    <p className="text-gray-400 text-sm mb-6 leading-relaxed">
      Mật khẩu mới của bạn đã được cập nhật. Toàn bộ phiên đăng nhập cũ đã bị thu hồi để bảo mật tài khoản.
    </p>
    <p className="text-gray-500 text-xs">
      Tự động chuyển về trang đăng nhập sau{" "}
      <span className="text-white font-bold">{countdown}s</span>...
    </p>
  </div>
);

// --- MAIN COMPONENT ---

const ResetPasswordForm = () => {
  const { token } = useParams(); // Lấy token từ URL (/reset-password/:token)
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // States
  const [pageState, setPageState] = useState<"form" | "invalid" | "success">("form");
  const [invalidMessage, setInvalidMessage] = useState("");
  const [countdown, setCountdown] = useState(5);

  // 1. Kiểm tra token ngay khi component mount
  useEffect(() => {
    if (!token || token.trim().length < 10) {
      setInvalidMessage(
        "Link đặt lại mật khẩu không hợp lệ hoặc đã bị thay đổi. Vui lòng yêu cầu gửi lại email.",
      );
      setPageState("invalid");
    }
  }, [token]);

  // 2. Countdown và redirect sau khi thành công
  useEffect(() => {
    if (pageState !== "success") return;
    if (countdown <= 0) {
      navigate("/login", { replace: true });
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [pageState, countdown, navigate]);

  // 3. Setup Form
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema) as any,
    mode: "onChange",
  });

  const passwordValue = watch("password", "");
  const confirmPasswordValue = watch("confirmPassword", "");

  // 4. Logic Check Strength
  const requirementsStatus = useMemo(() => {
    return PASSWORD_REQUIREMENTS.map((req) => ({
      ...req,
      met: req.regex.test(passwordValue || ""),
    }));
  }, [passwordValue]);

  const strengthScore = requirementsStatus.filter((r) => r.met).length;

  const getStrengthColor = () => {
    if (strengthScore === 0) return "text-gray-500";
    if (strengthScore <= 2) return "text-red-400";
    if (strengthScore === 3) return "text-yellow-400";
    return "text-emerald-400";
  };

  const getStrengthBarColor = () => {
    if (strengthScore <= 2) return "bg-red-500";
    if (strengthScore === 3) return "bg-yellow-500";
    return "bg-emerald-500";
  };

  // 5. Submit Handler
  const onSubmit = async (data: ResetPasswordInput) => {
    if (!token) {
      toast.error("Token không hợp lệ hoặc đã hết hạn.");
      return;
    }

    try {
      await authApi.resetPassword(token, data.password, data.confirmPassword);

      toast.success("Đặt lại mật khẩu thành công!", {
        description: "Toàn bộ phiên đăng nhập cũ đã bị thu hồi để bảo mật.",
      });

      setPageState("success");
    } catch (err: unknown) {
      const error = err as ApiErrorResponse;
      const errorCode = error.response?.data?.errorCode as string | undefined;
      const serverMsg = error.response?.data?.message;

      // Ánh xạ error code sang thông báo cụ thể
      const displayMsg =
        (errorCode && ERROR_CODE_MESSAGES[errorCode]) ||
        serverMsg ||
        "Đặt lại mật khẩu thất bại. Vui lòng thử lại.";

      // Nếu token hết hạn hoặc không hợp lệ -> chuyển sang trạng thái lỗi
      if (errorCode === "RESET_TOKEN_EXPIRED" || errorCode === "RESET_TOKEN_INVALID") {
        setInvalidMessage(displayMsg);
        setPageState("invalid");
        return;
      }

      // Nếu trùng mật khẩu cũ -> hiển thị lỗi inline trên field
      if (errorCode === "SAME_PASSWORD_ERROR") {
        setError("password", { message: displayMsg });
        toast.error(displayMsg);
        return;
      }

      // Các lỗi còn lại -> toast
      toast.error(displayMsg);
    }
  };

  // --- RENDER STATES ---

  if (pageState === "invalid") {
    return (
      <TokenInvalidState
        message={invalidMessage}
        onRetry={() => navigate("/forgot-password")}
      />
    );
  }

  if (pageState === "success") {
    return <SuccessState countdown={countdown} />;
  }

  // --- FORM VIEW ---
  return (
    <div className="animate-fade-in-up">
      <button
        onClick={() => navigate("/forgot-password")}
        className="flex items-center text-gray-400 hover:text-white mb-8 transition-colors group text-sm"
      >
        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />{" "}
        Gửi lại yêu cầu
      </button>

      <div className="mb-8 text-center lg:text-left">
        <h1 className="text-3xl font-bold mb-3 tracking-tight text-white">
          Đặt lại mật khẩu
        </h1>
        <p className="text-gray-400 text-sm">
          Tạo mật khẩu mới mạnh hơn cho tài khoản của bạn.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Password Input */}
        <div className="relative">
          <InputField
            id="password"
            label="Mật khẩu mới"
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
          {errors.password && (
            <p className="text-red-400 text-xs mt-2 ml-2">{errors.password.message}</p>
          )}
        </div>

        {/* Strength Meter */}
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
              Độ mạnh
            </span>
            <span
              className={cn(
                "text-[10px] font-bold uppercase transition-colors duration-300",
                getStrengthColor(),
              )}
            >
              {strengthScore <= 2
                ? "Yếu"
                : strengthScore === 3
                  ? "Trung bình"
                  : "Mạnh"}
            </span>
          </div>

          {/* Progress Bars */}
          <div className="flex gap-1 h-1 mb-3 w-full bg-gray-800/50 rounded-full overflow-hidden">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={cn(
                  "flex-1 transition-all duration-500 ease-out",
                  strengthScore >= step ? getStrengthBarColor() : "bg-transparent",
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
            label="Xác nhận mật khẩu"
            icon={Lock}
            type={showConfirm ? "text" : "password"}
            error={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-4 top-[14px] text-gray-500 hover:text-white transition-colors z-20 outline-none"
          >
            {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
          {/* Match indicator */}
          {confirmPasswordValue.length > 0 && (
            <div className="absolute right-12 top-[14px]">
              {passwordValue === confirmPasswordValue ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
            </div>
          )}
          {errors.confirmPassword && (
            <p className="text-red-400 text-xs mt-2 ml-2">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <Button
            type="submit"
            isLoading={isSubmitting}
            disabled={isSubmitting || strengthScore < 4}
            className="shadow-xl shadow-indigo-500/20"
          >
            {isSubmitting ? "Đang cập nhật..." : "Đặt lại mật khẩu"}
          </Button>
          {strengthScore < 4 && passwordValue.length > 0 && (
            <p className="text-gray-500 text-xs text-center mt-3">
              Hãy đáp ứng đủ yêu cầu mật khẩu để tiếp tục
            </p>
          )}
        </div>
      </form>
    </div>
  );
};

export default ResetPasswordForm;
