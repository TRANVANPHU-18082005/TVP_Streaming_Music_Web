// src/features/interaction/hooks/useSyncInteractionsPaged.ts
import { useEffect, useRef, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import interactionApi from "../api/interactionApi";
import {
  syncInteractions,
  InteractionTargetType,
} from "../slice/interactionSlice";
import { env } from "@/config/env";
import { ITrack } from "@/features/track";

/**
 * Sync tăng dần: mỗi lần allTracks.length tăng (page mới load),
 * chỉ sync batch IDs chưa từng được check.
 *
 * Không cần pages[] raw — hoạt động với select-transformed data.
 */
export const useSyncInteractionsPaged = (
  allTracks: ITrack[] | undefined,
  type: "like" | "follow",
  targetType: InteractionTargetType,
  enabled: boolean = true,
) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  // Set chứa IDs đã sync — persist across re-renders, reset khi unmount
  const syncedIds = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Chỉ lấy IDs chưa sync — tránh tính lại không cần thiết
  // Also skip IDs we already have in Redux to avoid redundant server checks
  const interactionMap = useAppSelector((state) => {
    const maps = {
      track: state.interaction.likedTracks,
      album: state.interaction.likedAlbums,
      playlist: state.interaction.likedPlaylists,
      artist: state.interaction.followedArtists,
    } as const;
    return maps[targetType];
  });

  const newIds = useMemo(() => {
    if (!allTracks?.length) return [];
    return allTracks
      .map((t) => t._id)
      .filter((id) => !syncedIds.current.has(id) && !interactionMap[id]);
  }, [allTracks, interactionMap]); // allTracks ref thay đổi khi page mới append vào

  useEffect(() => {
    if (!user || !enabled || newIds.length === 0) return;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        if (env.NODE_ENV === "development") {
          console.log(`[SyncPaged] Syncing ${newIds.length} new IDs`);
        }

        const interactedIds = await interactionApi.checkBatch(
          newIds,
          type,
          targetType,
        );

        dispatch(
          syncInteractions({
            interactedIds,
            checkedIds: newIds,
            targetType,
          }),
        );

        // Đánh dấu đã sync — sẽ không check lại dù re-render
        newIds.forEach((id) => syncedIds.current.add(id));
      } catch (err) {
        console.error("[SyncPaged] error:", err);
      }
    }, 300);

    return () => clearTimeout(timerRef.current);
  }, [newIds, type, targetType, user, enabled, dispatch]);
  // newIds thay đổi khi có track mới chưa sync → effect chạy đúng lúc
};
