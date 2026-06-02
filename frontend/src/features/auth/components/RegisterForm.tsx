import React from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  CheckCircle2,
  XCircle,
  Music4,
  Disc,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

// Import Hook
import { useRegister } from "../hooks/useRegister";
import Avatar, { AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const AnimatedBackground = () => (
  <div className="fixed inset-0 z-0 overflow-hidden bg-[#08080a]">
    <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-500/10 rounded-full blur-[120px] animate-blob mix-blend-screen" />
    <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] bg-purple-500/10 rounded-full blur-[120px] animate-blob animation-delay-2000 mix-blend-screen" />
    <div className="absolute bottom-[-20%] left-[20%] w-[50vw] h-[50vw] bg-pink-500/10 rounded-full blur-[120px] animate-blob animation-delay-4000 mix-blend-screen" />
    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 brightness-100 contrast-150"></div>
  </div>
);

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
  const baseStyles =
    "relative group w-full h-11 rounded-2xl font-semibold text-sm transition-all duration-300 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden";

  const variants = {
    neon: "bg-white text-black hover:bg-gray-100 shadow-lg shadow-white/5 border border-transparent",
    ghost: "bg-transparent text-gray-400 hover:text-white hover:bg-white/5",
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

// --- INPUT COMPONENT (Chuẩn React Hook Form) ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon: React.ElementType;
  error?: boolean;
}

