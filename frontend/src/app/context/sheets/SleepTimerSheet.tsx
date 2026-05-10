import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import {
  SheetBackdrop,
  SheetWrapper,
  HandleBar,
  CancelFooter,
} from "../sheetPrimitives";
import { useSleepTimer } from "@/features/player/sleepTimer/SleepTimerProvider";
import { handleError } from "@/utils/handleError";

const PRESETS = [10, 20, 30, 60];

function formatMs(ms: number) {
  if (ms <= 0) return "0:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

export interface SleepTimerSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SleepTimerSheet: React.FC<SleepTimerSheetProps> = ({
  isOpen,
  onClose,
}) => {
  const sleep = useSleepTimer();
  const [minutes, setMinutes] = useState<number>(30);
  const [mode, setMode] = useState<"fade" | "pause" | "stop" | "after-track">(
    "fade",
  );
  const [fadeSec, setFadeSec] = useState<number>(60);
  const [showHistory, setShowHistory] = useState(false);

  const trackRemainingMs = useMemo(() => {
    if (mode !== "after-track") return null;
    try {
      const audio = document.querySelector("audio") as HTMLMediaElement | null;
      if (audio && Number.isFinite(audio.duration)) {
        const rem = Math.max(
          0,
          (audio.duration - (audio.currentTime || 0)) * 1000,
        );
        return rem;
      }
    } catch (e) {
      // ignore
      handleError(e, "Failed to get audio element for sleep timer");
    }
    return null;
  }, [mode, isOpen]);

  useEffect(() => {
    if (isOpen && sleep.active) {
      const mins = Math.max(1, Math.ceil(sleep.remainingMs / 60000));
      setMinutes(mins);
      setMode(sleep.mode);
      setFadeSec(
        Math.max(5, Math.round((sleep.fadeDurationMs || 30000) / 1000)),
      );
    }
  }, [isOpen]);

  const remaining = useMemo(
    () => formatMs(sleep.remainingMs),
    [sleep.remainingMs],
  );

  const start = () => {
    sleep.open(minutes, { mode, fadeDurationMs: fadeSec * 1000 });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <SheetBackdrop onClick={onClose} />

          <SheetWrapper ariaLabel="Hẹn giờ ngủ" onClose={onClose}>
            <HandleBar />

            <div className="px-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-muted-foreground/8 p-2">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-lg font-semibold">Hẹn giờ ngủ</div>
                  <div className="text-xs text-muted-foreground">
                    Tự động dừng hoặc fade nhạc
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {PRESETS.map((p) => (
                    <Button
                      key={p}
                      variant={p === minutes ? "secondary" : "outline"}
                      onClick={() => setMinutes(p)}
                      size="sm"
                      disabled={mode === "after-track"}
                    >
                      {p}m
                    </Button>
                  ))}

                  <div className="flex items-center gap-2 ml-1">
                    <Input
                      type="number"
                      min={1}
                      max={1440}
                      value={minutes}
                      onChange={(e) =>
                        setMinutes(
                          Math.max(
                            1,
                            Math.min(1440, Number(e.target.value || 0)),
                          ),
                        )
                      }
                      className="w-20"
                      aria-label="Phút"
                      disabled={mode === "after-track"}
                    />
                    <span className="text-sm text-muted-foreground">phút</span>
                  </div>
                </div>

                {mode === "after-track" && (
                  <div className="text-sm text-muted-foreground">
                    {trackRemainingMs != null
                      ? `Bài hiện tại còn ${formatMs(trackRemainingMs)} — tự động áp dụng`
                      : "Sau khi bài hát hiện tại kết thúc"}
                  </div>
                )}

                <div>
                  <div className="text-sm font-medium mb-2">Hành động</div>
                  <RadioGroup
                    value={mode}
                    onValueChange={(v) => setMode(v as any)}
                  >
                    <div className="grid gap-2">
                      <label className="flex items-center gap-2">
                        <RadioGroupItem value="fade" />
                        <span className="ml-2">Fade dần rồi tạm dừng</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <RadioGroupItem value="pause" />
                        <span className="ml-2">Tạm dừng ngay lập tức</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <RadioGroupItem value="stop" />
                        <span className="ml-2">Dừng và reset</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <RadioGroupItem value="after-track" />
                        <span className="ml-2">
                          Sau khi bài hát hiện tại kết thúc
                        </span>
                      </label>
                    </div>
                  </RadioGroup>
                </div>

                {mode === "fade" && (
                  <div>
                    <div className="text-sm font-medium mb-2">
                      Thời lượng fade: {fadeSec}s
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
                    ? `Đang hoạt động — ${remaining} còn lại`
                    : "Chưa có hẹn giờ"}
                </div>
              </div>
            </div>

            <div className="px-4">
              <div className="flex items-center gap-2 w-full">
                <Button
                  variant="outline"
                  onClick={() => {
                    sleep.cancel();
                    onClose();
                  }}
                >
                  Hủy hẹn giờ
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowHistory((s) => !s)}
                >
                  Lịch sử
                </Button>
                <div className="flex-1" />
                <Button onClick={start} disabled={minutes <= 0}>
                  {sleep.active ? "Cập nhật" : "Bắt đầu"}
                </Button>
              </div>
            </div>

            {showHistory && (
              <div className="mt-4 max-h-44 overflow-y-auto space-y-2 border-t border-border pt-3 px-5">
                {sleep.getSessions().length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    Chưa có lịch sử
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
                                  Math.round(
                                    (s.plannedEnd - s.startedAt) / 60000,
                                  ),
                                )
                              : minutes;
                            sleep.open(mins, {
                              mode: s.mode,
                              fadeDurationMs: s.fadeDurationMs ?? 30000,
                            });
                            onClose();
                          }}
                        >
                          Khởi động lại
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            sleep.clearSessions();
                            setShowHistory(false);
                          }}
                        >
                          Xóa
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            <CancelFooter onClose={onClose} />
          </SheetWrapper>
        </>
      )}
    </AnimatePresence>
  );
};

export default SleepTimerSheet;
