import { ADMIN_PATHS } from "@/config/paths";
import { RouteObject } from "react-router-dom";
import { MashupManagementPage } from "../pages/MashupManagementPage";

export const mashupAdminRoutes: RouteObject[] = [
  {
    path: ADMIN_PATHS.MASHUPS,
    element: <MashupManagementPage />,
  },
];
