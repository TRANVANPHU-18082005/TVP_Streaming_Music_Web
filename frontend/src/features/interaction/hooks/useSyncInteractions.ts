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

  // Lấy chính xác bản đồ tương tác từ Redux
  const interactionMap = useAppSelector((state) => {
    const maps = {
      track: state.interaction.likedTracks,
      album: state.interaction.likedAlbums,
      playlist: state.interaction.likedPlaylists,
      artist: state.interaction.followedArtists,
    } as const;
    return maps[targetType];
  });

  // 1. Ổn định hóa mảng ID đầu vào
  const idsKey = useMemo(() => [...ids].sort().join(","), [ids]);

  // 2. Tạo mã Hash bảo vệ tuyệt đối (Chống trùng lặp giữa các Tab/Tài khoản)
  const currentRequestHash = useMemo(() => {
    const userId = user?._id || "guest";
    return `${userId}:${targetType}:${idsKey}`;
  }, [user?._id, targetType, idsKey]);

  useEffect(() => {
    if (env.NODE_ENV === "development") {
      console.log("[useSyncInteractions] effect execution:", {
        idsKey,
        enabled,
        hasUser: !!user,
      });
    }

    // 3. SỬA LỖI CHÍ MẠNG: Chỉ lọc những ID thực sự chưa từng check (bằng undefined)
    const unknownIds = ids.filter((id) => interactionMap[id] === undefined);

    // Guard Clause bảo vệ tối đa hiệu năng
    if (
      !user ||
      !enabled ||
      !idsKey ||
      lastHash.current === currentRequestHash ||
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
              interactedIds: response, // Mảng các ID đã LIKE
              checkedIds: unknownIds, // Toàn bộ mảng ID mang đi CHECK
              targetType,
            }),
          );
          // Ghi lại lịch sử request thành công bằng mã Hash tổng hợp
          lastHash.current = currentRequestHash;
        }
      } catch (err) {
        console.error("[useSyncInteractions] API error:", err);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    currentRequestHash,
    idsKey,
    type,
    targetType,
    user,
    enabled,
    interactionMap,
    dispatch,
  ]);
};
