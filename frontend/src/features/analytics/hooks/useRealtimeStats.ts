// features/analytics/hooks/useRealtimeStats.ts

import { useEffect, useState, useCallback, useRef } from "react";
import { RealtimeStats } from "../types";
import { useSocket } from "@/hooks/useSocket";
import analyticsApi from "@/features/analytics/api/analyticApi";
import { toast } from "sonner";

export const useRealtimeStats = () => {
  const { socket, isConnected } = useSocket();
  const [data, setData] = useState<RealtimeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dataRef = useRef<RealtimeStats | null>(null);
  const heartbeatTimer = useRef<NodeJS.Timeout | null>(null);

  // ── Initial fetch ───────────────────────────────────────────────────────────

  const fetchInitialData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await analyticsApi.getRealtimeStats();
      if (res.data) {
        setData(res.data);
        dataRef.current = res.data;
      }
    } catch (err) {
      console.error("[Analytics] API Error:", err);
      setError("Failed to synchronize dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Re-sync khi reconnect ────────────────────────────────────────────────────

  useEffect(() => {
    if (isConnected) {
      fetchInitialData(true);
    }
  }, [isConnected, fetchInitialData]);

  // ── Socket events + Admin heartbeat ─────────────────────────────────────────

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.emit("join_admin_dashboard");

    // ── Socket handlers ──────────────────────────────────────────────────────

    const handleUpdate = (newData: Partial<RealtimeStats>) => {
      setData((prev) => {
        const merged = prev
          ? { ...prev, ...newData }
          : (newData as RealtimeStats);
        dataRef.current = merged;
        return merged;
      });
    };

    const handleError = (err: { message?: string }) => {
      toast.error(
        "Real-time stream interrupted: " + (err?.message ?? "Unknown error"),
      );
    };

    socket.on("admin_analytics_update", handleUpdate);
    socket.on("socket_error", handleError);

    return () => {
      socket.emit("leave_admin_dashboard");
      socket.off("admin_analytics_update", handleUpdate);
      socket.off("socket_error", handleError);

      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current);
        heartbeatTimer.current = null;
      }
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
