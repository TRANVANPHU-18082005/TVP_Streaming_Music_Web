import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardRange } from "../schemas/dashboard.schema";
import type { ChartDashbordDataPoint } from "../types";
import {
  dashboardRangeLabel,
  formatChartAxis,
  formatChartTooltip,
} from "../rangeLabel";

const axisTick = {
  fontSize: 12,
  fill: "hsl(var(--muted-foreground))",
};

function ChartFrame({
  title,
  hint,
  range,
  children,
}: {
  title: string;
  hint: string;
  range: DashboardRange;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">
          {dashboardRangeLabel(range)}
        </span>
      </div>
      <div className="h-72 w-full">{children}</div>
    </section>
  );
}

export function GrowthCharts({
  userGrowth,
  trackGrowth,
  range,
}: {
  userGrowth: ChartDashbordDataPoint[];
  trackGrowth: ChartDashbordDataPoint[];
  range: DashboardRange;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ChartFrame
        title="Đăng ký mới"
        hint="Tài khoản tạo trong cửa sổ đã chọn"
        range={range}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={userGrowth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="_id"
              axisLine={false}
              tickLine={false}
              tick={axisTick}
              tickFormatter={formatChartAxis}
            />
            <YAxis axisLine={false} tickLine={false} tick={axisTick} width={32} />
            <Tooltip
              formatter={(value) => [Number(value ?? 0), "Đăng ký"]}
              labelFormatter={(label) => formatChartTooltip(String(label))}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title="Bài đăng mới"
        hint="Bài hát tạo trong cửa sổ đã chọn"
        range={range}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trackGrowth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="_id"
              axisLine={false}
              tickLine={false}
              tick={axisTick}
              tickFormatter={formatChartAxis}
            />
            <YAxis axisLine={false} tickLine={false} tick={axisTick} width={32} />
            <Tooltip
              formatter={(value) => [Number(value ?? 0), "Bài mới"]}
              labelFormatter={(label) => formatChartTooltip(String(label))}
            />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}
