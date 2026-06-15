import { CLIENT_PATHS } from "@/config/paths";
import { RouteObject } from "react-router-dom";
import { ForMePage } from "../pages/ForMePage";

export const forMeRoutes: RouteObject[] = [
  {
    path: CLIENT_PATHS.FOR_ME,
    element: <ForMePage />,
  },
];
