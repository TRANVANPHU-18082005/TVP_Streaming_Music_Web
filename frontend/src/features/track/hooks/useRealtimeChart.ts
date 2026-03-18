/**
 * @file useRealtimeChart.ts
 * @description Hook quản lý bảng xếp hạng thời gian thực đạt chuẩn Production.
 * Kết hợp dữ liệu từ React Query và Socket.io với cơ chế chống giật và tính toán thứ hạng.
 */

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSocket } from "@/hooks/useSocket";
import trackApi from "@/features/track/api/trackApi";
import { ChartTrack } from "@/features/track/types";

export const useRealtimeChart = () => {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();
  const [isUpdating, setIsUpdating] = useState(false);

  // 1. Ref Quản lý trạng thái không gây re-render
  const prevRankMapRef = useRef<Record<string, number>>({});
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 2. Initial Fetch: Lấy dữ liệu nền tảng
  const {
    data: apiResponse,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["live-chart"],
    queryFn: trackApi.getRealtimeChart,
    staleTime: Infinity, // Không tự động gọi lại API, ưu tiên Socket
    gcTime: 1000 * 60 * 60, // Giữ trong cache 1 tiếng
  });

  // 3. Normalization: Luôn trả về cấu trúc dữ liệu chuẩn dù API trả về gì
  const { tracks, chartData } = useMemo(() => {
    const rawData = apiResponse?.data;
    if (!rawData) return { tracks: [], chartData: [] };

    // Hỗ trợ cả Format cũ (Array) và Format mới (Object {items, chart})
    const items = Array.isArray(rawData) ? rawData : rawData?.items || [];
    const chart = Array.isArray(rawData) ? [] : rawData?.chart || [];

    return { tracks: items as ChartTrack[], chartData: chart };
  }, [apiResponse]);

  /**
   * 4. Logic cập nhật Cache thông minh
   * Tách riêng để code sạch và dễ bảo trì
   */
  const updateChartCache = useCallback(
    (payload: any) => {
      queryClient.setQueryData(["live-chart"], (old: any) => {
        if (!old) return old;

        const oldData = old.data;
        const oldItems = Array.isArray(oldData)
          ? oldData
          : oldData?.items || [];
        const oldChart = Array.isArray(oldData) ? [] : oldData?.chart || [];

        // Tính toán thứ hạng cũ trước khi ghi đè data mới (phục vụ animation)
        const newPrevMap: Record<string, number> = {};
        oldItems.forEach((t: ChartTrack, i: number) => {
          newPrevMap[t._id] = i + 1;
        });
        prevRankMapRef.current = newPrevMap;

        // Merge dữ liệu: Ưu tiên payload, fallback về dữ liệu cũ nếu payload thiếu hụt
        let nextItems = [];
        let nextChart = [];

        if (Array.isArray(payload)) {
          nextItems = payload;
          nextChart = oldChart;
        } else {
          nextItems = payload.items || oldItems;
          nextChart =
            payload.chart && payload.chart.length > 0
              ? payload.chart
              : oldChart;
        }

        return {
          ...old,
          data: {
            items: nextItems,
            chart: nextChart,
          },
        };
      });
    },
    [queryClient],
  );

  // 5. Quản lý kết nối Socket
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Join room chuyên biệt cho Chart
    socket.emit("join_chart_page");

    const handleUpdate = (payload: any) => {
      // Hiệu ứng "Updating" nhấp nháy nhẹ trên UI
      setIsUpdating(true);
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = setTimeout(() => setIsUpdating(false), 800);

      // Cập nhật dữ liệu vào React Query Cache
      updateChartCache(payload);
    };

    socket.on("chart_update", handleUpdate);

    // Cleanup khi component unmount
    return () => {
      socket.emit("leave_chart_page");
      socket.off("chart_update", handleUpdate);
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    };
  }, [socket, isConnected, updateChartCache]);

  // 6. Cơ chế Re-sync: Nếu mất mạng rồi có lại, fetch lại API để đảm bảo data mới nhất
  useEffect(() => {
    if (isConnected) {
      refetch();
    }
  }, [isConnected, refetch]);

  return {
    tracks,
    chartData,
    prevRankMap: prevRankMapRef.current, // Dùng để tính toán Up/Down/Stay trong Component
    isLoading,
    isUpdating,
    isConnected,
  };
};
