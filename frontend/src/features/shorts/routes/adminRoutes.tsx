import { ADMIN_PATHS } from "@/config/paths";
import { RouteObject } from "react-router-dom";
import { ShortsManagementPage } from "../pages/ShortsManagementPage";

export const shortsAdminRoutes: RouteObject[] = [
  {
    path: ADMIN_PATHS.SHORTS,
    element: <ShortsManagementPage />,
  },
];
