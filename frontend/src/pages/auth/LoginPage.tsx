// src/features/auth/pages/LoginPage.tsx
import { LoginForm } from "@/features/auth";
import { useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";

const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isProcessed = useRef(false);

  useEffect(() => {
    // 🚀 1. Chặn chạy 2 lần hoặc chạy lại khi re-render
    if (isProcessed.current) return;

    const error = searchParams.get("error");
    const reason = searchParams.get("reason");
    const provider = searchParams.get("provider");
    const providerName =
      provider === "google" || error === "google_auth_failed"
        ? "Google"
        : provider === "facebook" || error === "facebook_auth_failed"
          ? "Facebook"
          : "Mạng xã hội";

    console.log("error", error);
    console.log("reason", reason);
    if (!error && !reason) return;

    // 🚀 2. Dọn dẹp URL ngay lập tức để nhìn chuyên nghiệp
    isProcessed.current = true;
    navigate("/login", { replace: true });

    // 🚀 3. Hiển thị thông báo dựa trên tín hiệu từ URL (UX chuyên nghiệp)
    if (error === "OAUTH_USER_CANCELLED" || error === "access_denied" || error === "user_cancelled") {
      toast.info(`Đã hủy đăng nhập ${providerName}`.trim(), {
        description: `Bạn đã hủy hoặc từ chối cấp quyền đăng nhập qua ${providerName}.`,
      });
    } else if (error === "OAUTH_EMAIL_MISSING") {
      toast.error("Thiếu thông tin Email", {
        description:
          reason ||
          `Tài khoản ${providerName} của bạn không chia sẻ địa chỉ Email. Vui lòng cấp quyền hoặc sử dụng tài khoản có liên kết Email.`,
      });
    } else if (error === "PROVIDER_EMAIL_NOT_VERIFIED") {
      toast.error("Email chưa được xác minh", {
        description:
          reason ||
          `Email từ ${providerName} chưa được xác minh. Vui lòng xác minh email trước khi đăng nhập.`,
      });
    } else if (error === "ACCOUNT_LOCKED" || error === "locked") {
      toast.error("Tài khoản đã bị khóa", {
        description:
          reason ||
          "Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ Admin để được hỗ trợ.",
      });
    } else if (
      error === "OAUTH_TOKEN_EXCHANGE_FAILED" ||
      error === "OAUTH_PROVIDER_ERROR" ||
      error === "OAUTH_ERROR" ||
      error === "facebook_auth_failed" ||
      error === "google_auth_failed"
    ) {
      toast.error(`Đăng nhập ${providerName} thất bại`, {
        description:
          reason ||
          `Có lỗi xảy ra trong quá trình xác thực với ${providerName}. Vui lòng thử lại sau.`,
      });
    } else if (reason === "session_expired") {
      toast.info("Phiên làm việc hết hạn", {
        description: "Vui lòng đăng nhập lại để tiếp tục.",
      });
    } else if (error === "auth_failed") {
      toast.error("Đăng nhập thất bại", {
        description: reason || "Vui lòng kiểm tra lại thông tin đăng nhập hoặc phương thức đăng nhập.",
      });
    } else if (error === "server_error") {
      toast.error("Lỗi hệ thống", {
        description: reason || "Không thể kết nối đến máy chủ lúc này.",
      });
    } else {
      toast.error("Đăng nhập thất bại", {
        description: reason || "Đã có lỗi xảy ra. Vui lòng thử lại sau.",
      });
    }
  }, [searchParams, navigate]);

  return <LoginForm />;
};

export default LoginPage;
