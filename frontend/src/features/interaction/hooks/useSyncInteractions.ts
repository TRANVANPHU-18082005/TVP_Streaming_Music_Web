// src/features/interaction/hooks/useSyncInteractions.ts
import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import interactionApi from "../api/interactionApi";
import { syncLikes, syncFollows } from "../slice/interactionSlice";

type InteractionType = "like" | "follow";

/**
 * @param ids Mảng các ID cần kiểm tra trạng thái
 * @param type Loại tương tác 'like' hoặc 'follow'
 * @param enabled: Chỉ cho phép chạy khi điều kiện này là true (ví dụ: !isLoading)
 */
export const useSyncInteractions = (
  ids: string[],
  type: InteractionType,
  enabled: boolean = true, // 🚀 THÊM THAM SỐ NÀY
) => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const lastCheckedHash = useRef<string>("");

  useEffect(() => {
    const currentHash = [...ids].sort().join(",");

    // 🚀 SỬA ĐIỀU KIỆN Ở ĐÂY: Thêm !enabled
    if (
      !user ||
      !enabled ||
      ids.length === 0 ||
      lastCheckedHash.current === currentHash
    )
      return;

    const fetchStatus = async () => {
      try {
        const interactedIds = await interactionApi.checkBatch(ids, type);
        if (type === "like") {
          dispatch(syncLikes(interactedIds));
        } else {
          dispatch(syncFollows(interactedIds));
        }
        lastCheckedHash.current = currentHash;
      } catch (error) {
        console.error("Sync failed", error);
      }
    };

    fetchStatus();
  }, [ids, type, user, dispatch, enabled]); // 🚀 Thêm enabled vào dependency
};
