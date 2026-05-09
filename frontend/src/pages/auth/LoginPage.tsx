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

    if (!error && !reason) return;

    // 🚀 2. Dọn dẹp URL ngay lập tức để nhìn chuyên nghiệp
    isProcessed.current = true;
    navigate("/login", { replace: true });

    // 🚀 3. Hiển thị thông báo dựa trên tín hiệu từ URL
    if (error === "locked") {
      toast.error("Tài khoản này đã bị khóa", {
        description: "Vui lòng liên hệ Admin để được hỗ trợ.",
      });
    } else if (reason === "session_expired") {
      toast.info("Phiên làm việc hết hạn", {
        description: "Vui lòng đăng nhập lại để tiếp tục.",
      });
    } else if (error === "auth_failed") {
      toast.error("Đăng nhập thất bại", {
        description: "Vui lòng thử lại bằng Email/Mật khẩu.",
      });
    } else if (error === "server_error") {
      toast.error("Lỗi hệ thống", {
        description: "Không thể kết nối đến máy chủ lúc này.",
      });
    }
  }, [searchParams, navigate]);

  return <LoginForm />;
};

export default LoginPage;
