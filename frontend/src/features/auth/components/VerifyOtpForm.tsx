import React, { useState, useRef, useEffect } from "react";
import { Disc, ArrowLeft, RotateCw, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// Logic Imports
import authApi from "@/features/auth/api/authApi";
import { login } from "@/features/auth/slice/authSlice";
import type { ApiErrorResponse } from "@/types";
import { useAppDispatch } from "@/store/hooks";

// ============================================================================
// 1. COMPONENT BUTTON (UI)
// ============================================================================
const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "neon" | "outline" | "ghost";
    isLoading?: boolean;
  }
> = ({ children, className, variant = "neon", isLoading, ...props }) => {
  const baseStyles =
    "relative group w-full h-12 rounded-2xl font-semibold text-sm transition-all duration-300 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden flex items-center justify-center";
  const variants = {
    neon: "bg-white text-black hover:bg-gray-100 shadow-lg shadow-white/5 border border-transparent",
    outline:
      "bg-transparent border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 hover:border-white/20",
    ghost: "bg-transparent text-gray-400 hover:text-white",
  };
  return (
    <button className={cn(baseStyles, variants[variant], className)} {...props}>
      <span className="relative flex items-center justify-center gap-2">
        {isLoading && <Disc className="animate-spin h-4 w-4" />}
        {children}
      </span>
    </button>
  );
};

