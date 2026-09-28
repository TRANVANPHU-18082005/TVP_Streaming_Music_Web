// src/features/karaoke/utils/karaokeKeys.ts

import { KaraokeFilterParams, KaraokePermissionFilterParams } from "../types";

export const karaokeKeys = {
  all: ["karaoke"] as const,

  // User recordings
  myRecordingsLists: () => [...karaokeKeys.all, "myRecordings"] as const,
  myRecordings: (filter: KaraokeFilterParams) =>
    [...karaokeKeys.myRecordingsLists(), { filter }] as const,

  // Public recordings
  publicRecordingsLists: () => [...karaokeKeys.all, "publicRecordings"] as const,
  publicRecordings: (filter: KaraokeFilterParams) =>
    [...karaokeKeys.publicRecordingsLists(), { filter }] as const,

  // Details
  details: () => [...karaokeKeys.all, "detail"] as const,
  detail: (id: string) => [...karaokeKeys.details(), id] as const,

  // Permissions
  myPermission: () => [...karaokeKeys.all, "myPermission"] as const,

  // Admin
  adminRecordingsLists: () => [...karaokeKeys.all, "adminRecordings"] as const,
  adminRecordings: (filter: KaraokeFilterParams) =>
    [...karaokeKeys.adminRecordingsLists(), { filter }] as const,

  adminPermissionsLists: () => [...karaokeKeys.all, "adminPermissions"] as const,
  adminPermissions: (filter: KaraokePermissionFilterParams) =>
    [...karaokeKeys.adminPermissionsLists(), { filter }] as const,
    
  adminStats: () => [...karaokeKeys.all, "adminStats"] as const,
};
