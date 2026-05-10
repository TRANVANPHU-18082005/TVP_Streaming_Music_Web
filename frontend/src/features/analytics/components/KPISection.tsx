import React from "react";
import { Disc, DollarSign, Music, PlayCircle, Users } from "lucide-react";
import { StatCard } from "./AnalyticsShared";
import { DashboardData } from "@/features/dashboard/types";

interface KPISectionProps {
  overview: DashboardData["overview"];
}

const KPISection = ({ overview }: KPISectionProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* <StatCard
        title="Total Revenue"
        value="$124,500"
        change={12.5}
        icon={DollarSign}
      /> */}
      <StatCard
        title="New Users"
        value={overview?.users.value}
        change={overview?.users.growth}
        icon={Users}
      />
      <StatCard
        title="New Albums"
        value={overview?.albums.value}
        change={overview?.albums.growth}
        icon={Disc}
      />
      <StatCard
        title="Streams"
        value={overview?.plays.value}
        change={overview?.plays.growth}
        icon={PlayCircle}
      />
      <StatCard
        title="New Tracks"
        value={overview?.tracks.value}
        change={overview?.tracks.growth}
        icon={Music}
      />
    </div>
  );
};

export default KPISection;
