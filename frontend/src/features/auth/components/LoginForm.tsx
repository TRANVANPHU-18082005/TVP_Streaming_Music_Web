import React from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Github,
  Chrome,
  Facebook,
  Check,
  Disc,
  AlertCircle,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

// Import Hook vừa tạo
import { useLogin } from "../hooks/useLogin";
import Avatar, { AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// --- UI COMPONENTS (Giữ nguyên style của bạn) ---

const AnimatedBackground = () => (
  <div className="absolute inset-0 z-0 overflow-hidden bg-[#08080a]">
    <div className="absolute top-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-indigo-500/10 rounded-full blur-[100px] animate-blob mix-blend-screen" />
    <div className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-purple-500/10 rounded-full blur-[100px] animate-blob animation-delay-2000 mix-blend-screen" />
    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 brightness-100 contrast-150"></div>
  </div>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "neon" | "outline" | "ghost";
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

const Checkbox: React.FC<{
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ id, label, checked, onChange }) => (
  <div className="flex items-center gap-2.5">
    <button
      type="button"
      id={id}
      onClick={() => onChange(!checked)}
      className={cn(
        "w-5 h-5 rounded-lg border flex items-center justify-center transition-all duration-200 shrink-0",
        checked
          ? "bg-indigo-500 border-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.5)]"
          : "border-white/10 bg-white/5 hover:border-white/30",
      )}
    >
      {checked && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
    </button>
    <label
      htmlFor={id}
      className="text-sm text-gray-400 select-none cursor-pointer hover:text-gray-300 transition-colors"
      onClick={() => onChange(!checked)}
    >
      {label}
    </label>
  </div>
);

// Input Field (ForwardRef)
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon: React.ElementType;
  error?: boolean;
}

const InputField = React.forwardRef<HTMLInputElement, InputProps>(
  ({ icon: Icon, className, error, ...props }, ref) => (
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
          className={cn(
            "w-full h-12 bg-white/5 hover:bg-white/10 rounded-2xl border pl-11 pr-4 outline-none placeholder:text-gray-500 text-sm font-medium transition-all duration-300 shadow-inner shadow-black/20 backdrop-blur-sm",
            error
              ? "border-red-500/50 focus:border-red-500 text-red-100 placeholder:text-red-300/30"
              : "border-white/5 focus:border-white/20 text-white",
            className,
          )}
          {...props}
        />
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

const MusicBars: React.FC = () => (
  <div className="flex items-end gap-0.5 h-4 mb-1">
    {[0, 200, 100, 300].map((delay, i) => (
      <div
        key={i}
        className="w-1 bg-indigo-400 rounded-t-sm animate-[music-bar_1.2s_ease-in-out_infinite]"
        style={{ animationDelay: `${delay}ms` }}
      />
    ))}
  </div>
);

// ============================================================================
// MAIN COMPONENT (Sạch sẽ nhờ Custom Hook)
// ============================================================================

export default function LoginForm() {
  // 1. Gọi Hook
  const { form, onSubmit, showPassword, toggleShowPassword } = useLogin();

  // Destructuring các giá trị cần dùng từ form
  const {
    register,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  // Watch giá trị checkbox
  const rememberMe = watch("rememberMe");

  return (
    <>
      <style>{`
        @keyframes music-bar { 0%, 100% { height: 20%; opacity: 0.5; } 50% { height: 100%; opacity: 1; } }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes blob { 0% { transform: translate(0px, 0px) scale(1); } 33% { transform: translate(30px, -50px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.9); } 100% { transform: translate(0px, 0px) scale(1); } }
        @keyframes progress { 0% { width: 0%; } 100% { width: 100%; } }
        .animate-spin-slow { animation: spin-slow 8s linear infinite; }
        .animate-blob { animation: blob 10s infinite; }
        .animate-progress { animation: progress 30s linear infinite; }
        .animate-fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill:active { -webkit-text-fill-color: white !important; -webkit-box-shadow: 0 0 0 0 transparent inset !important; transition: background-color 9999s ease-in-out 0s; }
      `}</style>

      <div className="min-h-screen w-full flex bg-[#09090b] text-white font-sans selection:bg-indigo-500/30 overflow-hidden">
        {/* --- LEFT COLUMN: Visuals (Giữ nguyên) --- */}
        <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-12 overflow-hidden border-r border-[#27272a]/50 bg-black/40 backdrop-blur-sm z-10">
          <div className="absolute inset-0 z-0">
            <img
              src="https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=2070&auto=format&fit=crop"
              alt="Music Background"
              className="w-full h-full object-cover opacity-50 transition-transform duration-[40s] hover:scale-110 ease-linear"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/40 to-transparent" />
            <div className="absolute inset-0 bg-[#09090b]/20" />
          </div>

          <div className="relative z-10 flex items-center gap-3">
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
                  <AvatarFallback className="bg-transparent font-bold text-primary">
                    TVP
                  </AvatarFallback>
                </Avatar>
              </div>
            </Link>
            <span className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              TVP MUSIC
            </span>
          </div>

          <div className="relative z-10 max-w-lg">
            <div className="mb-8 space-y-4">
              <h1 className="text-6xl font-extrabold leading-none tracking-tight text-white drop-shadow-2xl">
                Midnight <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                  Echoes
                </span>
              </h1>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-0 overflow-hidden shadow-2xl hover:shadow-indigo-500/20 transition-shadow duration-500 group">
              <div className="p-5 flex items-center gap-5">
                <div className="relative h-20 w-20 shrink-0">
                  <div className="absolute inset-0 rounded-full bg-black shadow-lg animate-spin-slow border-2 border-gray-800 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 rounded-full border border-gray-800/50 m-1"></div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600"></div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="bg-white/90 rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Play className="h-4 w-4 text-black fill-current ml-0.5" />
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg text-white truncate">
                        Aurora Dreams
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <MusicBars />
                        <p className="text-sm text-indigo-300 font-medium">
                          Now Playing
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 font-mono mt-1">
                      3:42
                    </div>
                  </div>
                </div>
              </div>
              <div className="h-1 w-full bg-white/10">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 animate-progress w-1/3 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
              </div>
            </div>
          </div>

          <div className="relative z-10 text-xs font-medium text-gray-500/80 uppercase tracking-widest">
            © 2024 MusicHub Inc.
          </div>
        </div>

        {/* --- RIGHT COLUMN: Login Form --- */}
        <div className="w-full lg:w-1/2 relative flex items-center justify-center overflow-hidden">
          <AnimatedBackground />

          <div className="relative z-10 w-full max-w-[480px] p-6 sm:p-12">
            <div className="animate-fade-in-up">
              {/* Header */}
              <div className="mb-8 text-center lg:text-left">
                <div className="lg:hidden flex items-center justify-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-full bg-white text-black flex items-center justify-center font-bold">
                    M
                  </div>
                  <span className="text-xl font-bold">MusicHub</span>
                </div>
                <h1 className="text-4xl font-bold mb-2 tracking-tight">
                  Welcome Back.
                </h1>
                <p className="text-gray-400 text-sm">
                  Sign in to continue your journey.
                </p>
              </div>

              {/* FORM CHÍNH */}
              <form onSubmit={onSubmit} className="space-y-4">
                {/* Email */}
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

                {/* Password */}
                <div className="space-y-4">
                  <div className="relative">
                    <InputField
                      icon={Lock}
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      error={!!errors.password}
                      {...register("password")}
                    />
                    <button
                      type="button"
                      onClick={toggleShowPassword}
                      className="absolute right-4 top-3.5 text-gray-500 hover:text-white transition-colors z-20"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 cursor-pointer" />
                      ) : (
                        <Eye className="w-4 h-4 cursor-pointer" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-red-400 text-xs mt-1 ml-2">
                      {errors.password.message}
                    </p>
                  )}

                  {/* Remember & Forgot */}
                  <div className="flex items-center justify-between pt-1">
                    <Checkbox
                      id="remember"
                      label="Remember me"
                      checked={!!rememberMe}
                      onChange={(checked) => setValue("rememberMe", checked)}
                    />
                    <Link
                      to="/forgot-password"
                      className="text-xs font-medium text-gray-400 hover:text-white transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-4 ">
                  <Button
                    type="submit"
                    isLoading={isSubmitting}
                    disabled={isSubmitting}
                    className="cursor-pointer"
                  >
                    {isSubmitting ? "Signing In..." : "Sign In"}
                  </Button>
                </div>
              </form>

              {/* Social Login */}
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-widest">
                  <span className="bg-[#09090b]/50 backdrop-blur-md px-3 text-gray-500 font-medium rounded-full">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="flex gap-4">
                <Link
                  to={`${import.meta.env.VITE_API_URL}/auth/facebook`}
                  className="w-full"
                >
                  <Button variant="outline" className="w-full cursor-pointer">
                    <Facebook className="mr-2 h-4 w-4" /> Facebook
                  </Button>
                </Link>
                <Link
                  to={`${import.meta.env.VITE_API_URL}/auth/google`}
                  className="w-full"
                >
                  <Button variant="outline" className="w-full cursor-pointer">
                    <Chrome className="mr-2 h-4 w-4" /> Google
                  </Button>
                </Link>
              </div>

              <div className="mt-8 text-center text-sm">
                <p className="text-gray-500">
                  Don't have an account?{" "}
                  <Link
                    to="/register"
                    className="text-white font-semibold hover:underline decoration-indigo-500 underline-offset-4 transition-all ml-1"
                  >
                    Sign up
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
