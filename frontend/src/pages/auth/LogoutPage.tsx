import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { toast } from "sonner"; // Hoặc notification của bạn
import authApi from "@/features/auth/api/authApi";

import { useAppDispatch } from "@/store/hooks";
import { persistor } from "@/store/store";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";
import { logout } from "@/features/auth";

const LogoutPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const hasCalled = useRef(false); // Chống React.StrictMode gọi 2 lần

  useEffect(() => {
    if (hasCalled.current) return;
    hasCalled.current = true;

    const handleLogout = async () => {
      try {
        // 1. Gọi API để Backend xóa Cookie HttpOnly
        // (Chúng ta không quan tâm kết quả trả về, cứ gọi là được)
        await authApi.logout();
      } catch (error) {
        console.error("Logout API error:", error);
        // Không cần báo lỗi cho user, vì mục đích cuối cùng vẫn là logout
      } finally {
        // 2. Xóa State trong Redux (Quan trọng nhất)
        dispatch(logout());
        await persistor.purge();
        // 3. Thông báo nhẹ
        toast.success("Đã đăng xuất thành công");

        // 4. Chuyển hướng về trang Login (replace: true để không back lại được trang này)
        navigate("/login", { replace: true });
      }
    };

    handleLogout();
  }, [dispatch, navigate]);

  return <WaveformLoader glass={false} fullscreen text="Đang đăng xuất..." />;
};

export default LogoutPage;
