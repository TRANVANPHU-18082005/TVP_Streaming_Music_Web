"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Clock } from "lucide-react";
import { useSleepTimer } from "./SleepTimerProvider";
import { cn } from "@/lib/utils";

const PRESETS = [10, 20, 30, 60];

function formatMs(ms: number) {
  if (ms <= 0) return "0:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

export const SleepTimerModal: React.FC = () => {
  const sleep = useSleepTimer();
  const [minutes, setMinutes] = useState<number>(30);
  const [mode, setMode] = useState<"fade" | "pause" | "stop" | "after-track">(
    "fade",
  );
  const [fadeSec, setFadeSec] = useState<number>(60);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (sleep.showModal && sleep.active) {
      const mins = Math.max(1, Math.ceil(sleep.remainingMs / 60000));
      setMinutes(mins);
      setMode(sleep.mode as any);
      setFadeSec(
        Math.max(5, Math.round((sleep.fadeDurationMs || 30000) / 1000)),
      );
    }
  }, [sleep.showModal]);

  const remaining = useMemo(
    () => formatMs(sleep.remainingMs),
    [sleep.remainingMs],
  );

  const start = () => {
    sleep.open(minutes, { mode, fadeDurationMs: fadeSec * 1000 });
    sleep.closeModal();
  };

  return (
    <Dialog
      open={sleep.showModal}
      onOpenChange={(v) => (v ? sleep.openModal() : sleep.closeModal())}
    >
      <DialogTrigger asChild>
        <button
          className={cn(
            "p-2 rounded-xl transition-colors",
            sleep.active
              ? "bg-[var(--fp-active-bg)] text-[hsl(var(--primary))]"
              : "text-[var(--fp-fg-subtle)] hover:text-[var(--fp-fg)] hover:bg-[var(--fp-hover-bg)]",
          )}
          title="Sleep timer"
        >
          <Clock className="size-5" />
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Sleep timer</DialogTitle>
          <DialogDescription>
            Automatically stop or fade playback after a duration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex gap-2 flex-wrap">
            {PRESETS.map((p) => (
              <Button
                key={p}
                variant={p === minutes ? "secondary" : "outline"}
                onClick={() => setMinutes(p)}
              >
                {p}m
              </Button>
            ))}
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={1440}
                value={minutes}
                onChange={(e) =>
                  setMinutes(
                    Math.max(1, Math.min(1440, Number(e.target.value || 0))),
                  )
                }
                className="w-24"
                aria-label="Minutes"
              />
              <span className="text-sm text-muted-foreground">minutes</span>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Action</div>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)}>
              <div className="grid gap-2">
                <label className="flex items-center gap-2">
                  <RadioGroupItem value="fade" />
                  <span className="ml-2">Fade out then pause</span>
                </label>
                <label className="flex items-center gap-2">
                  <RadioGroupItem value="pause" />
                  <span className="ml-2">Pause immediately</span>
                </label>
                <label className="flex items-center gap-2">
                  <RadioGroupItem value="stop" />
                  <span className="ml-2">Stop (reset player)</span>
                </label>
                <label className="flex items-center gap-2">
                  <RadioGroupItem value="after-track" />
                  <span className="ml-2">After current track ends</span>
                </label>
              </div>
            </RadioGroup>
          </div>

          {mode === "fade" && (
            <div>
              <div className="text-sm font-medium mb-2">
                Fade duration: {fadeSec}s
              </div>
              <Slider
                value={[fadeSec]}
                min={5}
                max={120}
                step={5}
                onValueChange={(v) => setFadeSec(v[0])}
              />
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            {sleep.active
              ? `Active — ${remaining} remaining`
              : "No active timer"}
          </div>
        </div>

        <DialogFooter>
          <div className="flex items-center gap-2 w-full">
            <Button
              variant="outline"
              onClick={() => {
                sleep.cancel();
                sleep.closeModal();
              }}
            >
              Cancel timer
            </Button>
            <Button variant="ghost" onClick={() => setShowHistory((s) => !s)}>
              History
            </Button>
            <div className="flex-1" />
            <Button onClick={start} disabled={minutes <= 0}>
              {sleep.active ? "Update timer" : "Start"}
            </Button>
          </div>
        </DialogFooter>

        {showHistory && (
          <div className="mt-4 max-h-44 overflow-y-auto space-y-2 border-t border-border pt-3">
            {sleep.getSessions().length === 0 && (
              <div className="text-sm text-muted-foreground">
                No sessions yet
              </div>
            )}
            {sleep
              .getSessions()
              .slice()
              .reverse()
              .slice(0, 20)
              .map((s: any) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {s.mode} —{" "}
                      {s.plannedEnd
                        ? `${Math.round((s.plannedEnd - s.startedAt) / 60000)}m`
                        : "-"}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {new Date(s.startedAt).toLocaleString()} •{" "}
                      {s.endedAt
                        ? new Date(s.endedAt).toLocaleString()
                        : "active"}
                    </div>
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const mins = s.plannedEnd
                          ? Math.max(
                              1,
                              Math.round((s.plannedEnd - s.startedAt) / 60000),
                            )
                          : minutes;
                        sleep.open(mins, {
                          mode: s.mode,
                          fadeDurationMs: s.fadeDurationMs ?? 30000,
                        });
                        sleep.closeModal();
                      }}
                    >
                      Restart
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        sleep.clearSessions();
                        setShowHistory(false);
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SleepTimerModal;
