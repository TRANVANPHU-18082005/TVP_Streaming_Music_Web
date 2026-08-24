// src/features/interaction/hooks/useSyncInteractionsPaged.ts
import { useEffect, useRef, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import interactionApi from "../api/interactionApi";
import {
  syncInteractions,
} from "../slice/interactionSlice";
import type { InteractionTargetType } from "../slice/interactionSlice";
import { env } from "@/config/env";
import type { ITrack } from "@/features/track";

export const useSyncInteractionsPaged = (
  allTracks: ITrack[] | undefined,
  type: "like" | "follow",
  targetType: InteractionTargetType,
  enabled: boolean = true,
) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const syncedIds = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Lấy map từ Redux Store
  const interactionMap = useAppSelector((state) => {
    const maps = {
      track: state.interaction.likedTracks,
      album: state.interaction.likedAlbums,
      playlist: state.interaction.likedPlaylists,
      artist: state.interaction.followedArtists,
    } as const;
    return maps[targetType];
  });

  // 🚀 TỐI ƯU 1: Tự động dọn dẹp bộ nhớ đệm ẩn khi Phú đổi tài khoản hoặc đổi Tab nội dung
  useEffect(() => {
    syncedIds.current.clear();
  }, [user?._id, targetType]);

  // 🚀 TỐI ƯU 2: Biến mảng tracks thành chuỗi string có tính tham chiếu ổn định
  const trackIdsKey = useMemo(() => {
    if (!allTracks?.length) return "";
    return allTracks.map((t) => t._id).join(",");
  }, [allTracks]);

  useEffect(() => {
    if (!user || !enabled || !trackIdsKey) return;

    // 🚀 TỐI ƯU 3: Bóc tách và lọc chính xác những ID thực sự chưa biết (bằng undefined) ngay trong effect
    const trackIds = trackIdsKey.split(",");
    const unknownIds = trackIds.filter(
      (id) => !syncedIds.current.has(id) && interactionMap[id] === undefined,
    );

    // Nếu không có bài mới nào cần check thì dừng lại ngay tại đây
    if (unknownIds.length === 0) return;

    // Cờ bảo vệ chống Race Condition khi unmount hoặc re-run
    let isCancelled = false;

    clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        if (env.NODE_ENV === "development") {
          console.log(
            `[SyncPaged] Requesting API for ${unknownIds.length} new IDs`,
          );
        }

        const interactedIds = await interactionApi.checkBatch(
          unknownIds,
          type,
          targetType,
        );

        // Chỉ cập nhật vào Redux nếu luồng này còn hiệu lực
        if (!isCancelled) {
          dispatch(
            syncInteractions({
              interactedIds,
              checkedIds: unknownIds,
              targetType,
            }),
          );

          // Đóng dấu xác nhận đã quét qua vĩnh viễn cho đợt ID này
          unknownIds.forEach((id) => syncedIds.current.add(id));
        }
      } catch (err) {
        console.error("[SyncPaged] API error:", err);
      }
    // Tăng debounce 600ms: nếu nhiều page loads liên tiếp (infinite scroll),
    // chỉ gửi 1 API call sau khi tất cả đã ổn định
    }, 600);

    return () => {
      isCancelled = true;
      clearTimeout(timerRef.current);
    };
    // Cách biệt hoàn toàn khỏi sự re-render của interactionMap tổng
  }, [trackIdsKey, type, targetType, user, enabled, dispatch]);
};
