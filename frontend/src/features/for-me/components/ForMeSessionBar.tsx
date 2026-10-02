import { memo } from "react";

export type ForMeMood = "focus" | "sad" | "energy";

const MOODS: { id: ForMeMood; label: string }[] = [
  { id: "focus", label: "Tập trung" },
  { id: "sad", label: "Buồn" },
  { id: "energy", label: "Năng lượng" },
];

interface ForMeSessionBarProps {
  mix: number;
  mood: ForMeMood | null;
  refreshing: boolean;
  onMix: (mix: number) => void;
  onMood: (mood: ForMeMood | null) => void;
  onRefresh: () => void;
}

export const ForMeSessionBar = memo(({
  mix,
  mood,
  refreshing,
  onMix,
  onMood,
  onRefresh,
}: ForMeSessionBarProps) => (
  <div className="pointer-events-auto absolute left-0 right-0 top-14 z-30 flex items-center gap-2 overflow-x-auto px-3 py-1 lg:right-80">
    <label className="flex shrink-0 items-center gap-2 rounded-full border border-white/15 bg-black/50 px-3 py-1 text-[11px] text-white/80">
      Quen thuộc
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={mix}
        aria-label="Quen thuộc hoặc khám phá"
        onChange={(event) => onMix(Number(event.target.value))}
        className="w-20 accent-white"
      />
      Khám phá
    </label>
    {MOODS.map((item) => (
      <button
        key={item.id}
        type="button"
        aria-pressed={mood === item.id}
        onClick={() => onMood(mood === item.id ? null : item.id)}
        className={`shrink-0 rounded-full border px-3 py-1 text-[11px] ${
          mood === item.id
            ? "border-white bg-white text-black"
            : "border-white/20 bg-black/50 text-white"
        }`}
      >
        {item.label}
      </button>
    ))}
    <button
      type="button"
      onClick={onRefresh}
      disabled={refreshing}
      className="shrink-0 rounded-full border border-white/20 bg-black/50 px-3 py-1 text-[11px] text-white disabled:opacity-50"
    >
      Làm mới
    </button>
  </div>
));

ForMeSessionBar.displayName = "ForMeSessionBar";
