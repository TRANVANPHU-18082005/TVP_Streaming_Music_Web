import { useEffect, useRef } from "react";
import { initAuth, authCheckFinished } from "@/features/auth/slice/authSlice";
import { useAppDispatch } from "@/store/hooks";

const SOCIAL_CALLBACK_ROUTES = [
  "/auth/google/callback",
  "/auth/facebook/callback",
];

export const useInitAuth = () => {
  const dispatch = useAppDispatch();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const { pathname, search } = window.location;

    const isSocialCallback =
      SOCIAL_CALLBACK_ROUTES.includes(pathname) &&
      (search.includes("token=") || search.includes("code="));

    if (isSocialCallback) {
      dispatch(authCheckFinished());
      return;
    }

    dispatch(initAuth());
  }, [dispatch]);
};
