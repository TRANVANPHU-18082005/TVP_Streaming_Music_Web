import { lazy } from "react";
export const DashboardPage = lazy(() => import("./DashboardPage"));
export const UsersManagementPage = lazy(() => import("./UsersManagementPage"));
export const TrackManagementPage = lazy(() => import("./TrackManagementPage"));
export const ArtistManagementPage = lazy(
  () => import("./ArtistManagementPage"),
);
export const GenreManagementPage = lazy(() => import("./GenreManagementPage"));
export const AlbumManagementPage = lazy(() => import("./AlbumManagementPage"));
export const PlaylistManagementPage = lazy(
  () => import("./PlaylistManagementPage"),
);
export const MoodVideoManagementPage = lazy(
  () => import("./MoodVideoManagementPage"),
);
export const AnalyticPage = lazy(() => import("./AnalyticPage"));
export const SettingPage = lazy(() => import("./SettingPage"));
