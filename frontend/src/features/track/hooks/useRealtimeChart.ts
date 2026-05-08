/**
 * @file useRealtimeChart.ts
 */

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSocket } from "@/hooks/useSocket";
import trackApi from "@/features/track/api/trackApi";
import { ChartTrack } from "@/features/track/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * So sánh nhanh 2 danh sách track theo id + score.
 * Tránh deep-clone toàn bộ object chỉ để kiểm tra bằng nhau.
 */
const isSameTrackList = (a: ChartTrack[], b: ChartTrack[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((t, i) => t._id === b[i]._id && t.score === b[i].score);
};

/** Trích xuất items[] từ mọi dạng response (Array hoặc Object {items, chart}) */
const extractItems = (data: any): ChartTrack[] =>
  Array.isArray(data) ? data : (data?.items ?? []);

const extractChart = (data: any): any[] =>
  Array.isArray(data) ? [] : (data?.chart ?? []);

// ─── Types ───────────────────────────────────────────────────────────────────

export type RankTrend = "up" | "down" | "new" | "same";

export interface RankedTrack extends ChartTrack {
  rank: number;
  trend: RankTrend;
  rankDelta: number; // Dương = tăng hạng, âm = giảm hạng
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export const useRealtimeChart = () => {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();
  const [isUpdating, setIsUpdating] = useState(false);

  // Ref lưu thứ hạng CỦA LẦN RENDER TRƯỚC — không gây re-render
  const prevRankMapRef = useRef<Record<string, number>>({});

  // FIX #2 — Throttle: giữ payload mới nhất, chỉ flush tối đa 1 lần / 3s
  const pendingPayloadRef = useRef<any>(null);
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Initial Fetch ──────────────────────────────────────────────────────────
  const {
    data: apiResponse,
    isLoading,
    refetch,
    error,
    isRefetching,
  } = useQuery({
    queryKey: ["live-chart"],
    queryFn: trackApi.getRealtimeChart,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
  });
  console.log(apiResponse)
  // ── Normalization ──────────────────────────────────────────────────────────
  const rawData = apiResponse?.data;
  // ── FIX #1 — Tính Trend ngay trong useMemo ────────────────────────────────
  // Toàn bộ logic Up/Down/New/Same được tính tại đây, dựa trên snapshot
  // prevRankMapRef.current được chụp TRƯỚC khi tracks thay đổi (xem updateChartCache).
  // Kết quả là một mảng RankedTrack chứa sẵn rank + trend cho Component dùng trực tiếp.
  const rankedTracks = useMemo((): RankedTrack[] => {
    const items = extractItems(rawData);
    if (items.length === 0) return [];

    const isInitial = Object.keys(prevRankMapRef.current).length === 0;

    const result = items.map((track, index) => {
      const currentRank = index + 1;
      const previousRank = prevRankMapRef.current[track._id];

      let trend: RankTrend;
      let rankDelta: number;

      if (isInitial) {
        // Lần đầu tiên load trang -> mặc định 'same' (không hiện huy hiệu NEW cho cả 100 bài)
        trend = "same";
        rankDelta = 0;
      } else if (previousRank === undefined) {
        // Bài xuất hiện lần đầu trong Chart sau một bản cập nhật socket
        trend = "new";
        rankDelta = 0;
      } else {
        rankDelta = previousRank - currentRank; // Dương = lên hạng
        if (rankDelta > 0) trend = "up";
        else if (rankDelta < 0) trend = "down";
        else trend = "same";
      }

      return { ...track, rank: currentRank, trend, rankDelta };
    });

    // Điền sẵn map cho lần cập nhật socket tiếp theo nếu đây là lần đầu
    if (isInitial) {
      items.forEach((t, i) => {
        prevRankMapRef.current[t._id] = i + 1;
      });
    }

    return result;
  }, [rawData]);

  const chartData = useMemo(() => extractChart(rawData), [rawData]);
  // ── FIX #3 — Cache Update với Deep Compare ────────────────────────────────
  const updateChartCache = useCallback(
    (payload: any) => {
      queryClient.setQueryData(["live-chart"], (old: any) => {
        if (!old) return old;

        const oldItems = extractItems(old.data);
        const oldChart = extractChart(old.data);
        const newItems = extractItems(payload);
        const newChart = Array.isArray(payload)
          ? oldChart
          : (payload?.chart ?? oldChart);

        const isItemsSame = isSameTrackList(oldItems, newItems);
        const finalItems = isItemsSame ? oldItems : newItems;

        // Chỉ update snapshot thứ hạng CŨ nếu danh sách có sự thay đổi
        if (!isItemsSame) {
          const snapshot: Record<string, number> = {};
          oldItems.forEach((t, i) => {
            snapshot[t._id] = i + 1;
          });
          prevRankMapRef.current = snapshot;
        }

        return {
          ...old,
          data: {
            ...(old.data || {}),
            items: finalItems,
            chart: newChart,
            lastUpdatedAt: payload?.lastUpdatedAt ?? old.data?.lastUpdatedAt
          },
        };
      });
    },
    [queryClient],
  );

  // ── FIX #2 — Flush throttled payload ──────────────────────────────────────
  const flushPendingUpdate = useCallback(() => {
    if (pendingPayloadRef.current === null) return;

    const payload = pendingPayloadRef.current;
    pendingPayloadRef.current = null;
    throttleTimerRef.current = null;

    // Bật indicator
    setIsUpdating(true);
    if (isUpdatingTimerRef.current) clearTimeout(isUpdatingTimerRef.current);
    isUpdatingTimerRef.current = setTimeout(() => setIsUpdating(false), 800);

    updateChartCache(payload);
  }, [updateChartCache]);

  // ── Socket Management ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.emit("join_chart_page");

    const handleUpdate = (payload: any) => {
      // Luôn giữ payload mới nhất
      pendingPayloadRef.current = payload;

      // Chỉ đặt timer nếu chưa có — đảm bảo tối đa 1 update / 3s
      if (throttleTimerRef.current === null) {
        throttleTimerRef.current = setTimeout(flushPendingUpdate, 3000);
      }
    };

    socket.on("chart_update", handleUpdate);

    return () => {
      socket.emit("leave_chart_page");
      socket.off("chart_update", handleUpdate);
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
      if (isUpdatingTimerRef.current) clearTimeout(isUpdatingTimerRef.current);
    };
  }, [socket, isConnected, flushPendingUpdate]);

  // ── Re-sync khi reconnect — silent invalidation (không flash loading) ────
  useEffect(() => {
    if (isConnected) {
      queryClient.invalidateQueries({ queryKey: ["live-chart"] });
    }
  }, [isConnected, queryClient]);

  return {
    tracks: rankedTracks, // Đã có rank + trend + rankDelta, dùng trực tiếp
    chartData,
    isLoading,
    error,
    refetch,
    isRefetching,
    isUpdating,
    isConnected,
    lastUpdatedAt: apiResponse?.data.lastUpdatedAt ?? null,
  };
};
