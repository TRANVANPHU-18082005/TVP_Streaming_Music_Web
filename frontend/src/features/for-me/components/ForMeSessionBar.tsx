import { memo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

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
}: ForMeSessionBarProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="pointer-events-auto absolute left-4 top-[72px] z-30 flex md:left-8">
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsExpanded(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/80 backdrop-blur-xl transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Mở tùy chỉnh phiên nghe"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </motion.button>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="flex w-full max-w-[calc(100vw-32px)] lg:max-w-fit items-center gap-1.5 overflow-hidden rounded-full border border-white/10 bg-black/40 p-1.5 backdrop-blur-xl"
          >
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pr-2">
              <label className="flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/90 transition-colors hover:bg-white/15">
                <span>Quen thuộc</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={mix}
                  aria-label="Quen thuộc hoặc khám phá"
                  onChange={(event) => onMix(Number(event.target.value))}
                  className="w-16 sm:w-20 accent-white"
                />
                <span>Khám phá</span>
              </label>
              
              <div className="mx-0.5 h-4 w-[1px] shrink-0 bg-white/20" />
              
              {MOODS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={mood === item.id}
                  onClick={() => onMood(mood === item.id ? null : item.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all ${
                    mood === item.id
                      ? "bg-white text-black shadow-md"
                      : "bg-transparent text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}

              <div className="mx-0.5 h-4 w-[1px] shrink-0 bg-white/20" />

              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-50"
              >
                Làm mới
              </button>
            </div>
            
            <button
              onClick={() => setIsExpanded(false)}
              className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

ForMeSessionBar.displayName = "ForMeSessionBar";
