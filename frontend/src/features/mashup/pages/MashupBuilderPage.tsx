import { useState, useRef, useEffect, useCallback } from "react";
import { useMashupBuilder } from "../hooks/useMashupBuilder";
import { useCreateMashup, useSuggestShorts } from "../hooks/useMashups";
import { useShorts } from "@/features/shorts/hooks/useShorts";
import { useMashupPreview } from "../hooks/useMashupPreview";
import {
  Plus, GripVertical, Play, Pause, X, Music, Sparkles, Search,
  Layers, Loader2, Settings2, Disc3, Square, Save, Upload,
  Clock, Zap, ChevronLeft, Volume2, Scissors,
  BarChart2, Check, AlertCircle, Info, Library, Wand2, ListMusic,
  ChevronUp, ChevronDown, SlidersHorizontal, ArrowLeft,
} from "lucide-react";
import { ITrackShort } from "@/features/shorts/types";
import {
  IMashupShort, TRANSITION_META, TransitionType,
  MASHUP_MIN_DURATION, MASHUP_MAX_DURATION,
  formatMashupDuration, calcMashupDuration,
} from "../types";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent, TouchSensor,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates,
  horizontalListSortingStrategy, useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const trackDuration = (item: IMashupShort) => {
  const s = item.trimStart ?? item.short.startTime ?? 0;
  const e = item.trimEnd ?? item.short.endTime ?? 0;
  return Math.max(0, e - s);
};
const fmtSec = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const TRANSITION_TYPES = Object.entries(TRANSITION_META).map(([key, v]) => ({
  value: key as TransitionType, ...v,
}));

