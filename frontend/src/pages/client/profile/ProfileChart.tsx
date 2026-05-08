import React from "react";
import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  CartesianGrid,
} from "recharts";

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-frosted rounded-xl px-3 py-2.5 shadow-floating border border-border/50 text-xs font-medium">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="text-foreground font-bold">{payload[0].value} lượt nghe</p>
    </div>
  );
};

const ProfileChart = ({ data }: { data?: any[] }) => {
  return (
    <div className="h-48 sm:h-60 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 4, right: 4, left: -22, bottom: 0 }}
        >
          <defs>
            <linearGradient id="profileChartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="hsl(var(--primary))"
                stopOpacity={0.28}
              />
              <stop
                offset="95%"
                stopColor="hsl(var(--primary))"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 7"
            vertical={false}
            stroke="hsl(var(--border))"
            opacity={0.4}
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{
              fill: "hsl(var(--muted-foreground))",
              fontSize: 10,
              fontWeight: 600,
            }}
            dy={8}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="count"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#profileChartGrad)"
            dot={false}
            activeDot={{
              r: 4,
              fill: "hsl(var(--primary))",
              stroke: "hsl(var(--background))",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ProfileChart;
