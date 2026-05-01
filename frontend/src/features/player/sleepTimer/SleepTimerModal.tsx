"use client";
import React, { useMemo, useState } from "react";
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
import { Clock } from "lucide-react";
import { useSleepTimer } from "./SleepTimerProvider";

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
        <Button variant="ghost" size="icon" title="Sleep timer">
          <Clock className="size-5" />
        </Button>
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
              <input
                type="number"
                min={1}
                value={minutes}
                onChange={(e) =>
                  setMinutes(Math.max(1, Number(e.target.value || 0)))
                }
                className="w-20 bg-background border border-border rounded px-2 py-1"
              />
              <span className="text-sm text-muted-foreground">minutes</span>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Action</div>
            <div className="grid gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "fade"}
                  onChange={() => setMode("fade")}
                />
                <span className="ml-2">Fade out then pause</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "pause"}
                  onChange={() => setMode("pause")}
                />
                <span className="ml-2">Pause immediately</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "stop"}
                  onChange={() => setMode("stop")}
                />
                <span className="ml-2">Stop (reset player)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "after-track"}
                  onChange={() => setMode("after-track")}
                />
                <span className="ml-2">After current track ends</span>
              </label>
            </div>
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
            <Button onClick={start}>Start</Button>
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
                  <div className="ml-3">
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
