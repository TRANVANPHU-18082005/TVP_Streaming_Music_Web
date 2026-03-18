import React from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SystemHealthData } from "@/features/dashboard/types";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  data?: SystemHealthData;
  children: React.ReactNode;
}

export const SystemHealthDialog = ({ data, children }: Props) => {
  if (!data) return <>{children}</>;

  const hasErrors =
    data.trackStatus.failed > 0 || (data.queue.failed > 0 ? true : false);

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      {/* DESIGN NOTE: 
         - Sử dụng max-w-4xl để không gian rộng rãi hơn.
         - Viền (border) và Shadow sâu tạo cảm giác nổi bật (Depth).
      */}
      <DialogContent className="w-[95vw] sm:w-full max-w-4xl bg-background border-border p-0 overflow-hidden shadow-2xl sm:rounded-2xl">
        {/* Header Section */}
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
              <p className="text-xs text-muted-foreground font-medium mt-1 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span
                    className={cn(
                      "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                      hasErrors ? "bg-red-400" : "bg-emerald-400",
                    )}
                  ></span>
                  <span
                    className={cn(
                      "relative inline-flex rounded-full h-2 w-2",
                      hasErrors ? "bg-red-500" : "bg-emerald-500",
                    )}
                  ></span>
                </span>
                Real-time Status Check
              </p>
            </div>
          </div>

          {/* Global Status Badge */}
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

        {/* Content Section */}
        <ScrollArea className="max-h-[80vh] sm:max-h-[70vh]">
          <div className="p-6 bg-muted/5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* --- COLUMN 1: INFRASTRUCTURE --- */}
              <div className="space-y-6">
                <h4 className="text-xs font-extrabold text-muted-foreground uppercase tracking-widest pl-1 mb-2">
                  Infrastructure
                </h4>

                {/* 1. Storage & CDN */}
                <SectionCard
                  icon={HardDrive}
                  title="Storage & Content Delivery"
                  color="text-blue-500"
                  borderColor="group-hover:border-blue-500/30"
                >
                  <div className="space-y-6">
                    {/* Backblaze B2 */}
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
                          status={data.storage.b2Status?.status || "offline"}
                        />
                      </div>
                      <div className="flex justify-between items-center px-3 py-2 bg-muted/50 rounded-lg border border-border/50">
                        <span className="text-xs text-muted-foreground font-medium">
                          Readable Buckets
                        </span>
                        <span className="font-mono text-sm font-bold text-foreground">
                          {data.storage.dbReadable}
                        </span>
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
                          {data.storage.cloudinary?.plan || "Unknown Plan"}
                        </span>
                      </div>

                      {data.storage.cloudinary ? (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Usage</span>
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
                              {data.storage.cloudinary.bandwidth.usageReadable}{" "}
                              used
                            </span>
                            <span>
                              {data.storage.cloudinary.bandwidth.limitReadable}{" "}
                              limit
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground italic bg-muted/30 p-2 rounded text-center">
                          Data Unavailable
                        </div>
                      )}
                    </div>
                  </div>
                </SectionCard>

                {/* 2. Redis & Cache */}
                <SectionCard
                  icon={Cpu}
                  title="Redis Cache (Upstash)"
                  color="text-red-500"
                  borderColor="group-hover:border-red-500/30"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-card border border-border rounded-xl shadow-sm">
                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Layers className="w-4 h-4 text-purple-500" /> Memory
                        Used
                      </span>
                      <span className="font-mono font-black text-foreground text-lg">
                        {data.redis.memory}
                      </span>
                    </div>

                    {data.redis.upstash ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-card rounded-xl border border-border flex flex-col gap-1 shadow-sm">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
                            <Wifi className="w-3 h-3" /> Requests (24h)
                          </span>
                          <span className="font-mono font-black text-foreground text-lg tracking-tight">
                            {data.redis.upstash.dailyRequests.toLocaleString()}
                          </span>
                        </div>
                        <div className="p-3 bg-card rounded-xl border border-border flex flex-col gap-1 shadow-sm">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
                            <Database className="w-3 h-3" /> Data Size
                          </span>
                          <span className="font-mono font-black text-foreground text-lg tracking-tight">
                            {data.redis.upstash.dataSizeReadable}
                          </span>
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

              {/* --- COLUMN 2: PROCESSING --- */}
              <div className="space-y-6">
                <h4 className="text-xs font-extrabold text-muted-foreground uppercase tracking-widest pl-1 mb-2">
                  Processing
                </h4>

                {/* 3. Job Queue */}
                <SectionCard
                  icon={Server}
                  title="Job Queue (BullMQ)"
                  color="text-purple-500"
                  borderColor="group-hover:border-purple-500/30"
                >
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
                  {data.queue.failed > 0 && (
                    <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Critical: Some jobs have failed processing.</span>
                    </div>
                  )}
                </SectionCard>

                {/* 4. Track Pipeline Status */}
                <SectionCard
                  icon={Activity}
                  title="Track Status Pipeline"
                  color="text-indigo-500"
                  borderColor="group-hover:border-indigo-500/30"
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
                      label="Failed / Error"
                      count={data.trackStatus.failed}
                      icon={XCircle}
                      theme="red"
                      alert={data.trackStatus.failed > 0}
                    />
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

// --- Sub Components (Refined) ---

const SectionCard = ({
  icon: Icon,
  title,
  color,
  borderColor,
  children,
}: {
  icon: any;
  title: string;
  color: string;
  borderColor: string;
  children: React.ReactNode;
}) => (
  <div
    className={cn(
      "group p-5 rounded-2xl bg-card border border-border shadow-sm transition-all duration-300 hover:shadow-md",
      borderColor,
    )}
  >
    <div className="flex items-center gap-3 mb-5 pb-3 border-b border-border/60">
      <div
        className={cn(
          "p-2 rounded-lg bg-background shadow-sm ring-1 ring-inset ring-gray-200 dark:ring-gray-800",
          color,
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
}: any) => {
  const themeStyles = {
    emerald: "text-emerald-600 bg-emerald-100/50 border-emerald-200",
    blue: "text-blue-600 bg-blue-100/50 border-blue-200",
    red: "text-red-600 bg-red-100/50 border-red-200",
    default: "text-muted-foreground bg-muted border-transparent",
  };

  const activeStyle =
    count > 0 || alert ? themeStyles[theme] : themeStyles.default;

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
            count > 0
              ? theme === "red"
                ? "text-red-500"
                : theme === "blue"
                  ? "text-blue-500"
                  : "text-emerald-500"
              : "text-muted-foreground",
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
          activeStyle,
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
