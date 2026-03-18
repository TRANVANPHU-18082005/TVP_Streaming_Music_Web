import { lazy } from "react";
export const DashboardPage = lazy(() => import("./DashboardPage"));
export const UserPage = lazy(() => import("./UsersManagementPage"));
export const SongPage = lazy(() => import("./TrackManagementPage"));
export const ArtistManagementPage = lazy(
  () => import("./ArtistManagementPage"),
);
export const GenreManagementPage = lazy(() => import("./GenreManagementPage"));
export const AlbumManagementPage = lazy(() => import("./AlbumManagementPage"));
export const PlaylistManagementPage = lazy(
  () => import("./PlaylistManagementPage"),
);
export const AnalyticPage = lazy(() => import("./AnalyticPage"));
export const SettingPage = lazy(() => import("./SettingPage"));
