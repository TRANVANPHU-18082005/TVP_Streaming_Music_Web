import { lazy } from "react";
export const ProfilePage = lazy(() => import("./ProfilePage"));
export const SearchPage = lazy(() => import("./SearchPage"));
export const SettingsPage = lazy(() => import("./SettingsPage"));
export const TopChartPage = lazy(() => import("./TopChartPage.tsx"));

export * from "./album";
export * from "./artist";
export * from "./playlists";
export * from "./home";
