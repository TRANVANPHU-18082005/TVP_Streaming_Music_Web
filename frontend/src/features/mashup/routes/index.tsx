import { CLIENT_PATHS } from "@/config/paths";
import { RouteObject } from "react-router-dom";
import { MashupFeedPage } from "../pages/MashupFeedPage";
import { MashupBuilderPage } from "../pages/MashupBuilderPage";
import { MashupDetailPage } from "../pages/MashupDetailPage";

export const mashupRoutes: RouteObject[] = [
  {
    path: CLIENT_PATHS.MASHUPS_FEED,
    element: <MashupFeedPage />,
  },
  {
    path: CLIENT_PATHS.MASHUPS_CREATE,
    element: <MashupBuilderPage />,
  },
  {
    path: CLIENT_PATHS.MASHUPS_DETAIL(":id"),
    element: <MashupDetailPage />,
  },
];