// ============================================================================
// 2. COMPONENT OTP INPUT (CONTROLLED)
// ============================================================================
const OtpInput: React.FC<{
  length?: number;
  value: string; // Nhận value từ cha
  onChange: (val: string) => void; // Báo cho cha khi đổi
  disabled?: boolean;
}> = ({ length = 6, value, onChange, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus khi vào trang
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!/^\d*$/.test(val)) return; // Chỉ cho nhập số
    if (val.length <= length) {
      onChange(val);
    }
  };

  return (
    <div
      className="relative w-full max-w-[400px] mx-auto"
      onClick={() => !disabled && inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d*"
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-default caret-transparent disabled:cursor-not-allowed"
        value={value}
        onChange={handleChange}
      />
      <div className="flex gap-2 justify-between w-full pointer-events-none">
        {Array.from({ length }).map((_, index) => {
          const digit = value[index] || "";
          // Active là ô đang nhập HOẶC ô cuối cùng nếu đã full
          const isActive =
            value.length < length
              ? index === value.length
              : index === length - 1 &&
              document.activeElement === inputRef.current;

          const isFilled = index < value.length;

          return (
            <div
              key={index}
              className="relative group flex-1 min-w-0 aspect-[3/4]"
            >
              <div
                className={cn(
                  "absolute -inset-0.5 bg-gradient-to-r from-indigo-500/40 to-purple-500/40 rounded-xl blur transition-opacity duration-300",
                  isActive ? "opacity-100" : "opacity-0",
                )}
              />
              <div
                className={cn(
                  "relative w-full h-full rounded-xl border flex items-center justify-center transition-all duration-200 shadow-inner backdrop-blur-sm",
                  "text-lg sm:text-2xl font-bold",
                  isFilled
                    ? "bg-white/10 border-indigo-500/50 text-white shadow-indigo-500/10"
                    : "bg-white/5 border-white/10 text-gray-400",
                  isActive &&
                  "border-white/30 bg-white/10 ring-1 ring-white/20",
                )}
              >
                {digit}
                {isActive && !isFilled && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-0.5 h-1/2 bg-indigo-400 animate-pulse rounded-full" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// 3. COMPONENT RESEND TIMER
// ============================================================================
const ResendTimer = ({
  onResend,
  isLoading,
}: {
  onResend: (callback: () => void) => void;
  isLoading: boolean;
}) => {
  const [timeLeft, setTimeLeft] = useState(30);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timerId);
    } else {
      setCanResend(true);
    }
  }, [timeLeft]);

  const handleClick = () => {
    // Gọi hàm resend từ cha, truyền callback reset vào
    onResend(() => {
      setTimeLeft(30); // Reset về 30s
      setCanResend(false); // Disable nút
    });
  };

  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      {canResend ? (
        <button
          onClick={handleClick}
          disabled={isLoading}
          className="group flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95 disabled:opacity-50"
        >
          <div className="p-1 rounded-full bg-indigo-500/20 text-indigo-400 group-hover:text-indigo-300 group-hover:bg-indigo-500/30 transition-colors">
            {isLoading ? (
              <Disc className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCw className="w-4 h-4" />
            )}
          </div>
          <span className="text-sm font-medium text-gray-300 group-hover:text-white">
            Nhấn để gửi lại mã
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Gửi lại mã sau</span>
          <span className="font-mono font-medium text-indigo-400 w-[4ch]">
            00:{timeLeft.toString().padStart(2, "0")}
          </span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 4. MAIN FORM COMPONENT
// ============================================================================

interface VerifyOtpFormProps {
  email?: string;
}

const VerifyOtpForm: React.FC<VerifyOtpFormProps> = ({ email }) => {
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // --- LOGIC 1: HÀM VERIFY CHÍNH ---
  const executeVerify = async (codeToVerify: string) => {
    if (!email) return;
    if (codeToVerify.length !== 6) return; // Chặn nếu chưa đủ số

    setIsLoading(true);

    try {
      const res = await authApi.verifyEmail({ email, otp: codeToVerify });

      // Nếu có token -> Login luôn
      if (res.data.accessToken) {
        dispatch(
          login({
            accessToken: res.data.accessToken,
            user: res.data.user,
          }),
        );
        toast.success("Xác thực thành công!");
        navigate("/");
      } else {
        toast.success("Đã xác thực! Vui lòng đăng nhập.");
        navigate("/login");
      }
    } catch (error: unknown) {
      const err = error as ApiErrorResponse;
      const msg = err.response?.data?.message || "Lỗi xác thực";

      // Xử lý các trường hợp lỗi cụ thể
      if (
        msg.toLowerCase().includes("hết hạn") ||
        msg.toLowerCase().includes("expired")
      ) {
        toast.error("Mã đã hết hạn. Vui lòng gửi lại mã mới.");
        setOtp(""); // Xóa trắng để nhập lại
      } else {
        toast.error(msg || "Mã OTP không đúng. Vui lòng thử lại.");
        setOtp(""); // Xóa trắng để nhập lại
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- LOGIC 2: AUTO SUBMIT KHI ĐỦ 6 SỐ ---
  useEffect(() => {
    if (otp.length === 6) {
      executeVerify(otp);
    }
  }, [otp]);

  // --- LOGIC 3: GỬI LẠI MÃ ---
  const handleResend = async (resetTimer: () => void) => {
    if (!email) return;
    setResendLoading(true);
    setOtp(""); // Xóa ô nhập liệu cũ tránh nhầm lẫn

    try {
      await authApi.resendOtp(email);
      toast.success("Đã gửi mã mới vào email!");
      resetTimer(); // Chỉ reset đồng hồ khi gửi thành công
    } catch (error: unknown) {
      const err = error as ApiErrorResponse;
      toast.error(
        err.response?.data?.message || "Gửi lại thất bại. Thử lại sau.",
      );
    } finally {
      setResendLoading(false);
    }
  };



  return (
    <div className="animate-fade-in-up w-full flex flex-col h-full sm:h-auto min-h-[60vh] sm:min-h-0">
      {/* Nút Back */}
      <button
        onClick={() => navigate("/login")}
        className="flex items-center text-gray-400 hover:text-white mb-6 sm:mb-8 transition-colors group shrink-0"
      >
        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
        Trở về
      </button>

      {/* Header Text */}
      <div className="mb-8 text-center lg:text-left shrink-0">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-4 border border-white/10 lg:hidden">
          <Smartphone className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-3xl font-bold mb-3 tracking-tight">
          Xác thực tài khoản
        </h1>
        <p className="text-gray-400 text-sm">
          Chúng tôi đã gửi mã gồm 6 chữ số đến{" "}
          <span className="text-white font-medium">
            {email || "your email"}
          </span>
          .
          <br className="hidden sm:block" /> Nhập mã dưới đây để xác nhận tài khoản của bạn.
        </p>
      </div>

      {/* ✨ THAY ĐỔI 2: Phần Input + Button căn giữa dọc màn hình trên mobile */}
      {/* flex-1 flex flex-col justify-center: Đẩy phần này ra giữa không gian còn trống */}
      <div className="space-y-8 flex-1 flex flex-col justify-center sm:block sm:flex-none">
        <div className="flex justify-center w-full">
          <OtpInput
            length={6}
            value={otp}
            onChange={setOtp}
            disabled={isLoading}
          />
        </div>

        <div className="pt-2">
          <Button
            type="button"
            isLoading={isLoading}
            disabled={isLoading || otp.length < 6}
            onClick={() => executeVerify(otp)}
            className="shadow-xl shadow-indigo-500/20"
          >
            {isLoading ? "Xác thực..." : "Xác thực & Tiếp tục"}
          </Button>
        </div>

        {/* Timer đẩy xuống dưới cùng chút cho thoáng */}
        <div className="pb-4 sm:pb-0">
          <ResendTimer onResend={handleResend} isLoading={resendLoading} />
        </div>
      </div>
    </div>
  );
};

export default VerifyOtpForm;
