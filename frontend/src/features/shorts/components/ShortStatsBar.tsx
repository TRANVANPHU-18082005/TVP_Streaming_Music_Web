import { TvMinimalPlay, CheckCircle2, EyeOff, Eye, TrendingUp } from "lucide-react";
import { ITrackShort } from "../types";
import { motion } from "framer-motion";

interface ShortStatsBarProps {
  shorts: ITrackShort[];
  isLoading?: boolean;
}

const fmtCount = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(".0", "") + "K";
  return String(n || 0);
};

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  delay: number;
}

const StatItem = ({ icon, label, value, color, delay }: StatItemProps) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
    className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${color} bg-card/50 flex-1 min-w-[120px]`}
  >
    <div className="flex-shrink-0">{icon}</div>
    <div className="min-w-0">
      <p className="text-xl font-bold text-foreground leading-none">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
    </div>
  </motion.div>
);

export const ShortStatsBar = ({ shorts, isLoading }: ShortStatsBarProps) => {
  if (isLoading) {
    return (
      <div className="flex gap-3 flex-wrap">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-16 flex-1 min-w-[120px] rounded-xl bg-muted/30 animate-pulse border border-border/30"
          />
        ))}
      </div>
    );
  }

  const totalShorts = shorts.length;
  const publishedCount = shorts.filter((s) => s.isPublished).length;
  const draftCount = totalShorts - publishedCount;

  return (
    <div className="flex gap-3 flex-wrap">
      <StatItem
        icon={<TvMinimalPlay className="w-5 h-5 text-primary" />}
        label="Tổng Shorts"
        value={String(totalShorts)}
        color="border-primary/20"
        delay={0}
      />
      <StatItem
        icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
        label="Đang hiển thị"
        value={String(publishedCount)}
        color="border-emerald-500/20"
        delay={0.05}
      />
      <StatItem
        icon={<EyeOff className="w-5 h-5 text-muted-foreground" />}
        label="Đang ẩn"
        value={String(draftCount)}
        color="border-border/50"
        delay={0.1}
      />
    </div>
  );
};
