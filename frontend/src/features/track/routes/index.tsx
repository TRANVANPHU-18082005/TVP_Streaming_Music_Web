import { lazy, Suspense } from "react";
import { CLIENT_PATHS } from "@/config/paths";
import { type RouteObject } from "react-router-dom";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";
import { TrackHistoryPage } from "@/pages/client";

const LazyTrackDetailPage = lazy(
  () => import("@/pages/client/track/TrackDetailPage"),
);

export const trackRoutes: RouteObject[] = [
  {
    path: CLIENT_PATHS.TRACK_HISTORY,
    element: <TrackHistoryPage />,
  },
  {
    path: CLIENT_PATHS.TRACK_DETAIL(":id"),
    element: (
      <Suspense fallback={<WaveformLoader glass={false} text="Đang tải..." />}>
        <LazyTrackDetailPage />
      </Suspense>
    ),
  },
];
