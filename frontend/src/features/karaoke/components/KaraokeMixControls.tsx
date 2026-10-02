import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { clampSyncOffset, SYNC_OFFSET_MAX_MS, SYNC_OFFSET_MIN_MS, SYNC_OFFSET_STEP_MS } from "../utils/mixSync";

interface VolumeSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export const KaraokeVolumeSlider = ({ label, value, onChange, disabled }: VolumeSliderProps) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-muted-foreground">{Math.round(value)}</span>
      </div>
      <Slider
        value={[value]}
        min={0}
        max={100}
        step={1}
        disabled={disabled}
        onValueChange={([next]) => onChange(next ?? 0)}
        aria-label={label}
      />
    </div>
  );
};

interface OffsetSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export const KaraokeOffsetSlider = ({ value, onChange, disabled }: OffsetSliderProps) => {
  const nudge = (delta: number) => onChange(clampSyncOffset(value + delta));
  const caption = value === 0
    ? "Khớp với beat"
    : value > 0
      ? `Giọng ra sau beat ${value} ms`
      : `Giọng ra trước beat ${Math.abs(value)} ms`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">Lệch nhịp</span>
        <span className="text-muted-foreground">{caption}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={disabled || value <= SYNC_OFFSET_MIN_MS}
          onClick={() => nudge(-SYNC_OFFSET_STEP_MS)}
          aria-label="Giọng sớm hơn 50 mili giây"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Slider
          value={[value]}
          min={SYNC_OFFSET_MIN_MS}
          max={SYNC_OFFSET_MAX_MS}
          step={SYNC_OFFSET_STEP_MS}
          disabled={disabled}
          onValueChange={([next]) => onChange(clampSyncOffset(next ?? 0))}
          aria-label="Lệch nhịp giữa giọng và beat"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={disabled || value >= SYNC_OFFSET_MAX_MS}
          onClick={() => nudge(SYNC_OFFSET_STEP_MS)}
          aria-label="Giọng muộn hơn 50 mili giây"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
