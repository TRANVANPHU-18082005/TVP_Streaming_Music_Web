// src/layouts/RootLayout.tsx
import { Outlet } from "react-router-dom";
import { useInitAuth } from "@/features/auth";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";
import { useAppSelector } from "@/store/hooks";
import { ContextSheetProvider } from "@/app/provider/SheetProvider";
import SleepTimerProvider from "@/features/player/sleepTimer/SleepTimerProvider";
import { lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const MusicPlayer = lazy(
  () => import("@/features/player/components/MusicPlayer"),
);
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
    <SleepTimerProvider>
      <ContextSheetProvider>
        <div className="relative min-h-screen">
          <main className="">
            {/* Thêm padding bottom để không bị Player đè mất nội dung cuối trang */}
            <Outlet />
          </main>

          {/* 4. MusicPlayer: Luôn hiện diện xuyên suốt các trang */}
          <ErrorBoundary
            name="trình phát nhạc"
            fallback={({ reset }) => (
              <div
                role="alert"
                className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-3 border-t border-border bg-background/95 px-4 py-3 text-sm backdrop-blur"
              >
                <span>Trình phát nhạc gặp sự cố.</span>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-muted"
                >
                  Thử lại
                </button>
              </div>
            )}
          >
            <Suspense fallback={null}>
              <MusicPlayer />
            </Suspense>
          </ErrorBoundary>
        </div>
      </ContextSheetProvider>
    </SleepTimerProvider>
  );
};

export default RootLayout;
