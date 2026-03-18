import { lazy } from "react";
export const RootLayout = lazy(() => import("./root/RootLayout"));
export const ClientLayout = lazy(() => import("./client/ClientLayout"));
export const AdminLayout = lazy(() => import("./admin/AdminLayout"));
