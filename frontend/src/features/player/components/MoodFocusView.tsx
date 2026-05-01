import { useRef, useEffect, useState, useMemo, useCallback, memo } from "react";
import { VideoMoodEngine } from "./VideoMoodEngine";
import { MoodLyricLine, type MoodWord } from "./MoodLyricLine";
import { ITrack } from "@/features";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES — compatible với IKaraokeLine / ILyricSyncLine từ @/features
// (re-declared locally để tránh tight coupling, duck-typed)
// ─────────────────────────────────────────────────────────────────────────────

export interface MoodSyncLine {
  /** ms */
  startTime: number;
  /** ms */
  endTime: number;
  text: string;
}

export interface MoodKaraokeLine {
  /** ms */
  start: number;
  /** ms */
  end: number;
  text: string;
  words?: MoodWord[];
}

/** Union — accept either shape */
export type MoodLine = MoodSyncLine | MoodKaraokeLine;

function isSyncLine(l: MoodLine): l is MoodSyncLine {
  return "startTime" in l;
}

function toUnified(l: MoodLine): {
  start: number;
  end: number;
  text: string;
  words?: MoodWord[];
} {
  if (isSyncLine(l)) {
    return { start: l.startTime, end: l.endTime, text: l.text };
  }
  return { start: l.start, end: l.end, text: l.text, words: l.words };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MIN_WORD_MS = 80;
const QUALITY_THRESH = 0.7;

// ─────────────────────────────────────────────────────────────────────────────
// useRafTime — port từ LyricsView v2 (BUG-1 fix: freeze khi pause)
// ─────────────────────────────────────────────────────────────────────────────

function useRafTime(currentTime: number, isPlaying: boolean): number {
  const [rafMs, setRafMs] = useState(() => currentTime * 1000);
  const base = useRef({
    audioMs: currentTime * 1000,
    wallMs: performance.now(),
  });
  const rafId = useRef(0);
  const playing = useRef(isPlaying);

  useEffect(() => {
    base.current = { audioMs: currentTime * 1000, wallMs: performance.now() };
    if (!isPlaying) setRafMs(currentTime * 1000);
  }, [currentTime, isPlaying]);

  useEffect(() => {
    playing.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const tick = () => {
      if (playing.current) {
        const { audioMs, wallMs } = base.current;
        setRafMs(audioMs + (performance.now() - wallMs));
      }
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  return rafMs;
}

// ─────────────────────────────────────────────────────────────────────────────
// bsearch — port từ LyricsView v2 (BUG-4 fix: gap → last-past, không -1)
// ─────────────────────────────────────────────────────────────────────────────

function bsearch(
  items: Array<{ start: number; end: number }>,
  ms: number,
): number {
  let lo = 0,
    hi = items.length - 1,
    best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ms >= items[mid].start && ms <= items[mid].end) return mid;
    if (ms < items[mid].start) {
      hi = mid - 1;
    } else {
      best = mid;
      lo = mid + 1;
    }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// sanitizeWords — tương tự sanitizeKaraokeLines nhưng chỉ cho words[]
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeWords(
  words: MoodWord[],
  lineStart: number,
  lineEnd: number,
): MoodWord[] {
  if (!words.length) return words;

  // 1. Clamp
  const clamped = words.map((w) => ({
    word: w.word,
    startTime: Math.max(lineStart, Math.min(lineEnd - 1, w.startTime)),
    endTime: Math.max(lineStart + 1, Math.min(lineEnd, w.endTime)),
  }));

  // 2. Sort
  clamped.sort((a, b) => a.startTime - b.startTime);

  // 3. Ensure start < end
  for (const w of clamped) {
    if (w.endTime <= w.startTime) w.endTime = w.startTime + 1;
  }

  // 4. Merge short words
  const merged: typeof clamped = [];
  for (const w of clamped) {
    if (w.endTime - w.startTime < MIN_WORD_MS && merged.length > 0) {
      const prev = merged[merged.length - 1];
      merged[merged.length - 1] = {
        word: prev.word + " " + w.word,
        startTime: prev.startTime,
        endTime: w.endTime,
      };
    } else {
      merged.push({ ...w });
    }
  }

  // 5. Chain end times
  for (let i = 0; i < merged.length - 1; i++) {
    merged[i].endTime = merged[i + 1].startTime;
  }
  if (merged.length) merged[merged.length - 1].endTime = lineEnd;

  return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// ITrack shape (duck-typed)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface MoodFocusViewProps {
  lyrics: MoodLine[] | null;
  loading: boolean;
  track: ITrack;
  /** Current audio position in SECONDS */
  currentTime: number;
  /** TRUE khi audio đang phát — bắt buộc để rAF freeze đúng */
  isPlaying: boolean;
  /** Accent color for fill and breath overlay */
  accentColor?: string;
  /** 0–1; < 0.7 → degraded (no word fill) */
  qualityScore?: number;
  /** Callback nhận GIÂY */
  onSeek?: (timeS: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const MoodFocusView = memo(
  ({
    lyrics,
    loading,
    track,
    currentTime,
    isPlaying,
    accentColor = "primary",
    qualityScore = 1,
    onSeek,
  }: MoodFocusViewProps) => {
    // rAF-interpolated time — đồng bộ 60fps, freeze khi pause
    const rafMs = useRafTime(currentTime, isPlaying);
    const degraded = qualityScore < QUALITY_THRESH;

    // Normalize lyrics to unified shape
    const unified = useMemo(() => {
      if (!lyrics) return [];
      return lyrics.map(toUnified);
    }, [lyrics]);

    // Sanitize words once per lyrics reference
    const sanitized = useMemo(
      () =>
        unified.map((line) => ({
          ...line,
          words: line.words
            ? sanitizeWords(line.words, line.start, line.end)
            : undefined,
        })),
      [unified],
    );

    // Current line index — gap-safe (best=-1 only before first line)
    const currentIndex = useMemo(
      () => bsearch(sanitized, rafMs),
      [sanitized, rafMs],
    );

    const currentLine = currentIndex >= 0 ? sanitized[currentIndex] : null;

    // beatKey — index of word currently sung → drives beat pulse in MoodLyricLine
    const beatKey = useMemo(() => {
      if (!currentLine?.words?.length) return -1;
      return currentLine.words.findIndex(
        (w) => rafMs >= w.startTime && rafMs < w.endTime,
      );
    }, [currentLine, rafMs]);

    // Detect karaoke mode: has words
    const hasWords = Boolean(currentLine?.words?.length && !degraded);
    const lyricMode = hasWords ? "karaoke" : "synced";

    const handleSeek = useCallback(
      (timeS: number) => onSeek?.(timeS),
      [onSeek],
    );

    // ── Empty / loading ──────────────────────────────────────────────────────

    if (loading || !lyrics || lyrics.length === 0) {
      return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <VideoMoodEngine
            src={track.moodVideo?.videoUrl}
            isPlaying={isPlaying}
            accentColor={accentColor}
            opacity={0.55}
          />
        </div>
      );
    }

    // ── Full view ────────────────────────────────────────────────────────────

    return (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          background: "transparent",
          borderRadius: "inherit",
          willChange: "transform",
        }}
        aria-label="Mood focus view"
      >
        {/* LAYER 1 — Video background */}
        <VideoMoodEngine
          src={track.moodVideo?.videoUrl}
          isPlaying={isPlaying}
          accentColor={accentColor}
          opacity={0.78}
        />

        {/* LAYER 2 — Lyric: 1 line, word fill, beat pulse */}
        <MoodLyricLine
          currentText={currentLine?.text ?? ""}
          currentWords={currentLine?.words}
          rafMs={rafMs}
          currentIndex={currentIndex}
          currentStartTimeMs={currentLine?.start}
          beatKey={beatKey}
          accentColor={accentColor}
          degraded={degraded}
          mode={lyricMode}
          onSeek={onSeek ? handleSeek : undefined}
        />
      </div>
    );
  },
);

MoodFocusView.displayName = "MoodFocusView";
export default MoodFocusView;
