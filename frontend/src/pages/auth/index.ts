import { lazy } from "react";
export const LoginPage = lazy(() => import("./LoginPage"));
export const RegisterPage = lazy(() => import("./RegisterPage"));
export const VerifyOtpPage = lazy(() => import("./VerifyOtpPage"));
export const GoogleCallbackPage = lazy(() => import("./GoogleCallbackPage"));
export const LogoutPage = lazy(() => import("./LogoutPage"));
export const ForgotPasswordPage = lazy(() => import("./ForgotPasswordPage"));
export const ResetPasswordPage = lazy(() => import("./ResetPasswordPage"));
export const ForceChangePasswordPage = lazy(
  () => import("./ForceChangePasswordPage"),
);