// ─── Hooks ────────────────────────────────────────────────────────────────────
/** Detect breakpoint */
const useBreakpoint = () => {
  const [bp, setBp] = useState<"mobile" | "tablet" | "desktop">(() => {
    if (typeof window === "undefined") return "desktop";
    if (window.innerWidth < 640) return "mobile";
    if (window.innerWidth < 1024) return "tablet";
    return "desktop";
  });
  useEffect(() => {
    const fn = () => {
      if (window.innerWidth < 640) setBp("mobile");
      else if (window.innerWidth < 1024) setBp("tablet");
      else setBp("desktop");
    };
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return bp;
};

// ─── Mini Waveform ────────────────────────────────────────────────────────────
const MiniWaveform = ({ seed = 0, active = false }: { seed?: number; active?: boolean }) => {
  const bars = 16;
  const heights = Array.from({ length: bars }, (_, i) => {
    const v = Math.abs(Math.sin((i + seed) * 1.5) * 0.6 + Math.sin((i + seed) * 3.7) * 0.4);
    return Math.max(0.15, v);
  });
  return (
    <div className="flex items-center gap-px h-5 w-full">
      {heights.map((h, i) => (
        <motion.div
          key={i}
          className={`flex-1 rounded-sm ${active ? "bg-primary" : "bg-white/25"}`}
          style={{ height: `${h * 100}%` }}
          animate={active ? { height: [`${h * 100}%`, `${Math.max(15, h * 60)}%`, `${h * 100}%`] } : {}}
          transition={{ repeat: active ? Infinity : 0, duration: 0.5 + i * 0.05, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
};

// ─── Duration Status Bar ──────────────────────────────────────────────────────
const DurationBar = ({ totalDuration }: { totalDuration: number }) => {
  const pct = Math.min(100, (totalDuration / MASHUP_MAX_DURATION) * 100);
  const minPct = (MASHUP_MIN_DURATION / MASHUP_MAX_DURATION) * 100;
  const isValid = totalDuration >= MASHUP_MIN_DURATION && totalDuration <= MASHUP_MAX_DURATION;
  const isOver = totalDuration > MASHUP_MAX_DURATION;
  const isTooShort = totalDuration > 0 && totalDuration < MASHUP_MIN_DURATION;

  return (
    <div className="flex items-center gap-2.5 px-3 sm:px-4 py-2 bg-surface-2/20 border-t border-border/30">
      <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className={`text-xs font-mono font-bold ${isOver ? "text-red-400" : isValid ? "text-emerald-400" : "text-foreground"}`}>
        {formatMashupDuration(totalDuration)}
      </span>
      <div className="flex-1 h-1 bg-border/20 rounded-full relative overflow-hidden">
        <div className="absolute top-0 bottom-0 w-px bg-white/25" style={{ left: `${minPct}%` }} />
        <motion.div
          className={`h-full rounded-full ${isOver ? "bg-red-500" : isValid ? "bg-emerald-500" : isTooShort ? "bg-amber-500" : "bg-white/40"}`}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground/60 font-mono shrink-0">7:00</span>
      {isOver && <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
      {isValid && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
      {isTooShort && <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
    </div>
  );
};

// ─── Track Card (for Timeline) ────────────────────────────────────────────────
interface TrackCardProps {
  item: IMashupShort;
  index: number;
  total: number;
  isSelected: boolean;
  isPreviewing: boolean;
  isAudioPlaying: boolean;
  layout: "horizontal" | "vertical";
  onSelect: () => void;
  onRemove: () => void;
  onPlay: (e: React.MouseEvent) => void;
  stopPreview: () => void;
}

const TrackCard = ({
  item, index, total, isSelected, isPreviewing, isAudioPlaying,
  layout, onSelect, onRemove, onPlay, stopPreview,
}: TrackCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.short._id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.7 : 1,
  };
  const dur = trackDuration(item);
  const meta = TRANSITION_META[item.transitionType];

  if (layout === "vertical") {
    return (
      <div ref={setNodeRef} style={style} className="flex flex-col">
        {/* Card */}
        <div
          onClick={onSelect}
          className={`relative flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all group ${isPreviewing
              ? "border-primary/80 ring-1 ring-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.2)] bg-primary/10"
              : isSelected
                ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20 shadow-sm"
                : "border-border/40 hover:border-border hover:bg-white/5"
            } ${isDragging ? "shadow-2xl scale-[1.02]" : ""}`}
        >
          {/* Drag handle */}
          <div
            {...attributes} {...listeners}
            className="p-1 cursor-grab active:cursor-grabbing touch-none text-muted-foreground/30 hover:text-muted-foreground"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4" />
          </div>
          {/* Number */}
          <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-black ${isPreviewing ? "bg-primary text-white" : "bg-surface-2 text-muted-foreground"
            }`}>{index + 1}</div>
          {/* Cover */}
          <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
            <ImageWithFallback src={item.short.track?.coverImage} className="w-full h-full object-cover" />
            <button
              onClick={e => { e.stopPropagation(); isPreviewing ? stopPreview() : onPlay(e); }}
              className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {isPreviewing ? <Disc3 className="w-5 h-5 text-primary animate-spin" style={{ animationDuration: "2s" }} /> : <Play className="w-4 h-4 text-white fill-white" />}
            </button>
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold truncate ${isPreviewing ? "text-primary" : ""}`}>{item.short.track?.title}</p>
            <p className="text-xs text-muted-foreground truncate">{item.short.track?.artist?.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-mono bg-black/20 px-1.5 py-0.5 rounded text-muted-foreground">{fmtSec(dur)}</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border"
                style={{ backgroundColor: `${meta.color}15`, borderColor: `${meta.color}40`, color: meta.color }}>
                {meta.icon} {meta.label.split(" ")[0]}
              </span>
            </div>
          </div>
          {/* Remove */}
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            className="p-1.5 rounded-lg hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Transition connector */}
        {index < total - 1 && (
          <div className="flex flex-col items-start gap-1 pl-16 py-1.5" onClick={onSelect}>
            <div className="w-px h-3 bg-gradient-to-b from-border/80 to-transparent ml-3" />
            <div className="text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer hover:scale-105 transition-transform backdrop-blur-sm shadow-sm"
              style={{ backgroundColor: `${meta.color}15`, borderColor: `${meta.color}40`, color: meta.color }}>
              {meta.icon} {meta.label}
            </div>
            <div className="w-px h-3 bg-gradient-to-t from-border/80 to-transparent ml-3" />
          </div>
        )}
      </div>
    );
  }

  // Horizontal (desktop DAW)
  return (
    <div ref={setNodeRef} style={style} className="flex items-stretch gap-0 shrink-0 ">
      <div
        onClick={onSelect}
        className={`relative flex flex-col w-40 cursor-pointer rounded-2xl overflow-hidden border transition-all duration-300 group ${isPreviewing
            ? "border-primary/80 ring-1 ring-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.2)] bg-primary/10"
            : isSelected
              ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20 shadow-sm"
              : "border-border/40 hover:border-border hover:bg-white/5"
          } ${isDragging ? "shadow-2xl scale-[1.03]" : ""}`}
      >
        <div className="relative h-24 bg-black">
          <ImageWithFallback src={item.short.track?.coverImage} className="w-full h-full object-cover opacity-70" />
          <div className="absolute inset-x-0 bottom-0 px-2 pb-1">
            <MiniWaveform seed={index} active={isPreviewing} />
          </div>
          <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-black/70 backdrop-blur flex items-center justify-center">
            <span className="text-[9px] font-black text-white">{index + 1}</span>
          </div>
          <button
            onClick={e => { e.stopPropagation(); isPreviewing ? stopPreview() : onPlay(e); }}
            className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isAudioPlaying || isPreviewing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
          >
            {isPreviewing
              ? <Disc3 className="w-7 h-7 text-primary animate-spin" style={{ animationDuration: "2s" }} />
              : isAudioPlaying ? <Pause className="w-7 h-7 text-white" />
                : <Play className="w-7 h-7 text-white fill-white" />
            }
          </button>
          <div {...attributes} {...listeners}
            className="absolute top-2 right-2 p-1 bg-black/50 rounded-md cursor-grab active:cursor-grabbing touch-none opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical className="w-3 h-3 text-white/70" />
          </div>
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            className="absolute bottom-2 right-2 p-1 bg-black/50 hover:bg-red-500/80 rounded-md opacity-0 group-hover:opacity-100 transition-all"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        </div>
        <div className="p-2 flex flex-col gap-0.5">
          <p className={`text-xs font-bold truncate leading-tight ${isPreviewing ? "text-primary" : ""}`}>{item.short.track?.title}</p>
          <p className="text-[10px] text-muted-foreground truncate">{item.short.track?.artist?.name}</p>
          <span className="text-[9px] font-mono text-muted-foreground/60 mt-0.5">{fmtSec(dur)}</span>
        </div>
      </div>
      {index < total - 1 && (
        <div className="flex items-center justify-center w-10 shrink-0 px-0.5">
          <div className="flex items-center gap-1 w-full cursor-pointer group/arrow" onClick={onSelect}>
            <div className="w-full h-px bg-gradient-to-r from-border/80 to-transparent" />
            <div className="px-1.5 py-0.5 rounded text-[8px] font-bold border hover:scale-110 transition-transform backdrop-blur-sm shadow-sm"
              style={{ backgroundColor: `${meta.color}15`, borderColor: `${meta.color}40`, color: meta.color }}>
              {meta.icon}
            </div>
            <div className="w-full h-px bg-gradient-to-l from-border/80 to-transparent" />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Library Panel ────────────────────────────────────────────────────────────
interface LibraryPanelProps {
  search: string;
  setSearch: (v: string) => void;
  shorts: ITrackShort[];
  isLoading: boolean;
  addedIds: Set<string>;
  totalDuration: number;
  onAdd: (s: ITrackShort) => void;
  onPlay: (e: React.MouseEvent, s: ITrackShort) => void;
  playingId: string | null;
}

const LibraryPanel = ({
  search, setSearch, shorts, isLoading, addedIds, totalDuration, onAdd, onPlay, playingId,
}: LibraryPanelProps) => (
  <div className="flex flex-col h-full">
    {/* Search */}
    <div className="p-3 border-b border-border/40 shrink-0">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Tìm kiếm shorts..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-background/60 border border-border/50 text-xs rounded-full pl-9 pr-3 py-2.5 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground transition-all"
        />
        {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
          <X className="w-3.5 h-3.5" />
        </button>}
      </div>
    </div>
    {/* List */}
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {isLoading ? (
        <div className="flex items-center justify-center h-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : shorts.map((short: ITrackShort) => {
        const isPlaying = playingId === short._id;
        const added = addedIds.has(short._id);
        const dur = Math.max(0, (short.endTime ?? 0) - (short.startTime ?? 0));
        const wouldExceed = totalDuration + dur > MASHUP_MAX_DURATION;
        return (
          <div
            key={short._id}
            className={`flex items-center gap-3 p-2 rounded-2xl transition-all group ${added || wouldExceed
                ? "opacity-40 cursor-not-allowed"
                : "hover:bg-white/5 cursor-pointer"
              }`}
            onClick={() => !added && !wouldExceed && onAdd(short)}
          >
            <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 shadow-sm border border-border/50">
              <ImageWithFallback src={short.track?.coverImage} className="w-full h-full object-cover" />
              <button
                onClick={e => onPlay(e, short)}
                className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 text-white ml-0.5" />}
              </button>
              {added && (
                <div className="absolute inset-0 bg-primary/40 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold truncate ${isPlaying ? "text-primary" : ""}`}>{short.track?.title}</p>
              <p className="text-[10px] text-muted-foreground truncate">{short.track?.artist?.name}</p>
              <span className="text-[9px] font-mono text-muted-foreground/50">{fmtSec(dur)}</span>
            </div>
            {!added && !wouldExceed && (
              <div className="w-6 h-6 rounded-full bg-primary/10 hover:bg-primary text-primary hover:text-white flex items-center justify-center transition-all shrink-0 opacity-0 group-hover:opacity-100">
                <Plus className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

// ─── Inspector Panel ──────────────────────────────────────────────────────────
interface InspectorProps {
  item: IMashupShort | null;
  index: number;
  onUpdateTransition: (i: number, t: TransitionType, d: number) => void;
  onUpdateVolume: (i: number, v: number) => void;
  onUpdateTrim: (i: number, s: number, e: number) => void;
  suggestions: ITrackShort[];
  onAddSuggestion: (s: ITrackShort) => void;
  isLoadingSuggestions: boolean;
  playShort: (e: React.MouseEvent, s: ITrackShort) => void;
  playingShortId: string | null;
}

const InspectorPanel = ({
  item, index, onUpdateTransition, onUpdateVolume, onUpdateTrim,
  suggestions, onAddSuggestion, isLoadingSuggestions, playShort, playingShortId,
}: InspectorProps) => {
  const [tab, setTab] = useState<"track" | "fx" | "ai">("track");
  useEffect(() => { if (item) setTab("track"); }, [item?.short._id]);

  if (!item) return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface-2/50 flex items-center justify-center mb-3">
        <SlidersHorizontal className="w-7 h-7 text-muted-foreground/30" />
      </div>
      <p className="text-sm font-medium text-muted-foreground/60">Chọn một track để chỉnh sửa</p>
      <p className="text-xs text-muted-foreground/40 mt-1">Volume, trim, hiệu ứng chuyển bài</p>
    </div>
  );

  const trimStart = item.trimStart ?? item.short.startTime ?? 0;
  const trimEnd = item.trimEnd ?? item.short.endTime ?? 0;
  const maxDur = item.short.duration || 300;

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex bg-surface-2/40 p-1 rounded-xl mx-2 mt-2 mb-1 shrink-0 border border-border/20 shadow-inner">
        {(["track", "fx", "ai"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all rounded-lg ${tab === t ? "bg-primary text-white shadow-md shadow-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
          >
            {t === "track" ? "Track" : t === "fx" ? "FX" : "AI"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* ── TRACK TAB ── */}
        {tab === "track" && (
          <>
            {/* Cover */}
            <div className="relative rounded-xl overflow-hidden aspect-square bg-black">
              <ImageWithFallback src={item.short.track?.coverImage} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-2.5 left-3 right-3">
                <p className="font-bold text-white text-sm line-clamp-2 leading-tight">{item.short.track?.title}</p>
                <p className="text-white/60 text-xs mt-0.5">{item.short.track?.artist?.name}</p>
              </div>
            </div>

            {/* Volume */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5" /> Volume
                </label>
                <span className="text-xs font-mono font-bold text-primary">{Math.round((item.volume ?? 1) * 100)}%</span>
              </div>
              <input
                type="range" min={0} max={1} step={0.05}
                value={item.volume ?? 1}
                onChange={e => onUpdateVolume(index, parseFloat(e.target.value))}
                className="w-full h-1 rounded-full accent-primary cursor-pointer bg-white/10"
              />
            </div>

            {/* Trim */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5" /> Trim đoạn nhạc
              </label>
              <div className="space-y-2.5 p-3 bg-surface-2/30 rounded-xl border border-border/30">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground w-12 shrink-0">Bắt đầu</span>
                  <input type="range" min={0} max={Math.max(0, trimEnd - 1)} step={0.5}
                    value={trimStart}
                    onChange={e => onUpdateTrim(index, parseFloat(e.target.value), trimEnd)}
                    className="flex-1 h-1 rounded-full accent-primary cursor-pointer bg-white/10"
                  />
                  <span className="text-[10px] font-mono text-primary w-10 text-right shrink-0">{fmtSec(trimStart)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground w-12 shrink-0">Kết thúc</span>
                  <input type="range" min={trimStart + 1} max={maxDur} step={0.5}
                    value={trimEnd}
                    onChange={e => onUpdateTrim(index, trimStart, parseFloat(e.target.value))}
                    className="flex-1 h-1 rounded-full accent-primary cursor-pointer bg-white/10"
                  />
                  <span className="text-[10px] font-mono text-primary w-10 text-right shrink-0">{fmtSec(trimEnd)}</span>
                </div>
                <p className="text-[10px] text-center text-muted-foreground">
                  Đoạn phát: <span className="text-primary font-mono font-bold">{fmtSec(trackDuration(item))}</span>
                </p>
              </div>
            </div>
          </>
        )}

        {/* ── FX TAB ── */}
        {tab === "fx" && (
          <>
            <div>
              <p className="text-xs text-muted-foreground mb-3">Hiệu ứng chuyển sang track tiếp theo</p>
              <div className="grid grid-cols-2 gap-2">
                {TRANSITION_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => onUpdateTransition(index, t.value, item.transitionDuration)}
                    className={`flex flex-col gap-1.5 p-3 rounded-2xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${item.transitionType === t.value
                        ? "border-primary/60 bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.15)] ring-1 ring-primary/30"
                        : "border-border/40 hover:border-primary/30 bg-surface-2/30"
                      }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-base leading-none" style={{ color: t.color }}>{t.icon}</span>
                      {item.transitionType === t.value && <Check className="w-3 h-3 text-primary" />}
                    </div>
                    <span className="text-[11px] font-bold leading-tight truncate">{t.label}</span>
                    <p className="text-[9px] text-muted-foreground leading-tight line-clamp-2">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {item.transitionType !== "cut" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Thời lượng
                  </label>
                  <span className="text-xs font-mono font-bold text-primary">{(item.transitionDuration / 1000).toFixed(1)}s</span>
                </div>
                <input
                  type="range" min={500} max={5000} step={100}
                  value={item.transitionDuration}
                  onChange={e => onUpdateTransition(index, item.transitionType, parseInt(e.target.value))}
                  className="w-full h-1 rounded-full accent-primary cursor-pointer bg-white/10"
                />
                <div className="flex justify-between text-[9px] text-muted-foreground/40 font-mono">
                  <span>0.5s</span><span>2.5s</span><span>5.0s</span>
                </div>
              </div>
            )}

            {/* Presets */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Preset nhanh</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: "Quick Cut", type: "cut" as TransitionType, dur: 100 },
                  { label: "DJ Smooth", type: "crossfade" as TransitionType, dur: 2500 },
                  { label: "Drop", type: "build-drop" as TransitionType, dur: 3000 },
                  { label: "Scratch", type: "vinyl-scratch" as TransitionType, dur: 1500 },
                ].map(p => (
                  <button
                    key={p.label}
                    onClick={() => onUpdateTransition(index, p.type, p.dur)}
                    className="py-1.5 px-2 rounded-lg bg-surface-2/50 border border-border/40 hover:border-primary/50 hover:text-primary text-[11px] font-semibold transition-all text-left"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── AI TAB ── */}
        {tab === "ai" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">AI gợi ý shorts phù hợp</p>
            {isLoadingSuggestions ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : suggestions.length > 0 ? (
              suggestions.map(short => {
                const isPlaying = playingShortId === short._id;
                return (
                  <div key={short._id} className="flex items-center gap-2.5 p-2 rounded-xl border border-border/30 hover:bg-surface-2/50 transition-all group">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 cursor-pointer" onClick={e => playShort(e, short)}>
                      <ImageWithFallback src={short.track?.coverImage} className="w-full h-full object-cover" />
                      <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                        {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{short.track?.title}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${(short as any).compatibilityScore || 80}%`, maxWidth: "70px" }} />
                        <span className="text-[9px] text-emerald-500 font-bold">{(short as any).compatibilityScore || 80}%</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onAddSuggestion(short)}
                      className="p-1.5 bg-background hover:bg-primary hover:text-white border border-border/50 rounded-lg transition-all shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center py-8 text-muted-foreground opacity-40">
                <Wand2 className="w-8 h-8 mb-2" />
                <p className="text-xs">Thêm shorts để AI gợi ý</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Energy Curve ─────────────────────────────────────────────────────────────
const EnergyCurve = ({ shorts }: { shorts: IMashupShort[] }) => {
  if (shorts.length < 2) return null;
  const energies = shorts.map((_, i) => Math.max(0.1, Math.abs(Math.sin(i * 1.5) * 0.5 + Math.cos(i * 2.7) * 0.25 + 0.4)));
  const pts = energies.map((e, i) => {
    const x = (i / (energies.length - 1)) * 100;
    const y = 100 - e * 100;
    return `${x},${y}`;
  });
  const pathD = `M ${pts.join(" L ")}`;
  return (
    <div className="px-3 sm:px-4 py-2 border-t border-border/30">
      <div className="flex items-center gap-1.5 mb-1">
        <Zap className="w-3 h-3 text-amber-400" />
        <span className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-wider">Energy</span>
      </div>
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-6">
        <defs>
          <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M 0,30 L ${pts.join(" L ")} L 100,30 Z`} fill="url(#eg)" />
        <path d={pathD} stroke="#f59e0b" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {energies.map((e, i) => (
          <circle key={i} cx={(i / (energies.length - 1)) * 100} cy={(1 - e) * 30} r="2" fill="#f59e0b" />
        ))}
      </svg>
    </div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export const MashupBuilderPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const bp = useBreakpoint();

  const {
    shorts, title, setTitle, description, setDescription,
    totalDuration, addShort, removeShort, reorderShorts,
    updateTransition, updateVolume, updateTrim, setShorts,
  } = useMashupBuilder();

  const createMashup = useCreateMashup();
  const suggestShorts = useSuggestShorts();
  const [suggestions, setSuggestions] = useState<ITrackShort[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Mobile panel state: "library" | "timeline" | "inspector"
  const [mobilePanel, setMobilePanel] = useState<"library" | "timeline" | "inspector">("timeline");
  const [showLibrarySidebar, setShowLibrarySidebar] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(false); // tablet bottom sheet

  // Audio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingShortId, setPlayingShortId] = useState<string | null>(null);

  // Preview
  const { isPlaying: isPreviewing, currentIndex: previewIndex, togglePlay: togglePreview, stop: stopPreview } = useMashupPreview(shorts);
  const [hasInitAi, setHasInitAi] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!hasInitAi && location.state?.aiGeneratedShorts) {
      const aiShorts = location.state.aiGeneratedShorts.map((short: ITrackShort, i: number) => ({
        short, order: i, transitionType: "crossfade" as const, transitionDuration: 2000,
      }));
      setShorts(aiShorts);
      setHasInitAi(true);
      toast.success("AI đã tạo xong mashup! Nhấn Preview để nghe thử.");
    }
  }, [location.state, hasInitAi, setShorts]);

  const { data: shortsData, isLoading: isLoadingShorts } = useShorts({ limit: 50, search: searchQuery });
  const availableShorts: ITrackShort[] = shortsData?.data?.data || [];
  const addedIds = new Set(shorts.map(s => s.short._id));

  // AI suggestions
  useEffect(() => {
    if (shorts.length === 0) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await suggestShorts.mutateAsync(shorts.map(s => s.short._id));
        if (res.success) setSuggestions(res.data);
      } catch { }
    }, 1000);
    return () => clearTimeout(t);
  }, [shorts]);

  useEffect(() => () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    stopPreview();
  }, [stopPreview]);

  const handlePlayShort = useCallback((e: React.MouseEvent, short: ITrackShort) => {
    e.stopPropagation();
    if (isPreviewing) stopPreview();
    if (playingShortId === short._id) {
      audioRef.current?.pause();
      setPlayingShortId(null);
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    audio.pause();
    audio.src = short.track?.trackUrl || "";
    const s = short.startTime > 10000 ? short.startTime / 1000 : short.startTime;
    const e2 = short.endTime > 10000 ? short.endTime / 1000 : short.endTime;
    audio.currentTime = s || 0;
    audio.ontimeupdate = () => { if (e2 && audio.currentTime >= e2) { audio.pause(); setPlayingShortId(null); } };
    audio.onended = () => setPlayingShortId(null);
    audio.play().then(() => setPlayingShortId(short._id)).catch(() => { toast.error("Lỗi phát audio"); setPlayingShortId(null); });
  }, [isPreviewing, stopPreview, playingShortId]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = shorts.findIndex(s => s.short._id === active.id);
      const newIdx = shorts.findIndex(s => s.short._id === over.id);
      reorderShorts(oldIdx, newIdx);
      if (selectedIndex === oldIdx) setSelectedIndex(newIdx);
    }
  };

  const handleSave = async (isPublished: boolean) => {
    if (!title.trim()) return toast.error("Vui lòng nhập tiêu đề");
    if (totalDuration < MASHUP_MIN_DURATION) return toast.error("Mashup cần ít nhất 1 phút");
    if (totalDuration > MASHUP_MAX_DURATION) return toast.error("Mashup vượt quá 7 phút");
    try {
      await createMashup.mutateAsync({
        title, description, isPublished,
        shorts: shorts.map(s => ({
          short: s.short._id, order: s.order,
          transitionType: s.transitionType, transitionDuration: s.transitionDuration,
        })),
      });
      toast.success(isPublished ? "✅ Đã đăng Mashup!" : "💾 Đã lưu bản nháp!");
      navigate("/mashups/feed");
    } catch { toast.error("Lỗi khi lưu Mashup"); }
  };

  const selectedItem = selectedIndex !== null ? shorts[selectedIndex] : null;

  const isMobile = bp === "mobile";

  // ── Header ────────────────────────────────────────────────────────────────
  const Header = (
    <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-3 border-b border-border/50 bg-surface-1/60 backdrop-blur shrink-0">
      {/* Back btn (mobile) */}
      {isMobile && (
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-surface-2/60 text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
        </button>
      )}
      {/* Logo + title */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="p-1.5 bg-primary/15 rounded-lg">
          <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        </div>
        {!isMobile && <span className="font-black font-display text-sm sm:text-base tracking-tight whitespace-nowrap">Mashup Studio</span>}
      </div>

      {!isMobile && <div className="h-5 w-px bg-border/40 mx-1" />}

      {/* Title input */}
      <input
        type="text"
        placeholder={isMobile ? "Tên mashup..." : "Nhập tên Mashup của bạn..."}
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="flex-1 min-w-0 bg-transparent text-sm font-semibold outline-none border-b border-transparent focus:border-primary/50 pb-0.5 transition-colors placeholder:text-muted-foreground/40"
      />

      {/* Duration chip */}
      <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold border shrink-0 transition-all ${totalDuration >= MASHUP_MIN_DURATION && totalDuration <= MASHUP_MAX_DURATION
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
          : totalDuration > MASHUP_MAX_DURATION
            ? "bg-red-500/10 border-red-500/30 text-red-400"
            : "bg-surface-2 border-border/40 text-muted-foreground"
        }`}>
        <Clock className="w-3 h-3" />
        {formatMashupDuration(totalDuration)}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {!isMobile && (
          <button
            onClick={() => handleSave(false)}
            disabled={createMashup.isPending || totalDuration < MASHUP_MIN_DURATION}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 hover:bg-surface-2/60 transition-all disabled:opacity-40 text-xs sm:text-sm"
          >
            <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden md:inline">Bản nháp</span>
          </button>
        )}
        <button
          onClick={() => handleSave(true)}
          disabled={createMashup.isPending || totalDuration < MASHUP_MIN_DURATION || totalDuration > MASHUP_MAX_DURATION}
          className="flex items-center gap-1.5 px-3 sm:px-5 py-1.5 rounded-lg sm:rounded-xl bg-primary text-primary-foreground font-bold hover:brightness-110 transition-all disabled:opacity-40 text-xs sm:text-sm shadow-lg shadow-primary/20"
        >
          {createMashup.isPending
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          }
          <span>{isMobile ? "Đăng" : "Đăng lên"}</span>
        </button>
      </div>
    </div>
  );

  // ── MOBILE LAYOUT ─────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="relative flex flex-col bg-background text-foreground" style={{ height: "100dvh" }}>
        {Header}

        {/* Panel content */}
        <div className="flex-1 overflow-hidden min-h-0">
          <AnimatePresence mode="wait">
            {mobilePanel === "library" && (
              <motion.div key="library" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full">
                <LibraryPanel
                  search={searchQuery} setSearch={setSearchQuery}
                  shorts={availableShorts} isLoading={isLoadingShorts}
                  addedIds={addedIds} totalDuration={totalDuration}
                  onAdd={short => { addShort(short); setMobilePanel("timeline"); }}
                  onPlay={handlePlayShort} playingId={playingShortId}
                />
              </motion.div>
            )}

            {mobilePanel === "timeline" && (
              <motion.div key="timeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-surface-2/10 shrink-0">
                  <span className="text-xs font-semibold text-muted-foreground">{shorts.length} tracks</span>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() => { if (playingShortId) { audioRef.current?.pause(); setPlayingShortId(null); } togglePreview(); }}
                      disabled={shorts.length === 0}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 ${isPreviewing ? "bg-primary/20 text-primary border border-primary/40" : "bg-surface-2/60 border border-border/40"
                        }`}
                    >
                      {isPreviewing ? <><Square className="w-3.5 h-3.5 fill-current" /> Stop</> : <><Play className="w-3.5 h-3.5 fill-current" /> Preview</>}
                    </button>
                  </div>
                </div>

                {/* Vertical track list */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0">
                  {shorts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <ListMusic className="w-7 h-7 text-primary/50" />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-base text-foreground">Timeline trống</p>
                        <p className="text-sm text-muted-foreground mt-1 opacity-60">Nhấn "Kho nhạc" để thêm shorts</p>
                      </div>
                      <button
                        onClick={() => setMobilePanel("library")}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-sm"
                      >
                        <Plus className="w-4 h-4" /> Thêm Short
                      </button>
                    </div>
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={shorts.map(s => s.short._id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-0">
                          {shorts.map((item, index) => (
                            <TrackCard
                              key={item.short._id} item={item} index={index} total={shorts.length}
                              isSelected={selectedIndex === index}
                              isPreviewing={isPreviewing && previewIndex === index}
                              isAudioPlaying={playingShortId === item.short._id}
                              layout="vertical"
                              onSelect={() => { setSelectedIndex(index === selectedIndex ? null : index); setMobilePanel("inspector"); }}
                              onRemove={() => { removeShort(index); if (selectedIndex === index) setSelectedIndex(null); }}
                              onPlay={e => handlePlayShort(e, item.short)}
                              stopPreview={stopPreview}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>

                {/* Energy + Duration bars */}
                <div className="shrink-0 border-t border-border/40">
                  <EnergyCurve shorts={shorts} />
                  <DurationBar totalDuration={totalDuration} />
                </div>
              </motion.div>
            )}

            {mobilePanel === "inspector" && (
              <motion.div key="inspector" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="h-full">
                <InspectorPanel
                  item={selectedItem} index={selectedIndex ?? 0}
                  onUpdateTransition={updateTransition} onUpdateVolume={updateVolume} onUpdateTrim={updateTrim}
                  suggestions={suggestions} onAddSuggestion={addShort}
                  isLoadingSuggestions={suggestShorts.isPending}
                  playShort={handlePlayShort} playingShortId={playingShortId}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile bottom nav */}
        <div className="flex border-t border-border/40 bg-surface-1/90 backdrop-blur shrink-0 safe-area-pb">
          {([
            { id: "library", icon: Library, label: "Kho nhạc" },
            { id: "timeline", icon: ListMusic, label: "Timeline" },
            { id: "inspector", icon: SlidersHorizontal, label: "Chỉnh sửa" },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setMobilePanel(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-all ${mobilePanel === tab.id ? "text-primary" : "text-muted-foreground"
                }`}
            >
              <tab.icon className={`w-5 h-5 ${mobilePanel === tab.id ? "" : "opacity-60"}`} />
              <span className="text-[10px] font-semibold">{tab.label}</span>
              {tab.id === "timeline" && shorts.length > 0 && (
                <span className="absolute -top-1 right-1/2 translate-x-5 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-black flex items-center justify-center">
                  {shorts.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── TABLET LAYOUT ─────────────────────────────────────────────────────────
  if (bp === "tablet") {
    return (
      <div className="relative flex flex-col bg-background text-foreground" style={{ height: "100dvh" }}>
        {Header}

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Library sidebar (collapsible) */}
          <AnimatePresence>
            {showLibrarySidebar && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 240, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="flex flex-col border-r border-border/40 bg-surface-1/60 shrink-0 overflow-hidden"
              >
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40 bg-surface-2/20">
                  <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5" /> Kho Shorts
                  </span>
                  <button onClick={() => setShowLibrarySidebar(false)} className="text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
                <LibraryPanel
                  search={searchQuery} setSearch={setSearchQuery}
                  shorts={availableShorts} isLoading={isLoadingShorts}
                  addedIds={addedIds} totalDuration={totalDuration}
                  onAdd={addShort} onPlay={handlePlayShort} playingId={playingShortId}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Toggle button */}
          {!showLibrarySidebar && (
            <button
              onClick={() => setShowLibrarySidebar(true)}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-30 flex items-center gap-1 bg-primary/20 border border-primary/40 text-primary rounded-r-xl py-3 px-1.5 hover:bg-primary/30 transition-all shadow-md"
            >
              <Music className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Timeline (vertical) */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 shrink-0 bg-surface-2/10">
              <span className="text-xs font-semibold text-muted-foreground">Timeline • {shorts.length} tracks</span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => { if (playingShortId) { audioRef.current?.pause(); setPlayingShortId(null); } togglePreview(); }}
                  disabled={shorts.length === 0}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 ${isPreviewing ? "bg-primary/20 text-primary border border-primary/40" : "bg-surface-2/60 border border-border/40"
                    }`}
                >
                  {isPreviewing ? <><Square className="w-3.5 h-3.5 fill-current" /> Stop Preview</> : <><Play className="w-3.5 h-3.5 fill-current" /> Preview</>}
                </button>
                <button
                  onClick={() => setInspectorOpen(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${inspectorOpen ? "bg-primary/15 text-primary border-primary/40" : "border-border/40 text-muted-foreground"
                    }`}
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Inspector
                </button>
              </div>
            </div>

            {/* Track list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0">
              {shorts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Layers className="w-7 h-7 text-primary/50" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center opacity-60">Chọn shorts từ Kho bên trái để bắt đầu</p>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={shorts.map(s => s.short._id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-0">
                      {shorts.map((item, index) => (
                        <TrackCard
                          key={item.short._id} item={item} index={index} total={shorts.length}
                          isSelected={selectedIndex === index}
                          isPreviewing={isPreviewing && previewIndex === index}
                          isAudioPlaying={playingShortId === item.short._id}
                          layout="vertical"
                          onSelect={() => { setSelectedIndex(index === selectedIndex ? null : index); if (!inspectorOpen) setInspectorOpen(true); }}
                          onRemove={() => { removeShort(index); if (selectedIndex === index) setSelectedIndex(null); }}
                          onPlay={e => handlePlayShort(e, item.short)}
                          stopPreview={stopPreview}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            <div className="shrink-0 border-t border-border/40">
              <EnergyCurve shorts={shorts} />
              <DurationBar totalDuration={totalDuration} />
              {/* Description */}
              <div className="px-4 py-2 border-t border-border/20 bg-background/50">
                <textarea
                  placeholder="Mô tả mashup (tùy chọn)..."
                  value={description}
                  onChange={e => {
                    setDescription(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  rows={1}
                  className="w-full bg-transparent text-xs outline-none resize-none placeholder:text-muted-foreground/40 text-foreground overflow-hidden"
                  style={{ minHeight: '24px' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Inspector Bottom Sheet (tablet) */}
        <AnimatePresence>
          {inspectorOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 z-40 backdrop-blur-sm"
                onClick={() => setInspectorOpen(false)}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="absolute bottom-0 left-0 right-0 z-50 bg-background border-t border-border/50 rounded-t-3xl shadow-2xl"
                style={{ maxHeight: "70vh" }}
              >
                {/* Handle */}
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                  <div className="w-10 h-1 rounded-full bg-border mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
                  <span className="text-sm font-bold flex items-center gap-2 pt-4">
                    <Settings2 className="w-4 h-4 text-primary" />
                    Inspector {selectedItem && `— ${selectedItem.short.track?.title}`}
                  </span>
                  <button onClick={() => setInspectorOpen(false)} className="p-1.5 rounded-lg hover:bg-surface-2/60 pt-4">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div style={{ height: "calc(70vh - 60px)", overflowY: "auto" }}>
                  <InspectorPanel
                    item={selectedItem} index={selectedIndex ?? 0}
                    onUpdateTransition={updateTransition} onUpdateVolume={updateVolume} onUpdateTrim={updateTrim}
                    suggestions={suggestions} onAddSuggestion={addShort}
                    isLoadingSuggestions={suggestShorts.isPending}
                    playShort={handlePlayShort} playingShortId={playingShortId}
                  />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── DESKTOP LAYOUT (3-panel DAW) ──────────────────────────────────────────
  return (
    <div className="relative section-container space-y-6 sm:space-y-8 flex flex-col bg-background text-foreground overflow-hidden" style={{ height: "100dvh" }}>
      {Header}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Library Panel */}
        <AnimatePresence>
          {showLibrarySidebar && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="flex flex-col border-r border-border/40 bg-surface-1/60 backdrop-blur shrink-0 overflow-hidden"
            >
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40 bg-surface-2/20 shrink-0">
                <span className="text-sm font-bold flex items-center gap-2">
                  <Music className="w-4 h-4 text-primary" /> Kho Shorts
                </span>
                <button onClick={() => setShowLibrarySidebar(false)} className="text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
              <LibraryPanel
                search={searchQuery} setSearch={setSearchQuery}
                shorts={availableShorts} isLoading={isLoadingShorts}
                addedIds={addedIds} totalDuration={totalDuration}
                onAdd={addShort} onPlay={handlePlayShort} playingId={playingShortId}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {!showLibrarySidebar && (
          <button
            onClick={() => setShowLibrarySidebar(true)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1 bg-surface-2/80 border border-border/50 text-muted-foreground rounded-r-xl py-3 px-1.5 hover:bg-primary/15 hover:text-primary hover:border-primary/40 transition-all shadow-md"
          >
            <Music className="w-3.5 h-3.5" />
            <span className="text-[8px] font-bold uppercase tracking-wide writing-mode-vertical">Kho</span>
          </button>
        )}

        {/* Timeline */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 bg-surface-2/10 shrink-0">
            <span className="text-xs font-bold text-muted-foreground">Timeline</span>
            <span className="text-[10px] text-muted-foreground/60 bg-surface-2/40 px-2 py-0.5 rounded-full">{shorts.length} track{shorts.length !== 1 ? "s" : ""}</span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => { if (playingShortId) { audioRef.current?.pause(); setPlayingShortId(null); } togglePreview(); }}
                disabled={shorts.length === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 ${isPreviewing ? "bg-primary/20 text-primary border border-primary/40" : "bg-surface-2/50 border border-border/40 hover:border-primary/30"
                  }`}
              >
                {isPreviewing ? <><Square className="w-3.5 h-3.5 fill-current" /> Dừng Preview</> : <><Play className="w-3.5 h-3.5 fill-current" /> Preview Mashup</>}
              </button>
            </div>
          </div>

          {/* Horizontal timeline (desktop DAW) */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden bg-gradient-to-b from-surface-1/30 to-surface-1/10 relative">
            {shorts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Layers className="w-8 h-8 text-primary/50" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-base text-foreground">Bắt đầu tạo Mashup</p>
                  <p className="text-sm text-muted-foreground mt-1 opacity-60">Chọn Shorts từ Kho bên trái và kéo thả vào đây</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start p-5 gap-0 h-full min-w-max">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={shorts.map(s => s.short._id)} strategy={horizontalListSortingStrategy}>
                    {shorts.map((item, index) => (
                      <TrackCard
                        key={item.short._id} item={item} index={index} total={shorts.length}
                        isSelected={selectedIndex === index}
                        isPreviewing={isPreviewing && previewIndex === index}
                        isAudioPlaying={playingShortId === item.short._id}
                        layout="horizontal"
                        onSelect={() => setSelectedIndex(index === selectedIndex ? null : index)}
                        onRemove={() => { removeShort(index); if (selectedIndex === index) setSelectedIndex(null); }}
                        onPlay={e => handlePlayShort(e, item.short)}
                        stopPreview={stopPreview}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                {/* Add more */}
                <div className="flex items-center pl-3">
                  <button
                    onClick={() => setShowLibrarySidebar(true)}
                    className="w-12 h-24 rounded-xl border-2 border-dashed border-border/40 hover:border-primary/50 hover:bg-primary/5 flex items-center justify-center text-muted-foreground hover:text-primary transition-all"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom strips */}
          <div className="border-t border-border/40 bg-surface-2/10 shrink-0">
            <EnergyCurve shorts={shorts} />
            <DurationBar totalDuration={totalDuration} />
          </div>

          {/* Description */}
          <div className="border-t border-border/20 px-5 py-3 shrink-0 bg-background/50">
            <textarea
              placeholder="Mô tả mashup (tùy chọn)..."
              value={description}
              onChange={e => {
                setDescription(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              rows={1}
              className="w-full bg-transparent text-xs outline-none resize-none placeholder:text-muted-foreground/40 text-foreground overflow-hidden"
              style={{ minHeight: '24px' }}
            />
          </div>
        </div>

        {/* Inspector Panel */}
        <div className="w-60 xl:w-64 shrink-0 border-l border-border/40 bg-surface-1/60 backdrop-blur flex flex-col overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border/40 bg-surface-2/20 shrink-0">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-primary" /> Inspector
            </h2>
          </div>
          <div className="flex-1 overflow-hidden">
            <InspectorPanel
              item={selectedItem} index={selectedIndex ?? 0}
              onUpdateTransition={updateTransition} onUpdateVolume={updateVolume} onUpdateTrim={updateTrim}
              suggestions={suggestions} onAddSuggestion={addShort}
              isLoadingSuggestions={suggestShorts.isPending}
              playShort={handlePlayShort} playingShortId={playingShortId}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
