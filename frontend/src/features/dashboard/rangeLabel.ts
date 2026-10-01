import type { DashboardRange } from "./schemas/dashboard.schema";

export function dashboardRangeLabel(range: DashboardRange): string {
  if (range === "30d") return "30 ngày";
  if (range === "90d") return "3 tháng";
  return "7 ngày";
}

export function formatChartAxis(day: string): string {
  const parts = day.split("-");
  if (parts.length !== 3) return day;
  return `${Number(parts[2])}/${Number(parts[1])}`;
}

export function formatChartTooltip(day: string): string {
  const date = new Date(`${day}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
