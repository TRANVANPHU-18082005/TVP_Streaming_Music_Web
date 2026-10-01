import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import analyticsApi from "@/features/analytics/api/analyticApi";
import { RealtimeStats } from "../types";

export const useRealtimeStats = () => {
  const { socket, isConnected } = useSocket();
  const [data, setData] = useState<RealtimeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const sawDisconnect = useRef(false);

  const fetchInitialData = useCallback(async (isSilent = false) => {
    const id = ++requestId.current;
    try {
      if (!isSilent) setLoading(true);
      const res = await analyticsApi.getRealtimeStats();
      if (id !== requestId.current) return;
      if (res.data) {
        setData(res.data);
        setError(null);
      }
    } catch (err) {
      if (id !== requestId.current) return;
      console.error("[Analytics] API Error:", err);
      setError("Không tải được số liệu thống kê.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInitialData(false);
  }, [fetchInitialData]);

  useEffect(() => {
    if (!isConnected) {
      sawDisconnect.current = true;
      return;
    }
    if (!sawDisconnect.current) return;
    sawDisconnect.current = false;
    void fetchInitialData(true);
  }, [isConnected, fetchInitialData]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.emit("join_admin_dashboard");

    const handleUpdate = (newData: Partial<RealtimeStats>) => {
      setData((prev) => (prev ? { ...prev, ...newData } : (newData as RealtimeStats)));
      setError(null);
    };

    socket.on("admin_analytics_update", handleUpdate);

    return () => {
      socket.emit("leave_admin_dashboard");
      socket.off("admin_analytics_update", handleUpdate);
    };
  }, [socket, isConnected]);

  return {
    data,
    loading,
    error,
    isConnected,
    refresh: () => fetchInitialData(true),
  };
};
