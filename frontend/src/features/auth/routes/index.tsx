import { type RouteObject } from "react-router-dom";
import {
  FacebookCallbackPage,
  ForgotPasswordPage,
  GoogleCallbackPage,
  LoginPage,
  LogoutPage,
  RegisterPage,
  ResetPasswordPage,
  VerifyOtpPage,
} from "@/pages";
import { AUTH_PATHS } from "@/config/paths";
import ForceChangePasswordPage from "@/pages/auth/ForceChangePasswordPage";

// 1. Nhóm dành cho khách (Guest Only) - Đã login thì cấm vào
export const guestAuthRoutes: RouteObject[] = [
  {
    path: AUTH_PATHS.LOGIN,
    element: <LoginPage />,
  },
  {
    path: AUTH_PATHS.REGISTER,
    element: <RegisterPage />,
  },
  {
    path: AUTH_PATHS.VERIFY_OTP,
    element: <VerifyOtpPage />,
  },
  {
    path: AUTH_PATHS.AUTH_GOOGLE,
    element: <GoogleCallbackPage />,
  },
  {
    path: AUTH_PATHS.AUTH_FACEBOOK,
    element: <FacebookCallbackPage />,
  },
  {
    path: AUTH_PATHS.FORGOT_PASSWORD,
    element: <ForgotPasswordPage />,
  },
  {
    path: AUTH_PATHS.RESET_PASSWORD(":token"),
    element: <ResetPasswordPage />,
  },
];

// 2. Nhóm dành cho người đã login (Protected)
export const protectedAuthRoutes: RouteObject[] = [
  {
    path: AUTH_PATHS.LOGOUT,
    element: <LogoutPage />,
  },
  {
    path: AUTH_PATHS.FORCE_CHANGE_PASSWORD,
    element: <ForceChangePasswordPage />,
  },
];
