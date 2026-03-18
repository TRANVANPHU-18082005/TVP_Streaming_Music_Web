import { useEffect, useState, useCallback } from "react";
import { RealtimeStats } from "../types";
import { useSocket } from "@/hooks/useSocket";
import analyticsApi from "@/features/analytics/api/analyticApi";

/**
 * Hook lấy dữ liệu thống kê tổng thể cho Dashboard.
 * Kết hợp: API (Dữ liệu nền) + Socket (Dữ liệu nhảy số).
 */
export const useRealtimeStats = () => {
  const { socket, isConnected } = useSocket();
  const [data, setData] = useState<RealtimeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Hàm lấy dữ liệu khởi tạo qua API REST
  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await analyticsApi.getRealtimeStats();
      if (res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error("❌ Analytics API Error:", err);
      setError("Không thể tải dữ liệu thống kê ban đầu.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Thực thi fetch lần đầu
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // 2. Quản lý luồng dữ liệu Live qua Socket
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Báo danh vào room Admin để server bắt đầu đẩy data
    socket.emit("join_admin_dashboard");

    const handleUpdate = (newData: Partial<RealtimeStats>) => {
      setData((prev) => {
        if (!prev) return newData as RealtimeStats;
        // Merge thông minh: Giữ lại data cũ, ghi đè phần mới từ socket
        return { ...prev, ...newData };
      });
    };

    socket.on("admin_analytics_update", handleUpdate);

    return () => {
      socket.emit("leave_admin_dashboard"); // (Optional) Nếu bạn có room leave logic
      socket.off("admin_analytics_update", handleUpdate);
    };
  }, [socket, isConnected]);

  return {
    data,
    loading,
    error,
    refresh: fetchInitialData, // Cho phép Admin bấm nút "Refresh" thủ công nếu muốn
  };
};
