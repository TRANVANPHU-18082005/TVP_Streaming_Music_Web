import { ADMIN_PATHS, CLIENT_PATHS } from "@/config/paths";
import { PlaylistDetailPage, PlaylistsPage } from "@/pages";
import { type RouteObject } from "react-router-dom";

export const playlistRoutes: RouteObject[] = [
  { path: CLIENT_PATHS.PLAYLISTS, element: <PlaylistsPage /> },
  {
    path: CLIENT_PATHS.PLAYLIST_DETAIL(":id"),
    element: <PlaylistDetailPage />,
  },
];
export const playlistAdminRoutes: RouteObject[] = [
  { path: ADMIN_PATHS.PLAYLISTS, element: <PlaylistsPage /> },
];
