import React, { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";

// Hooks & Types
import { useDashboardAnalytics } from "@/features/dashboard/hooks/useDashboard";
import { DashboardSkeleton } from "@/features/dashboard/components/DashboardSkeleton";

// Clean Components
import ActiveUsersCard from "@/features/analytics/components/ActiveUsersCard";
import TrendingTracks from "@/features/analytics/components/TrendingTracks";
import GeographySection from "@/features/analytics/components/GeographySection";
import { useRealtimeStats } from "@/features/analytics/hooks/useRealtimeStats";
import { DashboardRange } from "@/features/dashboard/schemas/dashboard.schema";
import { Activity, Globe } from "lucide-react";

const AnalyticPage = () => {
  const [timeRange, setTimeRange] = useState<DashboardRange>("7d");

  // Data Fetching
  const { data: historyData, isLoading: historyLoading } =
    useDashboardAnalytics(timeRange);
  const { data: realtimeData } = useRealtimeStats();
  console.log("AnalyticPage render", { historyData, realtimeData });
  if (historyLoading) return <DashboardSkeleton />;
  if (!historyData) return null;

  // Component Filter (Tách ra để tái sử dụng và gọn code)

  return (
    <div className="space-y-8 pb-20 font-sans animate-in fade-in duration-500">
      {/* 1. Header & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Analytics Dashboard"
          subtitle="Platform performance overview & real-time insights."
        />
      </div>

      {/* 2. Real-time Section (Live Data) */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-bold text-foreground/90 pb-2 border-b border-border/50">
          <Activity className="size-5 text-emerald-500" />
          <h2>Real-time Overview</h2>
          <span className="relative flex h-2.5 w-2.5 ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột 1: Active Users (Nhỏ hơn) */}
          <div className="lg:col-span-1 h-full">
            <ActiveUsersCard activeUsers={realtimeData?.activeUsers || 0} />
          </div>

          {/* Cột 2 & 3: Trending Tracks (Chiếm nhiều chỗ hơn để hiển thị list) */}
          <div className="lg:col-span-2 h-full">
            <TrendingTracks trendingData={realtimeData?.trending || []} />
          </div>
        </div>
      </section>

      {/* 3. Geography Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-bold text-foreground/90 pb-2 border-b border-border/50">
          <Globe className="size-5 text-blue-500" />
          <h2>Demographics & Geography</h2>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden p-1">
          <GeographySection data={realtimeData?.geoData || []} />
        </div>
      </section>
    </div>
  );
};

export default AnalyticPage;
