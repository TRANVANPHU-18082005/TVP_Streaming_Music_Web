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

import { Suspense } from "react";

import { RouterProvider } from "react-router-dom";

import { router } from "@/app/routes/route";

// --- Components ---
import { RadioLoader } from "@/components/ui/MusicLoadingEffects";
import { AppProviders } from "@/app/provider/appProvider";

// ============================================================================
// 2. ROOT APP (With Router)
// ============================================================================

export const AppWithRouter = () => (
  <AppProviders>
    {/**
     * @component Suspense
     * @reason Dùng cho Lazy Loading các route (Code Splitting).
     * Hiển thị loader khi người dùng tải các chunk JS mới.
     */}
    <Suspense
      fallback={
        <RadioLoader glass={false} fullscreen text="Đang tải tài nguyên..." />
      }
    >
      <RouterProvider router={router} />
    </Suspense>
  </AppProviders>
);
