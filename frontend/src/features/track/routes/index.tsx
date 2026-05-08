import { lazy, Suspense } from "react";
import { CLIENT_PATHS } from "@/config/paths";
import TrackHitory from "@/pages/client/TrackHistoryPage";
import { type RouteObject } from "react-router-dom";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";

const LazyTrackDetailPage = lazy(() => import("@/pages/client/track/TrackDetailPage"));

export const trackRoutes: RouteObject[] = [
  {
    path: CLIENT_PATHS.TRACK_HISTORY,
    element: <TrackHitory />,
  },
  {
    path: CLIENT_PATHS.TRACK_DETAIL(":slug"),
    element: (
      <Suspense fallback={<WaveformLoader glass={false} text="Đang tải..." />}>
        <LazyTrackDetailPage />
      </Suspense>
    ),
  },
];
