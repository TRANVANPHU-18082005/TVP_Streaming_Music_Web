// src/features/interaction/hooks/useSyncInteractions.ts
import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import interactionApi from "../api/interactionApi";
import {
  syncInteractions,
  InteractionTargetType,
} from "../slice/interactionSlice";

export const useSyncInteractions = (
  ids: string[],
  type: "like" | "follow",
  targetType: InteractionTargetType,
  enabled: boolean = true,
) => {
  console.log("useSyncInteractions called with:", {
    ids,
    type,
    targetType,
    enabled,
  });
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const lastHash = useRef("");

  useEffect(() => {
    const currentHash = [...ids].sort().join(",");
    if (
      !user ||
      !enabled ||
      ids.length === 0 ||
      lastHash.current === currentHash
    )
      return;

    let isMounted = true;
    const timer = setTimeout(async () => {
      // ⏱️ Debounce API call 300ms
      try {
        const response = await interactionApi.checkBatch(ids, type, targetType);
        if (isMounted) {
          dispatch(
            syncInteractions({
              interactedIds: response,
              checkedIds: ids,
              targetType,
            }),
          );
          lastHash.current = currentHash;
        }
      } catch (err) {
        console.error("Sync interaction error:", err);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [ids, type, targetType, user, enabled, dispatch]);
};
