import { CLIENT_PATHS } from "@/config/paths";
import TrackHitory from "@/pages/client/TrackHistoryPage";
import { type RouteObject } from "react-router-dom";

export const trackRoutes: RouteObject[] = [
  {
    path: CLIENT_PATHS.TRACK_HISTORY,
    element: <TrackHitory />,
  },
];