const InputField = React.forwardRef<HTMLInputElement, InputProps>(
  ({ icon: Icon, className, error, ...props }, ref) => (
    <div className="relative group w-full">
      {/* Glow Effect nền sau: Đỏ khi lỗi, Tím khi focus */}
      <div
        className={cn(
          "absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500",
          error && "from-red-500/30 to-red-500/30 opacity-100",
        )}
      />

      <div className="relative w-full">
        {/* Icon trái: Đỏ khi lỗi */}
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
          className={cn(
            "w-full h-12 bg-white/5 hover:bg-white/10 rounded-2xl border pl-11 pr-4 outline-none placeholder:text-gray-500 text-sm font-medium transition-all duration-300 shadow-inner shadow-black/20 backdrop-blur-sm",
            // Logic viền:
            error
              ? "border-red-500/50 focus:border-red-500 text-red-100 placeholder:text-red-300/30"
              : "border-white/5 focus:border-white/20 text-white",
            className,
          )}
          {...props}
        />

        {/* Icon cảnh báo lỗi bên phải */}
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
export default function RegisterPage() {
  // 1. Gọi Hook để lấy logic
  const {
    form: {
      register,
      formState: { errors, isSubmitting },
    }, // Destructuring form state
    onSubmit,
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
  } = useRegister();

  return (
    <>
      <style>{`
        /* ... (Giữ nguyên phần CSS animation của bạn) ... */
        @keyframes blob { 0% { transform: translate(0px, 0px) scale(1); } 33% { transform: translate(30px, -50px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.9); } 100% { transform: translate(0px, 0px) scale(1); } }
        .animate-blob { animation: blob 10s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        .animate-fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill:active {
            -webkit-text-fill-color: white !important;
            -webkit-box-shadow: 0 0 0 0 transparent inset !important;
            transition: background-color 9999s ease-in-out 0s;
        }
      `}</style>

      <div className="min-h-screen w-full bg-[#08080a] text-white font-sans relative selection:bg-indigo-500/30">
        <AnimatedBackground />

        <div className="absolute inset-0 w-full h-full overflow-y-auto overflow-x-hidden">
          <div className="min-h-full w-full flex flex-col items-center justify-center p-4 py-8 relative z-10">
            <div className="w-full max-w-[900px] flex flex-col lg:flex-row gap-6 lg:gap-8 items-center justify-center">
              {/* FORM CONTAINER */}
              <div className="w-full max-w-[420px] bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden animate-fade-in-up shrink-0">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent blur-sm" />

                <div className="mb-6 text-center lg:text-left">
                  <div className="relative z-10 flex items-center justify-center align-middle gap-3 mb-2">
                    <Link
                      to="/"
                      className="group flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                    >
                      <div className="relative flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-primary/20 to-primary/10 border border-primary/20 shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:shadow-primary/30">
                        <Avatar className="size-full rounded-xl">
                          <AvatarImage
                            src="https://res.cloudinary.com/dc5rfjnn5/image/upload/v1770807338/LOGO_o4n02n.png"
                            alt="Logo"
                            className="object-cover p-1" // Padding nhẹ để logo không bị sát viền
                          />
                          <AvatarFallback className="font-bold text-primary">
                            TVP
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </Link>
                    <span className="text-2xl font-bold tracking-tight bg-clip-text   ">
                      TVP MUSIC
                    </span>
                  </div>

                  <p className="text-gray-400 text-sm">
                    Unlock your exclusive music journey.
                  </p>
                </div>

                {/* FORM BẮT ĐẦU TỪ ĐÂY - Dùng onSubmit từ Hook */}
                <form onSubmit={onSubmit} className="space-y-3">
                  {/* USERNAME / FULLNAME */}
                  {/* Lưu ý: name phải khớp với schema (username hoặc fullName) */}
                  <div>
                    <InputField
                      icon={User}
                      placeholder="Full Name"
                      error={!!errors.fullName}
                      {...register("fullName")}
                    />
                    {errors.fullName && (
                      <p className="text-red-400 text-xs mt-1 ml-2">
                        {errors.fullName.message}
                      </p>
                    )}
                  </div>

                  {/* EMAIL */}
                  <div>
                    <InputField
                      icon={Mail}
                      type="email"
                      placeholder="Email Address"
                      error={!!errors.email}
                      {...register("email")}
                    />
                    {errors.email && (
                      <p className="text-red-400 text-xs mt-1 ml-2">
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  {/* PASSWORD */}
                  <div className="space-y-3">
                    <div className="relative">
                      <InputField
                        icon={Lock}
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        error={!!errors.password}
                        {...register("password")}
                        // Kết nối sự kiện focus để hiện checklist
                        onFocus={() => setIsFocused(true)}
                      />
                      <button
                        type="button"
                        onClick={toggleShowPassword}
                        className="absolute right-4 top-3.5 text-gray-500 hover:text-white transition-colors z-20"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-red-400 text-xs mt-1 ml-2">
                        {errors.password.message}
                      </p>
                    )}

                    {/* CHECKLIST UI (Logic hiển thị lấy từ Hook) */}
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
                            strengthInfo.textColor,
                          )}
                        >
                          {passwordValue ? strengthInfo.label : ""}
                        </span>
                      </div>

                      <div className="flex gap-1 h-1 mb-3 w-full bg-gray-800/50 rounded-full overflow-hidden">
                        {[1, 2, 3, 4].map((step) => (
                          <div
                            key={step}
                            className={cn(
                              "flex-1 transition-all duration-500 ease-out",
                              strengthScore >= step
                                ? strengthInfo.color
                                : "bg-transparent",
                            )}
                          />
                        ))}
                      </div>

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
                            <span
                              className={
                                req.met ? "text-gray-200" : "text-gray-500"
                              }
                            >
                              {req.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CONFIRM PASSWORD */}
                    <div className="relative">
                      <InputField
                        icon={Lock}
                        type="password"
                        placeholder="Confirm Password"
                        error={!!errors.confirmPassword}
                        {...register("confirmPassword")}
                      />
                      {confirmPasswordValue.length > 0 &&
                        !errors.confirmPassword && (
                          <div className="absolute right-4 top-3.5">
                            {isMatch ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                        )}
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-red-400 text-xs mt-1 ml-2">
                        {errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  {/* SUBMIT */}
                  <div className="pt-2">
                    <Button
                      type="submit"
                      isLoading={isSubmitting}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Creating Account..." : "Create Account"}
                    </Button>
                  </div>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-gray-500 text-xs">
                    Already have an account?{" "}
                    <Link
                      to="/login"
                      className="text-white font-medium hover:underline decoration-indigo-500 underline-offset-2 transition-all"
                    >
                      Log in
                    </Link>
                  </p>
                </div>
              </div>

              {/* RIGHT SIDE: VISUALS (Giữ nguyên) */}
              <div className="hidden lg:flex flex-col justify-center items-center animate-fade-in-up animation-delay-2000">
                {/* ... (Giữ nguyên code UI phần hình ảnh bên phải) ... */}
                <div className="relative w-80 h-80">
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full blur-[60px] opacity-20 animate-pulse"></div>
                  <div className="absolute top-4 left-4 right-4 z-10 p-6 border border-white/10 bg-white/5 backdrop-blur-xl rounded-[2rem] shadow-2xl transform transition-transform hover:-translate-y-1 duration-500">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Music4 className="text-white w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-white">
                          Hi-Fi Audio
                        </h3>
                        <p className="text-gray-400 text-xs">
                          Lossless streaming quality
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-1.5 bg-white/5 rounded-full w-full overflow-hidden">
                        <div className="h-full bg-indigo-400 w-2/3 rounded-full"></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                        <span>FLAC</span>
                        <span>24-bit / 192kHz</span>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -bottom-2 -right-2 left-8 z-20 p-5 border border-white/10 bg-[#121214]/90 backdrop-blur-xl rounded-[2rem] shadow-2xl transform rotate-2 hover:rotate-0 transition-transform duration-500">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="text-emerald-400 w-6 h-6" />
                      <div>
                        <div className="font-bold text-white text-sm">
                          Ad-free Experience
                        </div>
                        <div className="text-[10px] text-gray-400">
                          Uninterrupted listening
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
