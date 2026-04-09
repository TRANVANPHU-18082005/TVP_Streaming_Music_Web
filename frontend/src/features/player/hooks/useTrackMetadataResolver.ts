import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  upsertMetadataCache,
  setLoadingState,
} from "@/features/player/slice/playerSlice";
import trackApi from "@/features/track/api/trackApi";

export function useTrackMetadataResolver() {
  const dispatch = useAppDispatch();
  const currentTrackId = useAppSelector((s) => s.player.currentTrackId);
  const nextTrackId = useAppSelector((s) => s.player.nextTrackIdPreloaded);
  const loadingState = useAppSelector((s) => s.player.loadingState);

  // Ref để đọc cache mà không đưa vào deps → tránh infinite loop
  const cache = useAppSelector((s) => s.player.trackMetadataCache);
  const cacheRef = useRef(cache);
  cacheRef.current = cache;

  // Ref để track đang fetch → tránh duplicate request cùng 1 ID
  const fetchingRef = useRef<Set<string>>(new Set());

  // ── Fetch bài hiện tại khi cache miss ──────────────────────────────────
  useEffect(() => {
    if (!currentTrackId) return;
    if (loadingState !== "loading") return;
    if (cacheRef.current[currentTrackId]) return;
    if (fetchingRef.current.has(currentTrackId)) return; // đang fetch rồi, bỏ qua

    fetchingRef.current.add(currentTrackId);
    let cancelled = false;

    trackApi
      .getTrackDetail(currentTrackId)
      .then((track) => {
        if (!cancelled) dispatch(upsertMetadataCache([track]));
      })
      .catch(() => {
        if (!cancelled) dispatch(setLoadingState("idle"));
      })
      .finally(() => {
        fetchingRef.current.delete(currentTrackId);
      });

    return () => {
      cancelled = true;
      // Không xóa khỏi fetchingRef ở đây —
      // request vẫn bay, chỉ cancel việc dispatch kết quả vào Redux
    };
  }, [currentTrackId, loadingState, dispatch]);

  // ── Preload bài kế tiếp (silent, không ảnh hưởng loadingState) ─────────
  useEffect(() => {
    if (!nextTrackId) return;
    if (cacheRef.current[nextTrackId]) return;
    if (fetchingRef.current.has(nextTrackId)) return;

    fetchingRef.current.add(nextTrackId);

    trackApi
      .getTrackDetail(nextTrackId)
      .then((track) => dispatch(upsertMetadataCache([track])))
      .catch(() => {
        /* silent — preload thất bại không cần xử lý */
      })
      .finally(() => {
        fetchingRef.current.delete(nextTrackId);
      });

    // Không cần cleanup — preload không ảnh hưởng UI
  }, [nextTrackId, dispatch]);
}
