// features/dashboard/components/SystemHealthDialog.tsx

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Activity,
  Database,
  HardDrive,
  Server,
  AlertTriangle,
  CloudLightning,
  Wifi,
  CheckCircle2,
  XCircle,
  Cpu,
  Layers,
  Loader2,
  TrendingUp,
  RefreshCw,
  Clock,
  Users,
  Gauge,
  FileAudio,
  Image,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SystemHealthData } from "@/features/dashboard/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  data?: SystemHealthData;
  isStale?: boolean; // NEW: SWR flag từ hook
  children: React.ReactNode;
}

export const SystemHealthDialog = ({
  data,
  isStale = false,
  children,
}: Props) => {
  if (!data) return <>{children}</>;

  // FIX: viết gọn thay vì `> 0 ? true : false`
  const hasErrors = data.trackStatus.failed > 0 || data.queue.failed > 0;

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="w-[95vw] sm:w-full max-w-4xl bg-background border-border p-0 overflow-hidden shadow-2xl sm:rounded-2xl">
        {/* ── HEADER ── */}
        <DialogHeader className="px-6 py-5 border-b border-border bg-muted/20 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "p-3 rounded-xl border-2 shadow-sm transition-colors",
                hasErrors
                  ? "bg-destructive/10 text-destructive border-destructive/20 animate-pulse"
                  : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
              )}
            >
              {hasErrors ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <Activity className="w-6 h-6" />
              )}
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-foreground tracking-tight">
                System Health Monitor
              </DialogTitle>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span
                      className={cn(
                        "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                        hasErrors ? "bg-red-400" : "bg-emerald-400",
                      )}
                    />
                    <span
                      className={cn(
                        "relative inline-flex rounded-full h-2 w-2",
                        hasErrors ? "bg-red-500" : "bg-emerald-500",
                      )}
                    />
                  </span>
                  Real-time Status Check
                </p>
                {/* NEW: SWR stale indicator */}
                {isStale && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                    <Clock className="w-3 h-3" />
                    Đang cập nhật...
                  </span>
                )}
              </div>
            </div>
          </div>

          <div
            className={cn(
              "hidden sm:flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border",
              hasErrors
                ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
            )}
          >
            {hasErrors ? "Attention Needed" : "All Systems Operational"}
          </div>
        </DialogHeader>

        {/* ── CONTENT ── */}
        <ScrollArea className="max-h-[80vh] sm:max-h-[70vh]">
          <div className="p-6 bg-muted/5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ── COLUMN 1: INFRASTRUCTURE ── */}
              <div className="space-y-6">
                <h4 className="text-xs font-extrabold text-muted-foreground uppercase tracking-widest pl-1">
                  Infrastructure
                </h4>

                {/* Storage & CDN */}
                <SectionCard
                  icon={HardDrive}
                  title="Storage & Content Delivery"
                  iconColor="text-blue-500"
                >
                  <div className="space-y-6">
                    {/* B2 */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded text-blue-600">
                            <Database className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-sm font-semibold text-foreground">
                            Backblaze B2
                          </span>
                        </div>
                        <StatusBadge
                          status={data.storage.b2Status?.status ?? "offline"}
                        />
                      </div>

                      {/* NEW: Audio / Image breakdown thay vì chỉ dbReadable */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-200 dark:border-violet-800">
                          <FileAudio className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] text-violet-600 dark:text-violet-400 font-bold uppercase tracking-wide">
                              Audio
                            </p>
                            <p className="font-mono text-xs font-black text-violet-900 dark:text-violet-100 truncate">
                              {data.storage.audioReadable}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 bg-pink-50 dark:bg-pink-900/20 rounded-lg border border-pink-200 dark:border-pink-800">
                          <Image className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] text-pink-600 dark:text-pink-400 font-bold uppercase tracking-wide">
                              Images
                            </p>
                            <p className="font-mono text-xs font-black text-pink-900 dark:text-pink-100 truncate">
                              {data.storage.imageReadable}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-border/50" />

                    {/* Cloudinary */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded text-orange-600">
                            <CloudLightning className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-sm font-semibold text-foreground">
                            Cloudinary Bandwidth
                          </span>
                        </div>
                        <span className="font-mono text-xs font-bold text-muted-foreground">
                          {data.storage.cloudinary?.plan ?? "Unknown Plan"}
                        </span>
                      </div>

                      {data.storage.cloudinary ? (
                        <>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">
                                Bandwidth usage
                              </span>
                              <span className="font-bold text-foreground">
                                {data.storage.cloudinary.bandwidth.percent}%
                              </span>
                            </div>
                            <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden shadow-inner">
                              <div
                                className={cn(
                                  "h-full transition-all duration-700 ease-out rounded-full",
                                  data.storage.cloudinary.bandwidth.percent > 90
                                    ? "bg-gradient-to-r from-red-500 to-red-600"
                                    : data.storage.cloudinary.bandwidth
                                          .percent > 70
                                      ? "bg-gradient-to-r from-amber-400 to-amber-500"
                                      : "bg-gradient-to-r from-blue-400 to-blue-600",
                                )}
                                style={{
                                  width: `${Math.min(
                                    data.storage.cloudinary.bandwidth.percent,
                                    100,
                                  )}%`,
                                }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground font-mono mt-1">
                              <span>
                                {
                                  data.storage.cloudinary.bandwidth
                                    .usageReadable
                                }{" "}
                                used
                              </span>
                              <span>
                                {
                                  data.storage.cloudinary.bandwidth
                                    .limitReadable
                                }{" "}
                                limit
                              </span>
                            </div>
                          </div>

                          {/* NEW: Storage Velocity */}
                          {data.storage.cloudinary.velocity && (
                            <StorageVelocityBlock
                              velocity={data.storage.cloudinary.velocity}
                            />
                          )}
                        </>
                      ) : (
                        <div className="text-xs text-muted-foreground italic bg-muted/30 p-2 rounded text-center">
                          Data Unavailable
                        </div>
                      )}
                    </div>
                  </div>
                </SectionCard>

                {/* Redis — NEW: đầy đủ queueWorker + upstash */}
                <SectionCard
                  icon={Cpu}
                  title="Redis Cache"
                  iconColor="text-red-500"
                >
                  <div className="space-y-4">
                    {/* Queue Worker detail */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                        Queue Worker
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <RedisMetricCell
                          icon={Layers}
                          label="Memory"
                          value={data.redis.queueWorker.memory}
                        />
                        {/* NEW: Connected Clients */}
                        <RedisMetricCell
                          icon={Users}
                          label="Clients"
                          value={`${data.redis.queueWorker.connectedClients}`}
                          alert={data.redis.queueWorker.connectedClients > 50}
                          alertText="Có thể bị connection leak"
                        />
                        {/* NEW: Ops/sec */}
                        <RedisMetricCell
                          icon={Gauge}
                          label="Ops / sec"
                          value={data.redis.queueWorker.opsPerSecond.toLocaleString()}
                        />
                        {/* NEW: Hit rate */}
                        <RedisMetricCell
                          icon={Activity}
                          label="Hit rate"
                          value={
                            data.redis.queueWorker.hitRate !== null
                              ? `${data.redis.queueWorker.hitRate}%`
                              : "N/A"
                          }
                          semantic={
                            data.redis.queueWorker.hitRate === null
                              ? "neutral"
                              : data.redis.queueWorker.hitRate >= 80
                                ? "good"
                                : data.redis.queueWorker.hitRate >= 50
                                  ? "warn"
                                  : "bad"
                          }
                        />
                      </div>
                    </div>

                    {/* Upstash */}
                    {data.redis.upstash ? (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                          Upstash Cache
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-3 bg-card rounded-xl border border-border flex flex-col gap-1 shadow-sm">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
                              <Wifi className="w-3 h-3" /> Requests (24h)
                            </span>
                            <span className="font-mono font-black text-foreground text-base tracking-tight">
                              {data.redis.upstash.dailyRequests.toLocaleString()}
                            </span>
                          </div>
                          <div className="p-3 bg-card rounded-xl border border-border flex flex-col gap-1 shadow-sm">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
                              <Database className="w-3 h-3" /> Data Size
                            </span>
                            <span className="font-mono font-black text-foreground text-base tracking-tight">
                              {data.redis.upstash.dataSizeReadable}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg text-sm border border-amber-200 dark:border-amber-800">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="font-medium">
                          Restricted API Access
                        </span>
                      </div>
                    )}
                  </div>
                </SectionCard>
              </div>

              {/* ── COLUMN 2: PROCESSING ── */}
              <div className="space-y-6">
                <h4 className="text-xs font-extrabold text-muted-foreground uppercase tracking-widest pl-1">
                  Processing
                </h4>

                {/* Job Queue */}
                <SectionCard
                  icon={Server}
                  title="Job Queue (BullMQ)"
                  iconColor="text-purple-500"
                >
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <QueueMetric
                        label="Active"
                        value={data.queue.active}
                        theme="emerald"
                      />
                      <QueueMetric
                        label="Waiting"
                        value={data.queue.waiting}
                        theme="amber"
                      />
                      <QueueMetric
                        label="Failed"
                        value={data.queue.failed}
                        theme="red"
                        alert={data.queue.failed > 0}
                      />
                    </div>

                    {/* Completed + Delayed row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 border border-border/60 text-xs font-medium">
                        <span className="text-muted-foreground">Completed</span>
                        <span className="font-black tabular-nums text-foreground">
                          {data.queue.completed.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 border border-border/60 text-xs font-medium">
                        <span className="text-muted-foreground">Delayed</span>
                        <span className="font-black tabular-nums text-foreground">
                          {data.queue.delayed.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* NEW: Retry Failed Jobs button */}
                    {data.queue.failed > 0 && (
                      <div className="space-y-2">
                        <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {data.queue.failed} job
                            {data.queue.failed > 1 ? "s" : ""} đang bị lỗi và
                            cần xử lý.
                          </span>
                        </div>
                        <RetryFailedButton count={data.queue.failed} />
                      </div>
                    )}
                  </div>
                </SectionCard>

                {/* Track Pipeline */}
                <SectionCard
                  icon={Activity}
                  title="Track Status Pipeline"
                  iconColor="text-indigo-500"
                >
                  <div className="space-y-1">
                    <PipelineRow
                      label="Ready to Play"
                      count={data.trackStatus.ready}
                      icon={CheckCircle2}
                      theme="emerald"
                    />
                    <PipelineRow
                      label="Processing / Transcoding"
                      count={data.trackStatus.processing}
                      icon={Loader2}
                      theme="blue"
                      animate
                    />
                    <PipelineRow
                      label="Pending"
                      count={data.trackStatus.pending}
                      icon={Clock}
                      theme="amber"
                    />
                    <PipelineRow
                      label="Failed / Error"
                      count={data.trackStatus.failed}
                      icon={XCircle}
                      theme="red"
                      alert={data.trackStatus.failed > 0}
                    />
                  </div>

                  {/* Retry track failed */}
                  {data.trackStatus.failed > 0 && (
                    <div className="mt-3">
                      <RetryFailedButton
                        count={data.trackStatus.failed}
                        label="Retry Failed Tracks"
                        variant="track"
                      />
                    </div>
                  )}
                </SectionCard>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Storage Velocity Block
// ─────────────────────────────────────────────────────────────────────────────
const StorageVelocityBlock = ({
  velocity,
}: {
  velocity: import("@/features/dashboard/types").StorageVelocity;
}) => {
  const isUrgent =
    velocity.daysUntilFull !== null && velocity.daysUntilFull <= 7;
  const isWarn =
    velocity.daysUntilFull !== null && velocity.daysUntilFull <= 30;

  return (
    <div
      className={cn(
        "rounded-xl border p-3 space-y-2 transition-colors",
        isUrgent
          ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
          : isWarn
            ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
            : "bg-muted/40 border-border/60",
      )}
    >
      <div className="flex items-center gap-2">
        <TrendingUp
          className={cn(
            "w-3.5 h-3.5 shrink-0",
            isUrgent
              ? "text-red-600 dark:text-red-400"
              : isWarn
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground",
          )}
        />
        <span
          className={cn(
            "text-[11px] font-bold uppercase tracking-wider",
            isUrgent
              ? "text-red-700 dark:text-red-400"
              : isWarn
                ? "text-amber-700 dark:text-amber-400"
                : "text-muted-foreground",
          )}
        >
          Storage Velocity
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground">Tốc độ tăng trưởng</span>
        <span className="font-semibold text-right text-foreground">
          ~{velocity.avgReadablePerDay} / ngày
        </span>

        {velocity.daysUntilFull !== null && (
          <>
            <span className="text-muted-foreground">Dự kiến đầy</span>
            <span
              className={cn(
                "font-bold text-right",
                isUrgent
                  ? "text-red-700 dark:text-red-400"
                  : isWarn
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-foreground",
              )}
            >
              {velocity.daysUntilFull === 0
                ? "Đã đầy!"
                : `${velocity.daysUntilFull} ngày nữa`}
            </span>
          </>
        )}

        {velocity.projectedFullDate && (
          <>
            <span className="text-muted-foreground">Ngày cụ thể</span>
            <span className="font-semibold text-right text-foreground">
              {new Date(velocity.projectedFullDate).toLocaleDateString(
                "vi-VN",
                {
                  day: "numeric",
                  month: "long",
                },
              )}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW: RetryFailedButton
// ─────────────────────────────────────────────────────────────────────────────
const RetryFailedButton = ({
  count,
  label = "Retry Failed Jobs",
  variant = "queue",
}: {
  count: number;
  label?: string;
  variant?: "queue" | "track";
}) => {
  const [loading, setLoading] = useState(false);

  const handleRetry = async () => {
    setLoading(true);
    try {
      // Gọi API tương ứng
      const endpoint =
        variant === "queue"
          ? "/api/queue/retry-failed"
          : "/api/tracks/retry-failed";
      await fetch(endpoint, { method: "POST" });
      toast.success(`Đã gửi lệnh retry ${count} job(s).`);
    } catch {
      toast.error("Retry thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRetry}
      disabled={loading}
      className="w-full h-9 text-xs font-bold gap-2 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400 transition-all"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <RefreshCw className="w-3.5 h-3.5" />
      )}
      {loading ? "Đang xử lý..." : `${label} (${count})`}
    </Button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW: RedisMetricCell
// ─────────────────────────────────────────────────────────────────────────────
const RedisMetricCell = ({
  icon: Icon,
  label,
  value,
  alert,
  alertText,
  semantic,
}: {
  icon: any;
  label: string;
  value: string;
  alert?: boolean;
  alertText?: string;
  semantic?: "good" | "warn" | "bad" | "neutral";
}) => {
  const valueColor =
    semantic === "good"
      ? "text-emerald-700 dark:text-emerald-400"
      : semantic === "warn"
        ? "text-amber-700 dark:text-amber-400"
        : semantic === "bad"
          ? "text-red-700 dark:text-red-400"
          : "text-foreground";

  return (
    <div
      className={cn(
        "relative flex flex-col gap-1 p-3 bg-card rounded-xl border shadow-sm transition-colors",
        alert
          ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10"
          : "border-border",
      )}
      title={alert && alertText ? alertText : undefined}
    >
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </span>
      <span
        className={cn(
          "font-mono font-black text-base tracking-tight",
          valueColor,
        )}
      >
        {value}
      </span>
      {alert && alertText && (
        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium leading-tight">
          {alertText}
        </span>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared Sub-Components (refined, unchanged API)
// ─────────────────────────────────────────────────────────────────────────────

const SectionCard = ({
  icon: Icon,
  title,
  iconColor,
  children,
}: {
  icon: any;
  title: string;
  iconColor: string;
  children: React.ReactNode;
}) => (
  <div className="group p-5 rounded-2xl bg-card border border-border shadow-sm transition-all duration-300 hover:shadow-md hover:border-border-secondary">
    <div className="flex items-center gap-3 mb-5 pb-3 border-b border-border/60">
      <div
        className={cn(
          "p-2 rounded-lg bg-background shadow-sm ring-1 ring-inset ring-gray-200 dark:ring-gray-800",
          iconColor,
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-bold text-card-foreground text-base tracking-tight">
        {title}
      </h3>
    </div>
    {children}
  </div>
);

const QueueMetric = ({
  label,
  value,
  theme,
  alert,
}: {
  label: string;
  value: number;
  theme: "emerald" | "amber" | "red";
  alert?: boolean;
}) => {
  const themeStyles = {
    emerald:
      "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400",
    amber:
      "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400",
    red: "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-300",
        themeStyles[theme],
        alert && "animate-pulse ring-2 ring-red-500/50",
      )}
    >
      <span className="text-[10px] uppercase font-bold opacity-80 mb-1 tracking-wide">
        {label}
      </span>
      <span className="text-2xl font-black tracking-tight tabular-nums">
        {value}
      </span>
    </div>
  );
};

const PipelineRow = ({
  label,
  count,
  icon: Icon,
  theme,
  animate,
  alert,
}: {
  label: string;
  count: number;
  icon: any;
  theme: "emerald" | "blue" | "red" | "amber";
  animate?: boolean;
  alert?: boolean;
}) => {
  const activeIconColor = {
    emerald: "text-emerald-500",
    blue: "text-blue-500",
    red: "text-red-500",
    amber: "text-amber-500",
  }[theme];

  const badgeStyle = {
    emerald:
      "text-emerald-700 bg-emerald-100/50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800",
    blue: "text-blue-700 bg-blue-100/50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800",
    red: "text-red-700 bg-red-100/50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800",
    amber:
      "text-amber-700 bg-amber-100/50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800",
  }[theme];

  return (
    <div
      className={cn(
        "flex justify-between items-center p-3 rounded-xl transition-colors border",
        "bg-background border-border/40 hover:border-border hover:bg-muted/30",
        alert &&
          "bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-900/50",
      )}
    >
      <div className="flex items-center gap-3">
        <Icon
          className={cn(
            "w-4 h-4",
            count > 0 ? activeIconColor : "text-muted-foreground",
            animate && count > 0 && "animate-spin",
          )}
        />
        <span
          className={cn(
            "text-sm font-semibold",
            alert ? "text-red-700 dark:text-red-400" : "text-foreground/80",
          )}
        >
          {label}
        </span>
      </div>
      <span
        className={cn(
          "text-xs px-2.5 py-1 rounded-md font-black min-w-[40px] text-center border",
          count > 0
            ? badgeStyle
            : "text-muted-foreground bg-muted border-transparent",
        )}
      >
        {count}
      </span>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const isOnline = status === "online";
  return (
    <span
      className={cn(
        "text-[10px] px-2 py-1 rounded-full border flex items-center gap-1.5 uppercase font-bold tracking-wider",
        isOnline
          ? "bg-emerald-100/50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-800"
          : "bg-red-100/50 border-red-200 text-red-700 dark:bg-red-500/10 dark:text-red-400 dark:border-red-800",
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          isOnline ? "bg-emerald-500" : "bg-red-500",
        )}
      />
      {status}
    </span>
  );
};

export default SystemHealthDialog;
