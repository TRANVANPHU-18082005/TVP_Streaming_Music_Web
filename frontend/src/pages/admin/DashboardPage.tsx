import { useState } from "react";
import { AlertCircle, Clock, RefreshCcw } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardSkeleton } from "@/features/dashboard/components/DashboardSkeleton";
import { GrowthCharts } from "@/features/dashboard/components/GrowthCharts";
import { OverviewKpis } from "@/features/dashboard/components/OverviewKpis";
import { SystemStatusStrip } from "@/features/dashboard/components/SystemStatusStrip";
import { TopRankLists } from "@/features/dashboard/components/TopRankLists";
import { useDashboardAnalytics } from "@/features/dashboard/hooks/useDashboard";
import { dashboardRangeLabel } from "@/features/dashboard/rangeLabel";
import type { DashboardRange } from "@/features/dashboard/types";
import { cn } from "@/lib/utils";

const DashboardPage = () => {
  const [range, setRange] = useState<DashboardRange>("7d");
  const { data, isLoading, isError, refetch, isRefetching, isStale } =
    useDashboardAnalytics(range);

  if (isLoading) return <DashboardSkeleton />;

  if (isError || !data) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="size-10 text-destructive" />
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Không tải được tổng quan</h2>
          <p className="text-sm text-muted-foreground">
            Số liệu dashboard chưa về. Thử tải lại.
          </p>
        </div>
        <Button type="button" onClick={() => refetch()}>
          Tải lại
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 font-sans">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Tổng quan"
          subtitle="Người dùng, nội dung và sức khỏe hệ thống."
        />
        <div className="flex flex-wrap items-center gap-3">
          {isStale && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
              <Clock className="size-3.5" />
              Đang cập nhật
            </div>
          )}
          <Select value={range} onValueChange={(value) => setRange(value as DashboardRange)}>
            <SelectTrigger className="h-10 w-[140px]" aria-label="Khoảng thời gian">
              <SelectValue placeholder="Khoảng thời gian" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">{dashboardRangeLabel("7d")}</SelectItem>
              <SelectItem value="30d">{dashboardRangeLabel("30d")}</SelectItem>
              <SelectItem value="90d">{dashboardRangeLabel("90d")}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            title="Tải lại"
            className={cn(isRefetching && "animate-spin")}
          >
            <RefreshCcw className="size-4" />
          </Button>
        </div>
      </div>

      <OverviewKpis overview={data.overview} range={range} />
      <GrowthCharts
        userGrowth={data.charts.userGrowth}
        trackGrowth={data.charts.trackGrowth}
        range={range}
      />
      <TopRankLists
        topTracks={data.topLists.topTracks}
        topArtists={data.topLists.topArtists}
      />
      <SystemStatusStrip health={data.systemHealth} />
    </div>
  );
};

export default DashboardPage;
