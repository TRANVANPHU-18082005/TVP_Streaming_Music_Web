import { CLIENT_PATHS } from "@/config/paths";
import { type RouteObject } from "react-router-dom";
import { TrackHistoryPage } from "@/pages/client";


export const trackRoutes: RouteObject[] = [
  {
    path: CLIENT_PATHS.TRACK_HISTORY,
    element: <TrackHistoryPage />,
  },
  
];
