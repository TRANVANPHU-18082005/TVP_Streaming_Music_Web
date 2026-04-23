/**
 * @file providers.tsx
 * @description Wrapper Component chứa toàn bộ các Global Providers của ứng dụng.
 * @architecture
 * - ReduxProvider: State Management.
 * - PersistGate: Chặn render UI cho đến khi State được khôi phục từ LocalStorage (F5 không mất nhạc).
 * - QueryClientProvider: Server State (TanStack Query).
 * - SocketProvider: Realtime Connection.
 * - ThemeProvider: Dark/Light mode.
 */

import React from "react";
import { Provider as ReduxProvider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

// --- Internal Modules ---
import { store, persistor } from "@/store/store";
import { queryClient } from "@/lib/queryClient";

// --- Components ---
import { RadioLoader } from "@/components/ui/MusicLoadingEffects";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SocketProvider } from "@/app/provider/SocketProvider";

// ============================================================================
// 1. APP PROVIDERS (Global Context Wrappers)
// ============================================================================

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <ReduxProvider store={store}>
    {/**
     * @component PersistGate
     * @ux Hiển thị EqualizerLoader trong lúc chờ Redux lấy dữ liệu từ LocalStorage.
     * Điều này ngăn chặn việc UI bị "nháy" (FOUC) hoặc hiển thị sai trạng thái login/player.
     */}
    <PersistGate
      loading={
        <RadioLoader
          glass={false}
          fullscreen
          text="Đang khôi phục dữ liệu..."
        />
      }
      persistor={persistor}
    >
      <QueryClientProvider client={queryClient}>
        <SocketProvider>
          {/* ThemeProvider quản lý Class 'dark'/'light' trên thẻ HTML */}
          <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            {children}

            {/* ========================================================= */}
            {/* PREMIUM TOASTER (Thông báo chuẩn Apple Music / Spotify) */}
            {/* ========================================================= */}
            <Toaster
              position="top-center" // Hiển thị ở trên cùng giữa màn hình (rất mượt cho Mobile)
              expand={true} // Xếp chồng các thông báo lên nhau dạng thẻ
              offset={24} // Khoảng cách an toàn với cạnh màn hình
              toastOptions={{
                // Sử dụng Tailwind classNames để can thiệp sâu vào UI của Sonner
                classNames: {
                  toast:
                    "group flex items-center gap-3 bg-background/85 backdrop-blur-2xl border border-border/50 text-foreground shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] rounded-[20px] p-4 font-sans w-full max-w-[400px]",
                  title: "text-[14px] font-bold tracking-tight text-foreground",
                  description: "text-[13px] font-medium text-muted-foreground",
                  actionButton:
                    "bg-primary text-primary-foreground font-bold rounded-full px-5 py-2 transition-transform hover:scale-105 active:scale-95",
                  cancelButton:
                    "bg-muted text-foreground font-bold rounded-full px-5 py-2 hover:bg-muted/80 transition-colors",
                  // Tự động đổi màu Icon theo trạng thái
                  icon: "group-data-[type=error]:text-destructive group-data-[type=success]:text-emerald-500 group-data-[type=warning]:text-amber-500 group-data-[type=info]:text-blue-500 size-5",
                },
              }}
            />
          </ThemeProvider>
        </SocketProvider>
      </QueryClientProvider>
    </PersistGate>
  </ReduxProvider>
);
