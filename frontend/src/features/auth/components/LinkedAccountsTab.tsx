import React, { useState, useMemo } from "react";
import {
  Shield,
  ShieldCheck,
  KeyRound,
  Link2,
  Unlink,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Plus,
  Loader2,
  Lock,
  AlertCircle,
  Info,
  ExternalLink,
  Sparkles,
  Github,
  Check,
} from "lucide-react";
import { FaFacebook, FaApple, FaMicrosoft } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { useLinkedAccounts } from "../hooks/useLinkedAccounts";
import { useAppSelector } from "@/store/hooks";
import { env } from "@/config/env";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PremiumMusicVisualizer } from "@/components/MusicVisualizer";

export const LinkedAccountsTab: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);
  const {
    identities,
    isLoading,
    linkProvider,
    isLinking,
    unlinkProvider,
    isUnlinking,
  } = useLinkedAccounts();

  // Modal test liên kết nhanh cho developer / testing
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<"google" | "facebook">("google");
  const [testEmail, setTestEmail] = useState("");
  const [testUserId, setTestUserId] = useState("");

  // Kiểm tra trạng thái từng provider
  const pwdIdentity = useMemo(
    () => identities.find((i) => i.provider === "password"),
    [identities]
  );
  const googleIdentity = useMemo(
    () => identities.find((i) => i.provider === "google"),
    [identities]
  );
  const facebookIdentity = useMemo(
    () => identities.find((i) => i.provider === "facebook"),
    [identities]
  );

  const totalConnected = identities.length;

  const handleOpenLinkModal = (provider: "google" | "facebook") => {
    setSelectedProvider(provider);
    const randomId = `${provider}_${Math.floor(100000000 + Math.random() * 900000000)}`;
    const defaultEmail = `${user?.username || "user"}.${provider}@gmail.com`;
    setTestUserId(randomId);
    setTestEmail(defaultEmail);
    setModalOpen(true);
  };

  const handleSimulateLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail || !testUserId) return;
    linkProvider(
      {
        provider: selectedProvider,
        providerUserId: testUserId,
        providerEmail: testEmail,
      },
      {
        onSuccess: () => {
          setModalOpen(false);
        },
      }
    );
  };

  const handleUnlink = (provider: any) => {
    if (totalConnected <= 1) {
      alert("Cảnh báo an toàn: Bạn không thể hủy liên kết phương thức đăng nhập cuối cùng!");
      return;
    }
    if (window.confirm(`Bạn có chắc chắn muốn hủy liên kết tài khoản ${provider.toUpperCase()} không?`)) {
      unlinkProvider(provider);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground animate-pulse">
        <PremiumMusicVisualizer active={true} />
        <p className="text-sm font-medium">Đang tải thông tin bảo mật tài khoản...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* 1. HEADER CARD */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950/40 via-background to-purple-950/20 border border-white/10 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-white">Bảo mật & Liên kết tài khoản</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Enterprise Auth
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Quản lý các tài khoản mạng xã hội và phương thức đăng nhập được kết nối với hồ sơ của bạn. Bạn có thể sử dụng bất kỳ phương thức đã liên kết nào để đăng nhập vào cùng một tài khoản này.
              </p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3 shrink-0 self-stretch sm:self-auto justify-center">
            <div className="text-right">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Phương thức kết nối</p>
              <p className="text-lg font-bold text-white leading-none mt-0.5">{totalConnected} / 3</p>
            </div>
            <div className="size-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
              <Link2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* CẢNH BÁO AN TOÀN ENTERPRISE */}
        <div className="mt-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3.5">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90 leading-relaxed">
            <span className="font-bold text-amber-300">Quy tắc chống mất tài khoản (Account Lockout Prevention):</span> Hệ thống yêu cầu bạn phải duy trì ít nhất <strong>1 phương thức xác thực</strong> hoạt động. Bạn không thể hủy liên kết phương thức đăng nhập cuối cùng.
          </div>
        </div>
      </div>

      {/* 2. DANH SÁCH PHƯƠNG THỨC LIÊN KẾT */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Phương thức đăng nhập đang hoạt động
        </h3>

        <div className="grid grid-cols-1 gap-4">
          {/* --- PROVIDER: EMAIL & PASSWORD --- */}
          <div className="group relative overflow-hidden rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 p-5 transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white text-base">Email & Mật khẩu</h4>
                  {(pwdIdentity || user?.email) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" /> Đã kết nối
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pwdIdentity?.provider_email || user?.email || "Chưa thiết lập email"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              {(pwdIdentity || user?.email) ? (
                <Link to="/forgot-password">
                  <button className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition-all flex items-center gap-2 cursor-pointer">
                    <KeyRound className="w-3.5 h-3.5 text-indigo-400" /> Đổi mật khẩu
                  </button>
                </Link>
              ) : (
                <button className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-xs font-semibold text-white transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> Thêm Mật khẩu
                </button>
              )}
            </div>
          </div>

          {/* --- PROVIDER: GOOGLE OAUTH --- */}
          <div className={cn(
            "group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
            googleIdentity
              ? "bg-white/[0.04] border-white/15 shadow-lg shadow-black/20"
              : "bg-white/[0.015] border-white/5 hover:border-white/15 opacity-80 hover:opacity-100"
          )}>
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                <FcGoogle className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white text-base">Google Sign-In</h4>
                  {googleIdentity ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" /> Đã liên kết
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/5 text-gray-400 border border-white/10">
                      Chưa kết nối
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  {googleIdentity?.provider_email || googleIdentity?.provider_user_id || "Đăng nhập nhanh chỉ với 1 chạm thông qua Google"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              {googleIdentity ? (
                <button
                  type="button"
                  onClick={() => handleUnlink("google")}
                  disabled={isUnlinking || totalConnected <= 1}
                  className={cn(
                    "px-4 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer",
                    totalConnected <= 1
                      ? "bg-red-500/5 border-red-500/10 text-red-400/50 cursor-not-allowed"
                      : "bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-300 hover:text-red-200"
                  )}
                  title={totalConnected <= 1 ? "Không thể hủy liên kết phương thức duy nhất" : "Hủy liên kết tài khoản Google"}
                >
                  {isUnlinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                  Hủy liên kết
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenLinkModal("google")}
                    className="px-4 py-2 rounded-xl bg-white text-black hover:bg-gray-100 text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-white/5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Liên kết Google
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* --- PROVIDER: FACEBOOK OAUTH --- */}
          <div className={cn(
            "group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
            facebookIdentity
              ? "bg-white/[0.04] border-white/15 shadow-lg shadow-black/20"
              : "bg-white/[0.015] border-white/5 hover:border-white/15 opacity-80 hover:opacity-100"
          )}>
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-[#1877F2]/20 border border-[#1877F2]/40 flex items-center justify-center shrink-0">
                <FaFacebook className="w-7 h-7 text-[#1877F2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-white text-base">Facebook Sign-In</h4>
                  {facebookIdentity ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" /> Đã liên kết
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/5 text-gray-400 border border-white/10">
                      Chưa kết nối
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  {facebookIdentity?.provider_email || facebookIdentity?.provider_user_id || "Đăng nhập qua tài khoản mạng xã hội Facebook"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              {facebookIdentity ? (
                <button
                  type="button"
                  onClick={() => handleUnlink("facebook")}
                  disabled={isUnlinking || totalConnected <= 1}
                  className={cn(
                    "px-4 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer",
                    totalConnected <= 1
                      ? "bg-red-500/5 border-red-500/10 text-red-400/50 cursor-not-allowed"
                      : "bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-300 hover:text-red-200"
                  )}
                  title={totalConnected <= 1 ? "Không thể hủy liên kết phương thức duy nhất" : "Hủy liên kết tài khoản Facebook"}
                >
                  {isUnlinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                  Hủy liên kết
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenLinkModal("facebook")}
                    className="px-4 py-2 rounded-xl bg-[#1877F2] hover:bg-[#1877F2]/90 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-[#1877F2]/20 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Liên kết Facebook
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. MỞ RỘNG ENTERPRISE IDENTITIES (COMING SOON) */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-2">
            Mở rộng chuẩn Enterprise (Sắp hỗ trợ)
          </h3>
          <span className="text-[11px] text-gray-500 font-medium">Kiến trúc đa nhà cung cấp N-Identities</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white/[0.01] border border-white/5 p-4 flex items-center gap-3 opacity-50 select-none">
            <div className="size-10 rounded-lg bg-white/5 flex items-center justify-center text-gray-400">
              <Github className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">GitHub OAuth</p>
              <p className="text-[10px] text-gray-500">Dành cho Developer</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.01] border border-white/5 p-4 flex items-center gap-3 opacity-50 select-none">
            <div className="size-10 rounded-lg bg-white/5 flex items-center justify-center text-gray-400">
              <FaApple className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Apple ID</p>
              <p className="text-[10px] text-gray-500">Bảo mật tuyệt đối</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.01] border border-white/5 p-4 flex items-center gap-3 opacity-50 select-none">
            <div className="size-10 rounded-lg bg-white/5 flex items-center justify-center text-gray-400">
              <FaMicrosoft className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Microsoft Entra ID</p>
              <p className="text-[10px] text-gray-500">Doanh nghiệp</p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. MODAL TEST LIÊN KẾT NHANH (ON-DEMAND SIMULATED & OAUTH LINKING) */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#0f0f13] border border-white/15 text-white p-6 rounded-3xl shadow-2xl">
          <DialogHeader>
            <div className="size-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center mb-3">
              {selectedProvider === "google" ? (
                <FcGoogle className="w-6 h-6" />
              ) : (
                <FaFacebook className="w-6 h-6 text-[#1877F2]" />
              )}
            </div>
            <DialogTitle className="text-xl font-bold text-white">
              Liên kết tài khoản {selectedProvider.toUpperCase()}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Chọn phương thức kết nối tài khoản mạng xã hội vào hồ sơ của bạn.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 my-4">
            {/* Lựa chọn 1: OAuth Chuẩn */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-400" /> Chuẩn OAuth 2.0 Redirect
                </span>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold">Production</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-normal">
                Chuyển hướng sang cổng xác thực chính thức của {selectedProvider.toUpperCase()} để xin quyền truy cập.
              </p>
              <Link to={`${env.API_URL}/auth/${selectedProvider}`} className="block w-full">
                <button
                  type="button"
                  className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {selectedProvider === "google" ? <FcGoogle className="w-4 h-4" /> : <FaFacebook className="w-4 h-4 text-[#1877F2]" />}
                  Chuyển hướng xác thực ngay
                </button>
              </Link>
            </div>

            <div className="relative flex items-center justify-center">
              <span className="w-full border-t border-white/10" />
              <span className="absolute bg-[#0f0f13] px-3 text-[10px] font-bold text-gray-500 uppercase">Hoặc Test Demo API</span>
            </div>

            {/* Lựa chọn 2: Simulate Linking cho dev & test */}
            <form onSubmit={handleSimulateLink} className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Mô phỏng Liên kết nhanh (Dev Test)
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">Instant</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-normal">
                Cho phép bạn kiểm tra tính năng liên kết và hủy liên kết trực tiếp trên giao diện mà không cần cấu hình API Key từ Google/Facebook.
              </p>

              <div className="space-y-2 pt-1">
                <div>
                  <label className="text-[11px] font-medium text-gray-400 block mb-1">Email giả lập từ Provider:</label>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    required
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-400 block mb-1">Provider User ID:</label>
                  <input
                    type="text"
                    value={testUserId}
                    onChange={(e) => setTestUserId(e.target.value)}
                    required
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLinking}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer"
              >
                {isLinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Xác nhận Liên kết Demo ngay
              </button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default LinkedAccountsTab;
