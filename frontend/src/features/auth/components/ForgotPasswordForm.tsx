import React, { useState } from "react";
import { Mail, Disc, ArrowLeft, KeyRound, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

// --- Logic Imports ---
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import authApi from "@/features/auth/api/authApi";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/features/auth/schemas/auth.schema";

// ==========================================
// UI COMPONENTS
// ==========================================

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

// ✅ INPUT FIELD (Đã nâng cấp forwardRef cho React Hook Form)
const InputField = React.forwardRef<HTMLInputElement, InputProps>(
  ({ icon: Icon, className, label, id, error, ...props }, ref) => (
    <div className="relative group w-full">
      {/* Glow Effect */}
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
            "w-full h-12 bg-white/5 hover:bg-white/10 rounded-2xl border pl-11 pr-4 outline-none placeholder:text-gray-500 text-sm font-medium transition-all duration-300 shadow-inner shadow-black/20 backdrop-blur-sm",
            error
              ? "border-red-500/50 focus:border-red-500 text-red-100 placeholder:text-red-300/30"
              : "border-white/5 focus:border-white/20 text-white",
            className,
          )}
          placeholder={label}
          {...props}
        />

        {/* Icon báo lỗi */}
        {error && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 animate-in fade-in zoom-in duration-300">
            <AlertCircle className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  ),
);
InputField.displayName = "InputField";

// ==========================================
// MAIN LOGIC: FORGOT PASSWORD FORM
// ==========================================

const ForgotPasswordForm = () => {
  const navigate = useNavigate();
  const [isSent, setIsSent] = useState(false); // Trạng thái chuyển màn hình
  const [sentEmail, setSentEmail] = useState(""); // Lưu email để hiển thị ở màn hình thành công

  // 1. Setup Form
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema) as any,
    mode: "onBlur",
  });

  // 2. Xử lý Submit
  const onSubmit = async (data: ForgotPasswordInput) => {
    try {
      // Gọi API thật
      await authApi.forgotPassword(data.email);

      // Thành công -> Chuyển UI
      setSentEmail(data.email);
      setIsSent(true);
      toast.success("Email sent successfully!");
    } catch (error: any) {
      const msg = error.response?.data?.message || "Request failed.";

      // Map lỗi vào ô input nếu liên quan đến email
      if (
        msg.toLowerCase().includes("email") ||
        msg.toLowerCase().includes("tồn tại")
      ) {
        setError("email", { type: "server", message: msg });
      } else {
        toast.error(msg);
      }
    }
  };

  // ------------------------------------------------------
  // VIEW 2: SUCCESS (CHECK MAIL)
  // ------------------------------------------------------
  if (isSent) {
    return (
      <div className="animate-fade-in-up text-center">
        <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-indigo-500/30">
          <Mail className="w-10 h-10 text-indigo-400 animate-pulse" />
        </div>
        <h2 className="text-3xl font-bold mb-3 tracking-tight text-white">
          Check your mail
        </h2>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
          We have sent password recover instructions to your email{" "}
          <span className="text-white font-medium">{sentEmail}</span>.
        </p>

        <div className="space-y-4">
          <Button onClick={() => window.open("mailto:", "_blank")}>
            Open Email App
          </Button>

          <p className="text-gray-500 text-xs">
            Did not receive the email?{" "}
            <button
              onClick={() => setIsSent(false)} // Quay lại form nhập
              className="text-indigo-400 hover:underline font-medium"
            >
              Try another email
            </button>
          </p>

          <button
            onClick={() => navigate("/login")}
            className="flex items-center justify-center w-full text-gray-400 hover:text-white transition-colors text-sm mt-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Login
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------
  // VIEW 1: INPUT FORM
  // ------------------------------------------------------
  return (
    <div className="animate-fade-in-up">
      <button
        onClick={() => navigate("/login")}
        className="flex items-center text-gray-400 hover:text-white mb-8 transition-colors group text-sm"
      >
        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />{" "}
        Back to Login
      </button>

      <div className="mb-8 text-center lg:text-left">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/5 mb-6 border border-white/10 lg:hidden">
          <KeyRound className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-3xl font-bold mb-3 tracking-tight text-white">
          Forgot Password?
        </h1>
        <p className="text-gray-400 text-sm">
          No worries, we'll send you reset instructions.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <InputField
            id="email"
            label="Enter your email"
            icon={Mail}
            type="email"
            error={!!errors.email}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-red-400 text-xs mt-2 ml-2">
              {errors.email.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          isLoading={isSubmitting}
          disabled={isSubmitting}
          className="shadow-xl shadow-indigo-500/20"
        >
          {isSubmitting ? "Sending..." : "Reset Password"}
        </Button>
      </form>
    </div>
  );
};

export default ForgotPasswordForm;
