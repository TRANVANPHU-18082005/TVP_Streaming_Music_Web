import { Disc, Headphones, Music, Users } from "lucide-react";
import type { DashboardRange } from "../schemas/dashboard.schema";
import type { DashboardData } from "../types";
import { dashboardRangeLabel } from "../rangeLabel";
import { formatNumber } from "@/utils/format";
import { cn } from "@/lib/utils";

const cards = [
  { key: "users", label: "Người dùng", icon: Users },
  { key: "tracks", label: "Bài hát", icon: Music },
  { key: "albums", label: "Album", icon: Disc },
  { key: "plays", label: "Lượt nghe", icon: Headphones },
] as const;

export function OverviewKpis({
  overview,
  range,
}: {
  overview: DashboardData["overview"];
  range: DashboardRange;
}) {
  const windowLabel = `trong ${dashboardRangeLabel(range)}`;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => {
        const stat = overview[card.key];
        const positive = stat.growth >= 0;
        const Icon = card.icon;
        return (
          <div key={card.key} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-2 text-muted-foreground">
              <span className="flex items-center gap-2 text-xs font-semibold">
                <Icon size={14} className="text-primary" />
                {card.label}
              </span>
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  positive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400",
                )}
              >
                {positive ? "+" : ""}
                {stat.growth}%
              </span>
            </div>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {formatNumber(stat.value)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{windowLabel}</p>
          </div>
        );
      })}
    </div>
  );
}
