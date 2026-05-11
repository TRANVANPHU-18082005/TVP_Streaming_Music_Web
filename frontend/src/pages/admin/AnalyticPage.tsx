// features/analytics/pages/AnalyticPage.tsx

import React from "react";
import PageHeader from "@/components/ui/PageHeader";
import { DashboardSkeleton } from "@/features/dashboard/components/DashboardSkeleton";
import ActiveUsersCard from "@/features/analytics/components/ActiveUsersCard";
import TrendingTracks from "@/features/analytics/components/TrendingTracks";
import GeographySection from "@/features/analytics/components/GeographySection";
import { useRealtimeStats } from "@/features/analytics/hooks/useRealtimeStats";
import { Activity, Globe, WifiOff } from "lucide-react";

const AnalyticPage = () => {
  const { data: realtimeData, loading, isConnected } = useRealtimeStats();
  console.log("Realtime Data:", realtimeData, "Loading:", loading, "Connected:", isConnected);
  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8 pb-20 font-sans animate-in fade-in duration-500">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Analytics Dashboard"
          subtitle="Platform performance overview & real-time insights."
        />

        {/* Connection status badge */}
        {!isConnected && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs font-semibold">
            <WifiOff size={13} />
            Disconnected — data may be stale
          </div>
        )}
      </div>

      {/* ── Real-time section ── */}
      <section className="space-y-4">
        <SectionHeader
          icon={<Activity className="size-5 text-emerald-500" />}
          title="Real-time Overview"
          live={isConnected}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {/* Active Users — tách authenticated vs guest (NEW) */}
          <div className="lg:col-span-1">
            <ActiveUsersCard
              activeUsers={realtimeData?.activeUsers ?? 0}
              activeGuests={realtimeData?.activeGuests ?? 0}
              listeningNow={realtimeData?.listeningNow ?? 0}
              activeNow={realtimeData?.activeNow ?? 0}
            />
          </div>

          {/* Trending + Now Listening split panel (NEW layout) */}
          <div className="lg:col-span-2">
            <TrendingTracks
              trendingData={realtimeData?.trending ?? []}
              nowListeningData={realtimeData?.nowListening ?? []}
            />
          </div>
        </div>
      </section>

      {/* ── Geography ── */}
      <section className="space-y-4">
        <SectionHeader
          icon={<Globe className="size-5 text-blue-500" />}
          title="Demographics & Geography"
        />
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden p-1">
          <GeographySection data={realtimeData?.geoData ?? []} />
        </div>
      </section>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB: Section header with optional live ping
// ─────────────────────────────────────────────────────────────────────────────

const SectionHeader = ({
  icon,
  title,
  live,
}: {
  icon: React.ReactNode;
  title: string;
  live?: boolean;
}) => (
  <div className="flex items-center gap-2 text-lg font-bold text-foreground/90 pb-2 border-b border-border/50">
    {icon}
    <h2>{title}</h2>
    {live && (
      <span className="relative flex h-2.5 w-2.5 ml-1">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
      </span>
    )}
  </div>
);

export default AnalyticPage;
