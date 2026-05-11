import { createBrowserRouter } from "react-router-dom";
import { albumRoutes } from "@/features/album/routes";
import { artistRoutes } from "@/features/artist/routes";
import { playlistRoutes } from "@/features/playlist/routes";

import { AdminLayout, ClientLayout, RootLayout } from "@/layouts";

import ProtectedRoute from "@/app/routes/ProtectedRoute";
import {
  AlbumManagementPage,
  AnalyticPage,
  ArtistManagementPage,
  DashboardPage,
  GenreManagementPage,
  HomePage,
  MoodVideoManagementPage,
  NotFoundPage,
  PlaylistManagementPage,
  ProfilePage,
  SearchPage,
  SettingPage,
  SettingsPage,
  TopChartPage,
  TrackDetailPage,
  TrackManagementPage,
  UsersManagementPage,
} from "@/pages";
import { GuestRoute } from "@/app/routes/GuestRoute";
import { guestAuthRoutes, protectedAuthRoutes } from "@/features/auth/routes";
import { ADMIN_PATHS, CLIENT_PATHS } from "@/config/paths";
import {
  becomeArtistRoutes,
  verifyArtistAdminRoutes,
} from "@/features/verification/routes";
import { GenreClientRoutes } from "@/features/genre/routes";
import { trackRoutes } from "@/features/track/routes";

export const router = createBrowserRouter([
  {
    // 🔥 QUAN TRỌNG: RootLayout bao trùm toàn bộ ứng dụng
    // Nó không có path (pathless route), nhiệm vụ chỉ là chạy logic Init Auth
    element: <RootLayout />,
    children: [
      // ===================================================
      // 1. NHÓM AUTH (Login/Register)
      // ===================================================
      {
        element: <GuestRoute />, // <--- Bọc ở đây
        children: [
          ...guestAuthRoutes, // Login, Register
        ],
      },
      // ===================================================
      // 2. NHÓM CLIENT (USER APP)
      // ===================================================
      {
        path: CLIENT_PATHS.CLIENT,
        element: <ClientLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: CLIENT_PATHS.SEARCH, element: <SearchPage /> },
          { path: CLIENT_PATHS.CHART_TOP, element: <TopChartPage /> },

          // Bung các route feature
          ...GenreClientRoutes,
          ...playlistRoutes,
          ...artistRoutes,
          ...albumRoutes,
          ...becomeArtistRoutes,
          {
            path: CLIENT_PATHS.TRACK_DETAIL(":id"),
            element: <TrackDetailPage />,
          },
          // Protected Routes
          {
            element: <ProtectedRoute />,
            children: [
              { path: CLIENT_PATHS.PROFILE, element: <ProfilePage /> },
              // {
              //   path: CLIENT_PATHS.CLAIM_PROFILE,
              //   element: <ClaimProfilePage />,
              // },
              ...trackRoutes,

              { path: CLIENT_PATHS.SETTINGS, element: <SettingsPage /> },
              ...protectedAuthRoutes,
            ],
          },
        ],
      },

      // ===================================================
      // 3. NHÓM ADMIN PORTAL
      // ===================================================
      {
        path: ADMIN_PATHS.ADMIN,
        element: <ProtectedRoute />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              { index: true, element: <DashboardPage /> },
              {
                path: ADMIN_PATHS.USERS,
                element: <UsersManagementPage />,
              },
              {
                path: ADMIN_PATHS.SONGS,
                element: <TrackManagementPage />,
              },
              {
                path: ADMIN_PATHS.ARTISTS,
                element: <ArtistManagementPage />,
              },
              {
                path: ADMIN_PATHS.ALBUMS,
                element: <AlbumManagementPage />,
              },
              {
                path: ADMIN_PATHS.ANALYTICS,
                element: <AnalyticPage />,
              },
              {
                path: ADMIN_PATHS.GENRES,
                element: <GenreManagementPage />,
              },
              {
                path: ADMIN_PATHS.VIDEO_MOOD,
                element: <MoodVideoManagementPage />,
              },
              {
                path: ADMIN_PATHS.SETTINGS,
                element: <SettingPage />,
              },
              {
                path: ADMIN_PATHS.PLAYLISTS,
                element: <PlaylistManagementPage />,
              },
              ...verifyArtistAdminRoutes,
            ],
          },
        ],
      },

      // ===================================================
      // 4. 404 NOT FOUND
      // ===================================================
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
