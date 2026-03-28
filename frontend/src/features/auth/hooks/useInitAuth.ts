// src/features/auth/hooks/useInitAuth.ts
import { useEffect, useRef } from "react";
import { initAuth } from "@/features/auth/slice/authSlice";
import { useAppDispatch } from "@/store/hooks";

export const useInitAuth = () => {
  const dispatch = useAppDispatch();
  const initialized = useRef(false);

  useEffect(() => {
    // Chống React StrictMode chạy 2 lần ở môi trường Dev
    if (initialized.current) return;
    initialized.current = true;

    dispatch(initAuth());
  }, [dispatch]);
};
