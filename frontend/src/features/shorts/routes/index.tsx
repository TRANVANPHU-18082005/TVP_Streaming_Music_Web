import { CLIENT_PATHS } from "@/config/paths";
import { RouteObject } from "react-router-dom";
import { ShortsPage } from "../pages/ShortsPage";

export const shortsRoutes: RouteObject[] = [
  {
    path: CLIENT_PATHS.SHORTS,
    element: <ShortsPage />,
  },
];
