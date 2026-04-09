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
    if (!user || !enabled || !idsKey || lastHash.current === idsKey) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await interactionApi.checkBatch(ids, type, targetType);
        if (!cancelled) {
          dispatch(
            syncInteractions({
              interactedIds: response,
              checkedIds: ids,
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
// src/features/interaction/hooks/useSyncInteractionsPaged.ts

// import { useEffect, useRef } from "react";
// import { useAppDispatch, useAppSelector } from "@/store/hooks";
// import interactionApi from "../api/interactionApi";
// import { syncInteractions, InteractionTargetType } from "../slice/interactionSlice";

// export const useSyncInteractionsPaged = (
//   /**
//    * Nhận thẳng pages từ useInfiniteQuery — không flatMap trước.
//    * Mỗi page = 1 batch API call riêng biệt.
//    *
//    * Ví dụ: data.pages từ useAlbumTracksInfinite
//    */
//   pages: Array<{ data: { data: Array<{ _id: string }> } }> | undefined,
//   type: "like" | "follow",
//   targetType: InteractionTargetType,
//   enabled: boolean = true,
// ) => {
//   const dispatch = useAppDispatch();
//   const { user } = useAppSelector((state) => state.auth);

//   // Set chứa các IDs đã được sync — không bao giờ check lại
//   const syncedIds = useRef<Set<string>>(new Set());
//   const timerRef = useRef<ReturnType<typeof setTimeout>>();

//   useEffect(() => {
//     if (!user || !enabled || !pages?.length) return;

//     // Lấy page MỚI NHẤT (pages[pages.length - 1])
//     // Các page cũ đã được sync từ lần effect chạy trước
//     const latestPage = pages[pages.length - 1];
//     const latestIds = latestPage?.data?.data?.map((t) => t._id) ?? [];

//     // Lọc ra IDs thực sự chưa sync
//     const newIds = latestIds.filter((id) => !syncedIds.current.has(id));
//     if (newIds.length === 0) return;

//     // Debounce để tránh gọi liên tục khi React Strict Mode double-invoke
//     clearTimeout(timerRef.current);
//     timerRef.current = setTimeout(async () => {
//       try {
//         const interactedIds = await interactionApi.checkBatch(
//           newIds,
//           type,
//           targetType,
//         );

//         dispatch(
//           syncInteractions({
//             interactedIds,
//             checkedIds: newIds,
//             targetType,
//           }),
//         );

//         // Đánh dấu đã sync — sẽ không check lại dù component re-render
//         newIds.forEach((id) => syncedIds.current.add(id));
//       } catch (err) {
//         console.error("Sync interaction error:", err);
//       }
//     }, 300);

//     return () => clearTimeout(timerRef.current);
//   }, [
//     // Dep là pages.length — chỉ re-run khi có page MỚI được thêm vào
//     // Không dep vào toàn bộ pages object để tránh re-run thừa
//     pages?.length,
//     type,
//     targetType,
//     user,
//     enabled,
//     dispatch,
//   ]);

//   // Reset khi albumId thay đổi (navigate sang album khác)
//   // Caller tự xử lý bằng cách unmount/remount hook qua key prop
// };
// const {
//   data: tracksData,
//   isLoading: isLoadingTracks,
//   isFetchingNextPage,
//   hasNextPage,
//   fetchNextPage,
//   error: tracksError,
//   refetch: refetchTracks,
// } = useAlbumTracksInfinite(album?._id);

// // ✅ Truyền thẳng pages, không flatMap
// // Hook tự xử lý chỉ sync page mới nhất mỗi khi pages.length tăng
// useSyncInteractionsPaged(
//   tracksData?.pages,
//   "like",
//   "track",
//   !!album?._id && !isLoadingTracks,
// );

// // Xóa cái này — không cần nữa:
// // const trackIds = useMemo(...)
// // useSyncInteractions(trackIds, ...)
