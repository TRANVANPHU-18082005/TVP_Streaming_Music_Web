// src/layouts/RootLayout.tsx
import { Outlet } from "react-router-dom";
import { useInitAuth } from "@/features/auth";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";
import { MusicPlayer } from "@/features/player/components/MusicPlayer";
import { useAppSelector } from "@/store/hooks";
import { ContextSheetProvider } from "@/app/provider/SheetProvider";

const RootLayout = () => {
  useInitAuth();

  // 2. Lấy trạng thái kiểm tra từ Store
  const { isAuthChecking } = useAppSelector((state) => state.auth);

  // 3. Splash Screen: Chặn render Outlet cho đến khi xác định được danh tính (User hoặc Guest)
  if (isAuthChecking) {
    return (
      <WaveformLoader
        glass={false}
        fullscreen
        text="Đang kết nối hệ thống..."
      />
    );
  }

  return (
    <ContextSheetProvider>
      <div className="relative min-h-screen">
        <main className="">
          {/* Thêm padding bottom để không bị Player đè mất nội dung cuối trang */}
          <Outlet />
        </main>

        {/* 4. MusicPlayer: Luôn hiện diện xuyên suốt các trang */}
        <MusicPlayer />
      </div>
    </ContextSheetProvider>
  );
};

export default RootLayout;
