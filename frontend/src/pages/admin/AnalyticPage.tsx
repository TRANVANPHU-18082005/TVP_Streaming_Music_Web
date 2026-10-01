import PageHeader from "@/components/ui/PageHeader";
import ActiveUsersCard from "@/features/analytics/components/ActiveUsersCard";
import AnalyticsSkeleton from "@/features/analytics/components/AnalyticsSkeleton";
import GeographySection from "@/features/analytics/components/GeographySection";
import TrendingTracks from "@/features/analytics/components/TrendingTracks";
import { LiveBadge } from "@/features/analytics/components/AnalyticsShared";
import { useRealtimeStats } from "@/features/analytics/hooks/useRealtimeStats";
import { WifiOff } from "lucide-react";

function formatSnapshot(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

const AnalyticPage = () => {
  const { data, loading, error, isConnected } = useRealtimeStats();
  const snapshot = formatSnapshot(data?.snapshotAt);

  if (loading && !data) return <AnalyticsSkeleton />;

  return (
    <div className="space-y-8 pb-20 font-sans">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Phân tích trực tiếp"
          subtitle="Người dùng, bài đang phát và lượt nghe theo giờ Việt Nam."
        />
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {isConnected ? <LiveBadge /> : (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive">
              <WifiOff size={13} />
              Mất kết nối — số liệu có thể đã cũ
            </div>
          )}
          {snapshot && (
            <p className="text-xs text-muted-foreground">Cập nhật {snapshot}</p>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <ActiveUsersCard
        activeUsers={data?.activeUsers ?? 0}
        activeGuests={data?.activeGuests ?? 0}
        listeningNow={data?.listeningNow ?? 0}
        playsThisHour={data?.playsThisHour ?? 0}
      />

      <TrendingTracks
        trendingData={data?.trending ?? []}
        nowListeningData={data?.nowListening ?? []}
      />

      <section className="space-y-4">
        <h2 className="border-b border-border/50 pb-2 text-lg font-bold text-foreground/90">
          Khu vực đang nghe
        </h2>
        <div className="overflow-hidden rounded-xl border border-border bg-card p-1">
          <GeographySection data={data?.geoData ?? []} />
        </div>
      </section>
    </div>
  );
};

export default AnalyticPage;
