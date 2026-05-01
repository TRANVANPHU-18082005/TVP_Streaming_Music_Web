// src/features/auth/hooks/useInitAuth.ts
import { useEffect, useRef } from "react";
import { initAuth, authCheckFinished } from "@/features/auth/slice/authSlice";
import { useAppDispatch } from "@/store/hooks";

export const useInitAuth = () => {
  const dispatch = useAppDispatch();
  const initialized = useRef(false);

  useEffect(() => {
    // Chống React StrictMode chạy 2 lần ở môi trường Dev
    if (initialized.current) return;
    initialized.current = true;

    try {
      // Nếu đang trên callback social kèm token (ví dụ /auth/facebook?token=...), skip initAuth
      const pathname = window.location?.pathname || "";
      const search = window.location?.search || "";
      const isSocialCallback =
        pathname.startsWith("/auth") &&
        (search.includes("token=") || search.includes("code="));

      if (isSocialCallback) {
        // Let the social callback page handle login using the provided access token
        // and mark auth check finished so RootLayout won't block rendering.
        dispatch(authCheckFinished());
        return;
      }
    } catch (e) {
      // ignore (window may be undefined in some test env)
    }

    dispatch(initAuth());
  }, [dispatch]);
};
