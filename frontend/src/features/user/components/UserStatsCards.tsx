import React from "react";
import { Users, UserCheck, ShieldAlert, Mic2, TrendingUp } from "lucide-react";
import { useUserStatsQuery } from "../hooks/useUsersQuery";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  colorClass: string;
  isLoading: boolean;
}

const StatCard = ({ title, value, icon, trend, colorClass, isLoading }: StatCardProps) => {
  return (
    <div className={cn("p-6 rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md", colorClass)}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
          {isLoading ? (
            <div className="h-8 w-24 bg-muted animate-pulse rounded-md" />
          ) : (
            <h3 className="text-3xl font-bold text-foreground">{value}</h3>
          )}
        </div>
        <div className="p-3 rounded-xl bg-background/50 border shadow-sm backdrop-blur-sm">
          {icon}
        </div>
      </div>
      {trend && !isLoading && (
        <div className="mt-4 flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <TrendingUp className="size-3 mr-1" />
          {trend}
        </div>
      )}
    </div>
  );
};

export const UserStatsCards = () => {
  const { data: stats, isLoading } = useUserStatsQuery();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
      <StatCard
        title="Total Users"
        value={stats?.totalUsers || 0}
        icon={<Users className="size-5 text-blue-500" />}
        trend="+12% so với tháng trước"
        colorClass="border-blue-500/20 hover:border-blue-500/40"
        isLoading={isLoading}
      />
      <StatCard
        title="Active Users"
        value={stats?.activeUsers || 0}
        icon={<UserCheck className="size-5 text-emerald-500" />}
        trend="+5% so với tuần trước"
        colorClass="border-emerald-500/20 hover:border-emerald-500/40"
        isLoading={isLoading}
      />
      <StatCard
        title="Blocked/Banned"
        value={stats?.blockedUsers || 0}
        icon={<ShieldAlert className="size-5 text-destructive" />}
        colorClass="border-destructive/20 hover:border-destructive/40"
        isLoading={isLoading}
      />
      <StatCard
        title="Verified Artists"
        value={stats?.artistCount || 0}
        icon={<Mic2 className="size-5 text-amber-500" />}
        trend="+2 nghệ sĩ mới"
        colorClass="border-amber-500/20 hover:border-amber-500/40"
        isLoading={isLoading}
      />
    </div>
  );
};
