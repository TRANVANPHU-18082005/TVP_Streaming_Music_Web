import VerifyOtpForm from "@/features/auth/components/VerifyOtpForm";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { toast } from "sonner";
import { AnimatedBackground } from "@/components/AmbientBackground";



export default function VerifyOtpPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Lấy email từ state. Nếu không có (người dùng vào thẳng link), redirect
  const email = location.state?.email;

  useEffect(() => {
    if (!email) {
      toast.warning("Phiên giao dịch không hợp lệ. Vui lòng đăng nhập lại.");
      navigate("/login", { replace: true });
    }
  }, [email, navigate]);

  // Nếu chưa có email (đang đợi redirect) thì không render gì cả để tránh nháy giao diện
  if (!email) return null;

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
        input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill:active {
            -webkit-text-fill-color: white !important;
            -webkit-box-shadow: 0 0 0 0 transparent inset !important;
            transition: background-color 9999s ease-in-out 0s;
        }
        input:-webkit-autofill ~ label { top: 0.875rem !important; transform: translateY(-50%) scale(0.85) !important; color: #9ca3af; }
        input:-webkit-autofill:focus ~ label { color: #a5b4fc; }
      `}</style>

      <div className="min-h-screen w-full flex bg-[#09090b] text-white font-sans selection:bg-indigo-500/30 overflow-hidden">
        {/* --- RIGHT COLUMN: Content Area --- */}
        <div className="w-full relative flex items-center justify-center overflow-hidden">
          <AnimatedBackground />
          <div className="relative z-10 w-full max-w-[480px] py-4 px-6 sm:p-12">
            <VerifyOtpForm email={email} />
          </div>
        </div>
      </div>
    </>
  );
}
