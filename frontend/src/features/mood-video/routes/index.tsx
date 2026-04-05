import { CLIENT_PATHS } from "@/config/paths";
import { AlbumDetailPage, AlbumsPage } from "@/pages";
import { type RouteObject } from "react-router-dom";

export const albumRoutes: RouteObject[] = [
  { path: "albums", element: <AlbumsPage /> },
  {
    path: CLIENT_PATHS.ALBUM_DETAIL(":slug"),
    element: <AlbumDetailPage />,
  },
];
