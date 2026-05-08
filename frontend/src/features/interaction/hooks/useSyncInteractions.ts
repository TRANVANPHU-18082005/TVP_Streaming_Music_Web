// src/features/interaction/hooks/useSyncInteractions.ts
import { useEffect, useMemo, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import interactionApi from "../api/interactionApi";
import {
  syncInteractions,
  InteractionTargetType,
} from "../slice/interactionSlice";
import { env } from "@/config/env";

export const useSyncInteractions = (
  ids: string[],
  type: "like" | "follow",
  targetType: InteractionTargetType,
  enabled: boolean = true,
) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const lastHash = useRef("");

  // Quick lookup of known interaction statuses from Redux store
  const interactionMap = useAppSelector((state) => {
    const maps = {
      track: state.interaction.likedTracks,
      album: state.interaction.likedAlbums,
      playlist: state.interaction.likedPlaylists,
      artist: state.interaction.followedArtists,
    } as const;
    return maps[targetType];
  });

  // Serialize ids thành string ổn định — tránh sort() mỗi effect run
  const idsKey = useMemo(() => [...ids].sort().join(","), [ids]);

  useEffect(() => {
    // ✅ Log chỉ khi effect thực sự chạy, không phải mỗi render
    if (env.NODE_ENV === "development") {
      console.log("[useSyncInteractions] effect:", {
        idsKey,
        enabled,
        hasUser: !!user,
      });
    }

    // Guard sớm: không tốn timer nếu không cần
    // Skip IDs that we already know from Redux store to avoid redundant requests
    const unknownIds = ids.filter((id) => !interactionMap[id]);
    if (
      !user ||
      !enabled ||
      !idsKey ||
      lastHash.current === idsKey ||
      unknownIds.length === 0
    )
      return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await interactionApi.checkBatch(
          unknownIds,
          type,
          targetType,
        );
        if (!cancelled) {
          dispatch(
            syncInteractions({
              interactedIds: response,
              checkedIds: unknownIds,
              targetType,
            }),
          );
          lastHash.current = idsKey; // ✅ dùng idsKey thay vì tính lại
        }
      } catch (err) {
        console.error("[useSyncInteractions] error:", err);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [idsKey, type, targetType, user, enabled, dispatch]);
  // ✅ ids (array) bị loại khỏi deps — thay bằng idsKey (string ổn định)
};
