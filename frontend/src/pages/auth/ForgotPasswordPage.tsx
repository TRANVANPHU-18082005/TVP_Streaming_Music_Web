import { AnimatedBackground } from "@/components/AmbientBackground";
import ForgotPasswordForm from "@/features/auth/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <>
      <style>{`
        @keyframes blob { 0% { transform: translate(0px, 0px) scale(1); } 33% { transform: translate(30px, -50px) scale(1.1); } 66% { transform: translate(-20px, 20px) scale(0.9); } 100% { transform: translate(0px, 0px) scale(1); } }
        .animate-blob { animation: blob 10s infinite; }
        .animate-fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill:active { -webkit-text-fill-color: white !important; -webkit-box-shadow: 0 0 0 0 transparent inset !important; transition: background-color 9999s ease-in-out 0s; }
      `}</style>

      <div className="min-h-screen w-full flex bg-[#08080a] text-white font-sans selection:bg-indigo-500/30 overflow-hidden items-center justify-center">
        <AnimatedBackground />

        <div className="relative z-10 w-full max-w-[480px] p-6 sm:p-12">
          <ForgotPasswordForm />
        </div>
      </div>
    </>
  );
}
