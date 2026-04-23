import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";
import MusicResult from "@/components/ui/Result";
import { useAppSelector } from "@/store/hooks";
import { AlertCircle, LogInIcon } from "lucide-react";
import React from "react";
import { Outlet, useNavigate } from "react-router-dom";

/**
 * ✅ ProtectedRoute
 * - Bảo vệ route yêu cầu đăng nhập
 * - Có thể giới hạn role: admin, teacher, student, ...
 */
const ProtectedRoute: React.FC<{ requiredRole?: string }> = ({
  requiredRole,
}) => {
  const navigate = useNavigate();
  const { token, user, isAuthChecking } = useAppSelector((state) => state.auth);
  // 1️⃣ Đang xác thực (ví dụ đang gọi refreshToken)
  if (isAuthChecking) {
    return <WaveformLoader glass={false} text="Đang xác thực..." fullscreen />;
  }

  // 2️⃣ Chưa đăng nhập → yêu cầu login
  if (!token) {
    return (
      <div className="section-container min-h-screen flex items-center justify-center">
        <MusicResult
          variant="no-permission"
          title="Yêu cầu đăng nhập"
          description="Vui lòng đăng nhập để truy cập nội dung này."
          action={{
            label: "Đăng nhập",
            icon: LogInIcon,
            onClick: () => {},
            variant: "primary",
          }}
        />
      </div>
    );
  }
  if (user?.mustChangePassword) {
    return (
      <div className="section-container min-h-screen flex items-center justify-center">
        <MusicResult
          variant="custom"
          icon={AlertCircle}
          title="Cảnh báo bảo mật"
          wave="--wave-4"
          description="Bạn phải đổi mật khẩu lần đầu để đảm bảo an toàn."
          action={{
            label: "Đổi mật khẩu",
            icon: LogInIcon,
            onClick: () => {
              navigate("/force-change-password");
            },
            variant: "primary",
          }}
        />
      </div>
    );
  }
  // 3️⃣ Kiểm tra role (nếu route có yêu cầu)
  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div className="section-container min-h-screen flex items-center justify-center">
        <MusicResult
          variant="no-permission"
          action={{
            label: "Quay lại trang chủ",
            icon: LogInIcon,
            onClick: () => navigate("/"),
            variant: "primary",
          }}
        />
      </div>
    );
  }

  // 4️⃣ Đã xác thực hợp lệ → cho phép truy cập
  return <Outlet />;
};

export default ProtectedRoute;
