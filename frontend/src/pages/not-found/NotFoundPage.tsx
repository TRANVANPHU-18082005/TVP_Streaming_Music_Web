import React from "react";
import { Disc, Home, Search, Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

// ==========================================
// 1. [COMPONENTS - REUSED]
// (Tái sử dụng Button & Utility từ trang Login để đồng bộ)
// ==========================================

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "outline" | "ghost";
    size?: string;
  }
>(({ className, variant = "primary", size = "default", ...props }, ref) => {
  const base =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50 active:scale-95 touch-manipulation";

  const variants = {
    primary:
      "bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.25)] hover:-translate-y-0.5 border-0",
    outline:
      "border border-zinc-700 bg-transparent text-zinc-400 hover:bg-white hover:text-black hover:border-white hover:shadow-[0_0_15px_rgba(255,255,255,0.3)] hover:-translate-y-0.5",
    ghost: "hover:bg-white/10 text-zinc-400 hover:text-white bg-transparent",
  };

  const sizes = {
    default: "h-12 px-8",
    icon: "h-10 w-10 p-0",
  };

  return (
    <button
      ref={ref}
      className={cn(
        base,
        variants[variant],
        sizes[size as keyof typeof sizes],
        className,
      )}
      {...props}
    />
  );
});
Button.displayName = "Button";

// ==========================================
// 2. [NOT FOUND PAGE]
// ==========================================

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-black font-sans text-zinc-100 selection:bg-white/30 overflow-hidden relative p-6">
      {/* --- BACKGROUND EFFECTS --- */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Static Noise */}
        <div className="absolute inset-0 opacity-[0.07] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-zinc-800/10 rounded-full blur-[150px] animate-pulse delay-1000" />
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-700">
        {/* GLITCHING VINYL DISC */}
        <div className="relative group">
          {/* Glow behind disc */}
          <div className="absolute inset-0 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all duration-500" />

          {/* The Disc */}
          <div className="relative w-40 h-40 md:w-56 md:h-56 flex items-center justify-center rounded-full bg-zinc-900 border-2 border-zinc-800 shadow-2xl">
            {/* Spinning Animation (Slow & Broken) */}
            <div className="absolute inset-0 rounded-full border border-white/5 animate-[spin_10s_linear_infinite_paused] group-hover:animate-play-state-running"></div>
            <div className="absolute inset-2 rounded-full border border-white/5"></div>
            <div className="absolute inset-8 rounded-full border border-white/5"></div>

            {/* Center Label with Glitch Icon */}
            <div className="w-16 h-16 md:w-24 md:h-24 bg-gradient-to-tr from-zinc-800 to-black rounded-full flex items-center justify-center border border-zinc-700 relative overflow-hidden">
              <Music className="w-8 h-8 md:w-10 md:h-10 text-zinc-500 relative z-10" />
              {/* Crack effect line */}
              <div className="absolute top-0 left-1/2 w-[1px] h-full bg-zinc-600/50 -rotate-45 transform origin-center"></div>
            </div>

            {/* Floating '404' Text acting like a broken needle */}
            <div className="absolute -top-4 -right-8 bg-white text-black text-xs font-bold px-2 py-1 rounded-sm rotate-12 shadow-lg">
              ERR_404
            </div>
          </div>
        </div>

        {/* TEXT CONTENT */}
        <div className="space-y-4 max-w-md">
          <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter drop-shadow-2xl">
            404
          </h1>
          <h2 className="text-xl md:text-2xl font-bold text-zinc-300 uppercase tracking-widest">
            Not Found
          </h2>
          <p className="text-zinc-500 text-sm md:text-base leading-relaxed">
            Có vẻ như bài hát bạn đang tìm kiếm đã bị xóa hoặc đường dẫn bị
            hỏng. Giai điệu này không tồn tại trong thư viện của chúng tôi.
          </p>
        </div>

        {/* ACTIONS */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto pt-4">
          <Button
            variant="primary"
            className="w-full sm:w-auto gap-3"
            onClick={() => navigate("/")}
          >
            <Home className="w-4 h-4" />
            Về Trang Chủ
          </Button>

          <Button variant="outline" className="w-full sm:w-auto gap-3">
            <Search className="w-4 h-4" />
            Tìm Bài Hát Khác
          </Button>
        </div>
      </div>

      {/* FOOTER DECORATION */}
      <div className="absolute bottom-8 text-[10px] text-zinc-700 font-mono uppercase tracking-widest flex items-center gap-2 opacity-50">
        <Disc className="w-3 h-3 animate-spin" />
        MusicHub System • Signal Lost
      </div>
    </div>
  );
}
