import { Button } from "@/components/ui/button";
import { SystemHealthDialog } from "./SystemHealthDialog";
import type { SystemHealthData } from "../types";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

export function SystemStatusStrip({ health }: { health: SystemHealthData }) {
  const hasIssue = health.queue.failed > 0 || health.trackStatus.failed > 0;
  const hitRate =
    health.redis.queueWorker.hitRate === null
      ? "Chưa có"
      : `${health.redis.queueWorker.hitRate}%`;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Hệ thống</h2>
          <p className="text-sm text-muted-foreground">
            {hasIssue ? "Có việc cần xem" : "Hàng đợi và bài hát đang ổn"}
          </p>
        </div>
        <SystemHealthDialog data={health}>
          <Button type="button" variant="outline">
            Chi tiết hệ thống
          </Button>
        </SystemHealthDialog>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric label="Hàng đợi đang chờ" value={String(health.queue.waiting)} />
        <Metric label="Hàng đợi lỗi" value={String(health.queue.failed)} />
        <Metric label="Bài lỗi" value={String(health.trackStatus.failed)} />
        <Metric label="Đang xử lý" value={String(health.trackStatus.processing)} />
        <Metric label="Redis trúng cache" value={hitRate} />
      </dl>
    </section>
  );
}
