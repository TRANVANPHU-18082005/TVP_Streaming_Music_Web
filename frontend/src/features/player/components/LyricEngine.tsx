import {
  useRef,
  useEffect,
  memo,
  useMemo,
  useCallback,
  useState,
  createContext,
  useContext,
} from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { IKaraokeLine, ILyricSyncLine, LyricType } from "@/features";

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface LyricsViewProps {
  lyricType: LyricType;
  plainLyrics?: string;
  syncedLines?: ILyricSyncLine[];
  karaokeLines?: IKaraokeLine[];
  /** Current audio position in SECONDS */
  currentTime: number;
  isPlaying: boolean;
  onSeek?: (seconds: number) => void;
  loading?: boolean;
  accentColor?: string;
  /** 0–1; dưới 0.7 → degraded mode */
  qualityScore?: number;
  focusRadius?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STYLE_ID = "__lv3-styles__";
const MIN_WORD_MS = 80;
const INSTRUMENTAL_GAP = 5000;
const COUNTDOWN_GAP = 2000;
const QUALITY_THRESH = 0.7;

// ─────────────────────────────────────────────────────────────────────────────
// FONT SIZE CACHE — PERF-6: không tạo string mới mỗi render
// ─────────────────────────────────────────────────────────────────────────────

const fontSizeCache = new Map<string, string>();
function calcFontSize(len: number, active: boolean): string {
  const key = `${len}:${active}`;
  if (fontSizeCache.has(key)) return fontSizeCache.get(key)!;
  let size: string;
  if (len <= 15) size = active ? "2.2rem" : "2rem";
  else if (len <= 25) size = active ? "1.95rem" : "1.8rem";
  else if (len <= 38) size = active ? "1.7rem" : "1.55rem";
  else size = active ? "1.45rem" : "1.35rem";
  fontSizeCache.set(key, size);
  return size;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS — PERF-5: inject synchronously, không qua useEffect
// ─────────────────────────────────────────────────────────────────────────────

const LYRICS_CSS = `
.lv-scroll {
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 8%,
    black 90%,
    transparent 100%
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 8%,
    black 90%,
    transparent 100%
  );
}
.lv-scroll::-webkit-scrollbar { display: none; }

.lv-ambient {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 0;
  will-change: opacity;
  transition: opacity 1.2s ease;
}

 .lv-plain {
  color: hsl(var(--foreground) / 0.75);
  font-size: 1rem;
  line-height: 1.9;
  white-space: pre-wrap;
  padding: 1.5rem 1.75rem;
  user-select: text;
 }

/* ── synced lines ── */
.sv-line {
  padding: 0.45rem 0;
  cursor: pointer;
  will-change: transform, opacity;
  transform-origin: left center;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  /* Single transition — cheaper than split property transitions */
  transition:
    transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.32s ease,
    color 0.24s ease;
  contain: layout style; /* PERF: limit paint scope */
}
.sv-line:focus-visible {
  outline: 2px solid var(--lv-accent, rgba(79,172,254,0.6));
  outline-offset: 4px;
  border-radius: 4px;
}
.sv-line--current { transform: scale(1.05);  opacity: 1;    color: var(--color-primary); text-shadow: 0 0 28px var(--lv-accent-glow, hsl(var(--wave-2) / 0.35)); }
.sv-line--near1   { transform: scale(1.00);  opacity: .52;  color: hsl(var(--foreground) / 0.52); }
.sv-line--near2   { transform: scale(.98);   opacity: .26;  color: hsl(var(--foreground) / 0.26); }
.sv-line--far     { transform: scale(.96);   opacity: .1;   color: hsl(var(--foreground) / 0.1); }
.sv-line--hidden  { transform: scale(.94);   opacity: 0;    pointer-events: none; }
@media (hover: hover) {
  .sv-line:not(.sv-line--current):not(.sv-line--hidden):hover {
    opacity: .6;
    transform: scale(1.01);
  }
}
.sv-line:active { transform: scale(.97) !important; transition-duration: .06s !important; }

/* ── karaoke word ── */
.kv-word {
  position: relative;
  display: inline-block;
  margin-right: 0.28em;
  font-weight: 900;
  letter-spacing: -0.01em;
  vertical-align: baseline;
  contain: layout style;
}
.kv-word__base {
  display: block;
  color: hsl(var(--foreground) / .18);
  white-space: pre;
  user-select: none;
  transition: color .18s ease, text-shadow .18s ease;
}
.kv-word__fill {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  white-space: pre;
  pointer-events: none;
  /* Gradient: accentColor (via --lv-accent) → white. Falls back to amber-blue if var not set. */
  background: linear-gradient(
    90deg,
    var(--lv-accent, var(--color-accent)) 0%,
    hsl(var(--foreground) / 0.92) 55%,
    var(--color-foreground) 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  /* clip-path driven by --kv-fill; no CSS transition — rAF updates at 60fps */
  clip-path: inset(0 calc(100% - var(--kv-fill, 0%)) 0 0);
  will-change: clip-path;
}
.kv-word--active .kv-word__base {
  color: hsl(var(--foreground) / .5);
  text-shadow: 0 0 20px var(--lv-accent-glow, rgba(79,172,254,.4));
}
.kv-word--backing .kv-word__base { opacity: .4; font-style: italic; }
.kv-word--done .kv-word__fill    { clip-path: inset(0 0 0 0); }

/* degraded: hide per-word fill, highlight whole line */
.kv-degraded .kv-word__fill { display: none; }
.kv-degraded .kv-line--current .kv-word__base { color: var(--color-foreground); }

/* ── karaoke line ── */
.kv-line {
  padding: 0.5rem 0;
  cursor: pointer;
  will-change: transform, opacity;
  transform-origin: left center;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  transition:
    transform 0.34s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.34s ease,
    filter 0.34s ease;
  contain: layout style;
}
.kv-line:focus-visible {
  outline: 2px solid var(--lv-accent, rgba(79,172,254,0.6));
  outline-offset: 4px;
  border-radius: 4px;
}
.kv-line--current      { transform: scale(1.055); opacity: 1;    filter: none; }
.kv-line--near1        { transform: scale(1.005); opacity: .5;   filter: none; }
.kv-line--near2        { transform: scale(.985);  opacity: .26;  filter: blur(.4px); }
.kv-line--far          { transform: scale(.965);  opacity: .1;   filter: blur(.9px); }
.kv-line--hidden       { transform: scale(.945);  opacity: 0;    filter: blur(2px);  pointer-events: none; }
.kv-line--instrumental { opacity: .25; transform: scale(.92); letter-spacing: .45em; cursor: default; pointer-events: none; }
@media (hover: hover) {
  .kv-line:not(.kv-line--current):not(.kv-line--instrumental):not(.kv-line--hidden):hover {
    opacity: .58;
    filter: none;
    transform: scale(1.01);
  }
}
.kv-line:active { transform: scale(.97) !important; transition-duration: .06s !important; }

/* Beat pulse — CSS animation, not JS classList hack */
@keyframes kv-beat {
  0%   { transform: scale(1.055); }
  25%  { transform: scale(1.085); }
  60%  { transform: scale(1.050); }
  100% { transform: scale(1.055); }
}
/* data-beat attribute toggled by rAF — no React re-render needed */
.kv-line--current[data-beat="1"] { animation: kv-beat 0.32s cubic-bezier(0.34,1.56,0.64,1) both; }

/* ── countdown dots ── */
.lv-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1.25rem 0;
}
.lv-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: hsl(var(--foreground) / .2);
  transition: transform .28s ease, background .28s ease, opacity .28s ease;
}
/* data-lit driven by rAF -> no React state */
.lv-dot[data-lit="1"] { transform: scale(2.2); background: var(--lv-accent, var(--color-wave-2)); opacity: 1; box-shadow: 0 0 8px var(--lv-accent, var(--color-wave-2)); }
`;

// Inject CSS synchronously — runs once at module evaluation on client
// PERF-5: không delay bằng useEffect, không FOUC
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = LYRICS_CSS;
  document.head.appendChild(el);
}

// ─────────────────────────────────────────────────────────────────────────────
// RAF TIME REF — PERF-1 + PERF-8: không setState, không React re-render
// rAF loop sống độc lập. Consumers đọc qua ref.
// ─────────────────────────────────────────────────────────────────────────────

interface RafTimeRef {
  ms: number;
  /** Gọi để đăng ký callback nhận update mỗi frame */
  subscribe: (cb: (ms: number) => void) => () => void;
}

function useRafTimeRef(currentTime: number, isPlaying: boolean): RafTimeRef {
  const msRef = useRef(currentTime * 1000);
  const isPlayingRef = useRef(isPlaying);
  const baseRef = useRef({
    audioMs: currentTime * 1000,
    wallMs: performance.now(),
  });
  const subscribers = useRef<Set<(ms: number) => void>>(new Set());

  // Sync base on currentTime/isPlaying change — no state, just ref update
  useEffect(() => {
    baseRef.current = {
      audioMs: currentTime * 1000,
      wallMs: performance.now(),
    };
    if (!isPlaying) {
      msRef.current = currentTime * 1000;
      // Notify subscribers immediately when paused/seeked
      subscribers.current.forEach((cb) => cb(msRef.current));
    }
  }, [currentTime, isPlaying]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Single rAF loop, never recreated
  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      if (isPlayingRef.current) {
        const { audioMs, wallMs } = baseRef.current;
        msRef.current = audioMs + (performance.now() - wallMs);
        subscribers.current.forEach((cb) => cb(msRef.current));
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []); // intentionally empty

  return useMemo(
    () => ({
      get ms() {
        return msRef.current;
      },
      subscribe: (cb: (ms: number) => void) => {
        subscribers.current.add(cb);
        return () => subscribers.current.delete(cb);
      },
    }),
    [],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT — truyền rafTimeRef xuống toàn bộ lyrics tree không qua props
// (tránh prop drilling và re-render cascade)
// ─────────────────────────────────────────────────────────────────────────────

const RafTimeContext = createContext<RafTimeRef | null>(null);
const useRafTime = () => {
  const ctx = useContext(RafTimeContext);
  if (!ctx)
    throw new Error("useRafTime must be used within RafTimeContext.Provider");
  return ctx;
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM SMOOTH SCROLL — rAF-based, ease-in-out cubic, no browser quirks
// ─────────────────────────────────────────────────────────────────────────────

const activeScrolls = new WeakMap<Element, number>();

function smoothScrollTo(el: HTMLElement, target: number, duration = 520): void {
  const start = el.scrollTop;
  const delta = target - start;
  if (Math.abs(delta) < 2) return; // already close enough

  // Cancel any in-progress scroll on this element
  const prev = activeScrolls.get(el);
  if (prev) cancelAnimationFrame(prev);

  const t0 = performance.now();
  // cubic ease-in-out
  const ease = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const tick = (now: number) => {
    const elapsed = Math.min(now - t0, duration);
    const progress = ease(elapsed / duration);
    el.scrollTop = start + delta * progress;
    if (elapsed < duration) {
      const id = requestAnimationFrame(tick);
      activeScrolls.set(el, id);
    } else {
      activeScrolls.delete(el);
    }
  };
  const id = requestAnimationFrame(tick);
  activeScrolls.set(el, id);
}

// ─────────────────────────────────────────────────────────────────────────────
// SANITIZE — PERF-7: stable reference guard
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeKaraokeLines(lines: IKaraokeLine[]): IKaraokeLine[] {
  return lines.map((line) => {
    if (!line.words?.length) return line;

    const clamped = line.words.map((w) => ({
      word: w.word,
      startTime: Math.max(line.start, Math.min(line.end - 1, w.startTime)),
      endTime: Math.max(line.start + 1, Math.min(line.end, w.endTime)),
    }));

    clamped.sort((a, b) => a.startTime - b.startTime);

    for (const w of clamped) {
      if (w.endTime <= w.startTime) w.endTime = w.startTime + 1;
    }

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

    for (let i = 0; i < merged.length - 1; i++) {
      merged[i].endTime = merged[i + 1].startTime;
    }
    if (merged.length > 0) merged[merged.length - 1].endTime = line.end;

    return { ...line, words: merged };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// BSEARCH — returns last-past index in gap (never -1 mid-song)
// ─────────────────────────────────────────────────────────────────────────────

function bsearch<T extends { start: number; end: number }>(
  items: T[],
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
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

interface InstrumentalLine extends IKaraokeLine {
  _instrumental: true;
}
type KDisplayLine = IKaraokeLine | InstrumentalLine;

function buildDisplayLines(lines: IKaraokeLine[]): KDisplayLine[] {
  const out: KDisplayLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    if (
      i < lines.length - 1 &&
      lines[i + 1].start - lines[i].end >= INSTRUMENTAL_GAP
    ) {
      out.push({
        text: "•  •  •",
        start: lines[i].end,
        end: lines[i + 1].start,
        words: [],
        _instrumental: true,
      } as InstrumentalLine);
    }
  }
  return out;
}

interface NormSync {
  start: number;
  end: number;
  text: string;
}
const toNormSync = (lines: ILyricSyncLine[]): NormSync[] =>
  lines.map((l) => ({ start: l.startTime, end: l.endTime, text: l.text }));

// ─────────────────────────────────────────────────────────────────────────────
// COUNTDOWN DOTS — PERF: DOM-driven, không setState per dot
// ─────────────────────────────────────────────────────────────────────────────

const CountdownDots = memo(
  ({ gapStart, gapEnd }: { gapStart: number; gapEnd: number }) => {
    const rafTime = useRafTime();
    const dot0 = useRef<HTMLSpanElement>(null);
    const dot1 = useRef<HTMLSpanElement>(null);
    const dot2 = useRef<HTMLSpanElement>(null);

    useEffect(() => {
      const dots = [dot0.current, dot1.current, dot2.current];
      const thresholds = [0.25, 0.5, 0.75];

      return rafTime.subscribe((ms) => {
        const p = Math.max(
          0,
          Math.min(1, (ms - gapStart) / Math.max(1, gapEnd - gapStart)),
        );
        dots.forEach((dot, i) => {
          if (!dot) return;
          const lit = p >= thresholds[i] ? "1" : "0";
          if (dot.dataset.lit !== lit) dot.dataset.lit = lit;
        });
      });
    }, [rafTime, gapStart, gapEnd]);

    return (
      <div className="lv-dots">
        {[dot0, dot1, dot2].map((ref, i) => (
          <span key={i} ref={ref} className="lv-dot" />
        ))}
      </div>
    );
  },
);
CountdownDots.displayName = "CountdownDots";

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY / LOADING
// ─────────────────────────────────────────────────────────────────────────────

const LyricsEmpty = memo(({ loading }: { loading: boolean }) => (
  <motion.div
    className="h-full flex flex-col items-center justify-center gap-4 select-none"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.4 }}
  >
    {loading ? (
      <div className="flex gap-2 items-end" style={{ height: "2rem" }}>
        {[0.4, 0.7, 1, 0.7, 0.4].map((h, i) => (
          <motion.span
            key={i}
            className="w-1 rounded-full bg-white/35"
            animate={{ scaleY: [h, 1, h] }}
            transition={{
              duration: 0.85,
              repeat: Infinity,
              delay: i * 0.1,
              ease: "easeInOut",
            }}
            style={{ height: "100%", transformOrigin: "bottom" }}
          />
        ))}
      </div>
    ) : (
      <div className="flex flex-col items-center gap-3">
        <div className="size-14 rounded-3xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-foreground/20"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <div className="text-center space-y-1">
          <p className="text-foreground text-[13px] font-semibold">
            Chưa có lời bài hát
          </p>
          <p className="text-foreground text-[11px]">Hãy tận hưởng giai điệu</p>
        </div>
      </div>
    )}
  </motion.div>
));
LyricsEmpty.displayName = "LyricsEmpty";

// ─────────────────────────────────────────────────────────────────────────────
// PLAIN
// ─────────────────────────────────────────────────────────────────────────────

const PlainLyricsView = memo(({ text }: { text: string }) => (
  <div className="lv-scroll h-full">
    <pre
      className="lv-plain"
      style={{ paddingTop: "4rem", paddingBottom: "4rem" }}
    >
      {text}
    </pre>
  </div>
));
PlainLyricsView.displayName = "PlainLyricsView";

// ─────────────────────────────────────────────────────────────────────────────
// SYNCED LINE — PERF-4: no self-scroll, no rafMs prop
// ─────────────────────────────────────────────────────────────────────────────

interface SyncedLineProps {
  line: NormSync;
  index: number;
  currentIndex: number;
  focusRadius: number;
  prevEnd: number | null;
  onSeek: (ms: number) => void;
}

const SyncedLine = memo(
  ({
    line,
    index,
    currentIndex,
    focusRadius,
    prevEnd,
    onSeek,
  }: SyncedLineProps) => {
    const distance = Math.abs(index - currentIndex);
    const isCurrent = index === currentIndex;
    const isHidden = focusRadius > 0 && !isCurrent && distance > focusRadius;

    const tier = isHidden
      ? "sv-line--hidden"
      : isCurrent
        ? "sv-line--current"
        : distance === 1
          ? "sv-line--near1"
          : distance === 2
            ? "sv-line--near2"
            : "sv-line--far";

    const handleClick = useCallback(
      () => onSeek(line.start),
      [onSeek, line.start],
    );
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSeek(line.start);
        }
      },
      [onSeek, line.start],
    );

    const gap = prevEnd !== null ? line.start - prevEnd : 0;
    const showCountdown = prevEnd !== null && gap >= COUNTDOWN_GAP;

    return (
      <>
        {showCountdown && prevEnd !== null && (
          <CountdownDots gapStart={prevEnd} gapEnd={line.start} />
        )}
        <div
          className={cn("sv-line", tier)}
          onClick={handleClick}
          role="button"
          tabIndex={isHidden ? -1 : 0}
          aria-label={`Seek to: ${line.text}`}
          aria-current={isCurrent ? "true" : undefined}
          onKeyDown={handleKeyDown}
        >
          <span
            style={{
              fontSize: calcFontSize(line.text.length, isCurrent),
              fontWeight: 900,
              lineHeight: 1.28,
              letterSpacing: "-0.02em",
            }}
          >
            {line.text}
          </span>
        </div>
      </>
    );
  },
  // Custom comparator: only re-render when tier changes
  (prev, next) => {
    if (prev.currentIndex !== next.currentIndex) return false; // re-render
    if (prev.line !== next.line) return false;
    if (prev.onSeek !== next.onSeek) return false;
    return true;
  },
);
SyncedLine.displayName = "SyncedLine";

// ─────────────────────────────────────────────────────────────────────────────
// SYNCED LYRICS VIEW
// PERF-3: bsearch chạy trong subscribe callback (rAF), không trong render
// PERF-4: scroll từ container, không từ line
// ─────────────────────────────────────────────────────────────────────────────

const SyncedLyricsView = memo(
  ({
    lines,
    onSeek,
    focusRadius,
    accentColor,
  }: {
    lines: NormSync[];
    onSeek: (ms: number) => void;
    focusRadius: number;
    accentColor: string;
  }) => {
    const rafTime = useRafTime();
    const [currentIndex, setCurrentIndex] = useState(() =>
      bsearch(lines, rafTime.ms),
    );
    const currentIndexRef = useRef(currentIndex);
    const scrollRef = useRef<HTMLDivElement>(null);
    const ambientRef = useRef<HTMLDivElement>(null);
    const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

    // rAF subscription — only setState when index changes (≤ 1 update per line)
    useEffect(() => {
      return rafTime.subscribe((ms) => {
        const next = bsearch(lines, ms);
        if (next !== currentIndexRef.current) {
          currentIndexRef.current = next;
          setCurrentIndex(next);
          // Ambient glow — direct DOM, no React re-render
          if (ambientRef.current) {
            ambientRef.current.style.opacity = "0.16";
            setTimeout(() => {
              if (ambientRef.current) ambientRef.current.style.opacity = "0.07";
            }, 600);
          }
        }
      });
    }, [rafTime, lines]);

    // Custom smooth scroll — rAF spring (PERF-4 + iOS fix)
    useEffect(() => {
      if (currentIndex < 0) return;
      const el = lineRefs.current[currentIndex];
      if (!el || !scrollRef.current) return;
      const container = scrollRef.current;
      const target =
        el.offsetTop - container.offsetHeight / 2 + el.offsetHeight / 2;
      smoothScrollTo(container, target, 500);
    }, [currentIndex]);

    return (
      <div
        className="relative h-full"
        style={{
          // Inject accent CSS variables so all child CSS rules respond dynamically
          ["--lv-accent" as string]: accentColor,
          ["--lv-accent-glow" as string]: `${accentColor}55`,
        }}
      >
        <div
          ref={ambientRef}
          className="lv-ambient"
          style={{
            background: `radial-gradient(ellipse 70% 38% at 50% 58%, ${accentColor}28, transparent 68%)`,
            opacity: 0.07,
          }}
          aria-hidden="true"
        />
        <div
          ref={scrollRef}
          className="lv-scroll h-full px-7 lg:px-10 relative z-10"
          style={{ paddingTop: "38vh", paddingBottom: "38vh" }}
          role="list"
          aria-label="Synced lyrics"
        >
          {lines.map((line, i) => (
            <div
              key={i}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              role="listitem"
            >
              <SyncedLine
                line={line}
                index={i}
                currentIndex={currentIndex}
                focusRadius={focusRadius}
                prevEnd={i > 0 ? lines[i - 1].end : null}
                onSeek={onSeek}
              />
            </div>
          ))}
        </div>
      </div>
    );
  },
);
SyncedLyricsView.displayName = "SyncedLyricsView";

// ─────────────────────────────────────────────────────────────────────────────
// KARAOKE WORD — PERF-1,2,8: thuần DOM mutation qua rAF, zero React re-render
// ─────────────────────────────────────────────────────────────────────────────

interface KWordProps {
  word: string;
  startTime: number;
  endTime: number;
  /** True khi line này đang active — word chỉ animate khi active */
  lineActive: boolean;
  fontSize: string;
  backing: boolean;
  /** Prop memoization — không re-render khi lineActive chưa thay đổi tier */
  lineIndex: number;
  currentLineIndex: number;
}

const KWord = memo(
  ({ word, startTime, endTime, lineActive, fontSize, backing }: KWordProps) => {
    const rafTime = useRafTime();
    const fillRef = useRef<HTMLSpanElement>(null);
    const baseRef = useRef<HTMLSpanElement>(null);
    const wrapRef = useRef<HTMLSpanElement>(null);

    // Subscribe to rAF — direct DOM update, no setState
    useEffect(() => {
      if (!lineActive) {
        // Line not active: ensure fill is reset, no subscription needed
        if (fillRef.current) {
          fillRef.current.style.setProperty("--kv-fill", "0%");
        }
        if (wrapRef.current) {
          wrapRef.current.className = `kv-word${backing ? " kv-word--backing" : ""}`;
        }
        return;
      }

      return rafTime.subscribe((ms) => {
        const fill = fillRef.current;
        const base = baseRef.current;
        const wrap = wrapRef.current;
        if (!fill || !base || !wrap) return;

        const dur = endTime - startTime;
        const progress =
          dur <= 0
            ? ms >= startTime
              ? 1
              : 0
            : Math.max(0, Math.min(1, (ms - startTime) / dur));

        const pct = `${Math.round(progress * 100)}%`;
        fill.style.setProperty("--kv-fill", pct);

        // Class management via direct DOM — no React reconcile
        const isDone = progress >= 1;
        const isActive = progress > 0 && !isDone;
        let cls = "kv-word";
        if (isActive) cls += " kv-word--active";
        if (isDone) cls += " kv-word--done";
        if (backing) cls += " kv-word--backing";
        if (wrap.className !== cls) wrap.className = cls;
      });
    }, [rafTime, lineActive, startTime, endTime, backing]);

    return (
      <span
        ref={wrapRef}
        className={`kv-word${backing ? " kv-word--backing" : ""}`}
      >
        <span ref={baseRef} className="kv-word__base" style={{ fontSize }}>
          {word}
        </span>
        <span
          ref={fillRef}
          className="kv-word__fill"
          style={{ fontSize }}
          aria-hidden="true"
        >
          {word}
        </span>
      </span>
    );
  },
  // Re-render only when structural props change, not on time updates
  (prev, next) =>
    prev.word === next.word &&
    prev.startTime === next.startTime &&
    prev.endTime === next.endTime &&
    prev.lineActive === next.lineActive &&
    prev.fontSize === next.fontSize &&
    prev.backing === next.backing,
);
KWord.displayName = "KWord";

// ─────────────────────────────────────────────────────────────────────────────
// KARAOKE LINE — PERF-8: không nhận rafMs prop, beat pulse qua data attribute
// ─────────────────────────────────────────────────────────────────────────────

const KLine = memo(
  ({
    line,
    lineIndex,
    currentIndex,
    focusRadius,
    degraded,
    onSeek,
  }: {
    line: KDisplayLine;
    lineIndex: number;
    currentIndex: number;
    focusRadius: number;
    degraded: boolean;
    onSeek: (ms: number) => void;
  }) => {
    const rafTime = useRafTime();
    const ref = useRef<HTMLDivElement>(null);
    const prevBeatWord = useRef(-1);

    const distance = Math.abs(lineIndex - currentIndex);
    const isCurrent = lineIndex === currentIndex;
    const isHidden = focusRadius > 0 && !isCurrent && distance > focusRadius;
    const isInst =
      "_instrumental" in line && (line as InstrumentalLine)._instrumental;

    const tier = isInst
      ? "kv-line--instrumental"
      : isHidden
        ? "kv-line--hidden"
        : isCurrent
          ? "kv-line--current"
          : distance === 1
            ? "kv-line--near1"
            : distance === 2
              ? "kv-line--near2"
              : "kv-line--far";

    // Beat pulse — driven by rAF, mutates data-beat attribute directly
    // CSS handles the animation: .kv-line--current[data-beat="1"] { animation: ... }
    useEffect(() => {
      if (!isCurrent || !line.words?.length) {
        prevBeatWord.current = -1;
        return;
      }
      return rafTime.subscribe((ms) => {
        const el = ref.current;
        if (!el) return;
        const wordIdx = line.words.findIndex(
          (w) => ms >= w.startTime && ms < w.endTime,
        );
        if (wordIdx !== prevBeatWord.current && wordIdx !== -1) {
          prevBeatWord.current = wordIdx;
          // Restart animation by toggling attribute
          el.dataset.beat = "0";
          // rAF ensures we're in the next paint cycle before re-setting
          requestAnimationFrame(() => {
            if (el) el.dataset.beat = "1";
          });
        }
      });
    }, [rafTime, isCurrent, line.words]);

    const fs = calcFontSize(line.text.length, isCurrent);
    const isBacking = /^\s*[\(\（]/.test(line.text);

    const handleClick = useCallback(() => {
      if (!isInst) onSeek(line.start);
    }, [isInst, onSeek, line.start]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (!isInst && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSeek(line.start);
        }
      },
      [isInst, onSeek, line.start],
    );

    return (
      <div
        ref={ref}
        className={cn("kv-line", tier)}
        onClick={handleClick}
        role={isInst ? "presentation" : "button"}
        tabIndex={isInst || isHidden ? -1 : 0}
        aria-label={isInst ? undefined : `Seek to: ${line.text}`}
        aria-current={isCurrent ? "true" : undefined}
        onKeyDown={handleKeyDown}
      >
        {isInst ? (
          <span
            style={{
              fontSize: "1.35rem",
              letterSpacing: "0.5em",
              color: "hsl(var(--foreground) / .24)",
            }}
          >
            {line.text}
          </span>
        ) : line.words?.length > 0 && !degraded ? (
          <span style={{ lineHeight: 1.25 }}>
            {line.words.map((w, i) => (
              <KWord
                key={i}
                word={w.word}
                startTime={w.startTime}
                endTime={w.endTime}
                lineActive={isCurrent}
                lineIndex={lineIndex}
                currentLineIndex={currentIndex}
                fontSize={fs}
                backing={isBacking}
              />
            ))}
          </span>
        ) : (
          <span
            style={{
              fontSize: fs,
              lineHeight: 1.25,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              color: isCurrent
                ? "var(--color-foreground)"
                : "hsl(var(--foreground) / .18)",
              transition: "color 0.3s ease",
            }}
          >
            {line.text}
          </span>
        )}
      </div>
    );
  },
  // Re-render only when index relationship changes
  (prev, next) => {
    const prevTier = Math.abs(prev.lineIndex - prev.currentIndex);
    const nextTier = Math.abs(next.lineIndex - next.currentIndex);
    return (
      prevTier === nextTier &&
      prev.line === next.line &&
      prev.degraded === next.degraded &&
      prev.onSeek === next.onSeek &&
      prev.focusRadius === next.focusRadius
    );
  },
);
KLine.displayName = "KLine";

// ─────────────────────────────────────────────────────────────────────────────
// KARAOKE CONTAINER
// PERF-3: single bsearch per rAF frame, result → state only on index change
// PERF-4: centralized scroll
// ─────────────────────────────────────────────────────────────────────────────

const KaraokeView = memo(
  ({
    lines,
    onSeek,
    focusRadius,
    accentColor = "primary",
    degraded,
  }: {
    lines: IKaraokeLine[];
    onSeek: (ms: number) => void;
    focusRadius: number;
    accentColor: string;
    degraded: boolean;
  }) => {
    const rafTime = useRafTime();

    // Sanitize + build display lines — stable reference
    const sanitized = useMemo(() => sanitizeKaraokeLines(lines), [lines]);
    const displayLines = useMemo(
      () => buildDisplayLines(sanitized),
      [sanitized],
    );

    const [currentIndex, setCurrentIndex] = useState(() =>
      bsearch(displayLines as { start: number; end: number }[], rafTime.ms),
    );
    const currentIndexRef = useRef(currentIndex);
    const scrollRef = useRef<HTMLDivElement>(null);
    const ambientRef = useRef<HTMLDivElement>(null);
    const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

    // rAF subscription — setState only on index change
    useEffect(() => {
      return rafTime.subscribe((ms) => {
        const next = bsearch(
          displayLines as { start: number; end: number }[],
          ms,
        );
        if (next !== currentIndexRef.current) {
          currentIndexRef.current = next;
          setCurrentIndex(next);
          if (ambientRef.current) {
            ambientRef.current.style.opacity = "0.18";
            setTimeout(() => {
              if (ambientRef.current) ambientRef.current.style.opacity = "0.08";
            }, 650);
          }
        }
      });
    }, [rafTime, displayLines]);

    // Custom smooth scroll — rAF spring (PERF-4 + iOS fix)
    useEffect(() => {
      if (currentIndex < 0) return;
      const el = lineRefs.current[currentIndex];
      if (!el || !scrollRef.current) return;
      const container = scrollRef.current;
      const target =
        el.offsetTop - container.offsetHeight / 2 + el.offsetHeight / 2;
      smoothScrollTo(container, target, 500);
    }, [currentIndex]);

    return (
      <div
        className={cn("relative h-full", degraded && "kv-degraded")}
        style={{
          // Inject accent CSS variables so all child CSS rules respond dynamically
          ["--lv-accent" as string]: accentColor,
          ["--lv-accent-glow" as string]: `${accentColor}55`,
        }}
      >
        <div
          ref={ambientRef}
          className="lv-ambient"
          style={{
            background: `radial-gradient(ellipse 68% 40% at 50% 60%, ${accentColor}2e, transparent 68%)`,
            opacity: 0.08,
          }}
          aria-hidden="true"
        />

        {degraded && (
          <span className="absolute top-3 right-4 z-10 text-[10px] text-white/30 bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 rounded-full select-none pointer-events-none tracking-wide">
            Chế độ lời
          </span>
        )}

        <div
          ref={scrollRef}
          className="lv-scroll h-full px-7 lg:px-10 relative z-10"
          style={{ paddingTop: "40vh", paddingBottom: "40vh" }}
          role="list"
          aria-label="Karaoke lyrics"
        >
          {displayLines.map((line, i) => {
            const prev = i > 0 ? displayLines[i - 1] : null;
            const isInst =
              "_instrumental" in line &&
              (line as InstrumentalLine)._instrumental;
            const gapMs = prev ? line.start - prev.end : 0;
            const showCountdown =
              !isInst && prev !== null && gapMs >= COUNTDOWN_GAP;

            return (
              <div
                key={i}
                ref={(el) => {
                  lineRefs.current[i] = el;
                }}
                role="listitem"
              >
                {showCountdown && prev && (
                  <CountdownDots gapStart={prev.end} gapEnd={line.start} />
                )}
                <KLine
                  line={line}
                  lineIndex={i}
                  currentIndex={currentIndex}
                  focusRadius={focusRadius}
                  degraded={degraded}
                  onSeek={onSeek}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);
KaraokeView.displayName = "KaraokeView";

// ─────────────────────────────────────────────────────────────────────────────
// ROOT: LyricsView
// ─────────────────────────────────────────────────────────────────────────────

export const LyricsView = memo(
  ({
    lyricType,
    plainLyrics,
    syncedLines,
    karaokeLines,
    currentTime,
    isPlaying,
    onSeek,
    loading = false,
    accentColor = "primary",
    qualityScore = 1,
    focusRadius = 0,
  }: LyricsViewProps) => {
    // Single rAF loop for the entire tree — not per-component
    const rafTimeRef = useRafTimeRef(currentTime, isPlaying);
    const degraded = qualityScore < QUALITY_THRESH;

    const handleSeek = useCallback(
      (ms: number) => onSeek?.(ms / 1000),
      [onSeek],
    );

    const normSynced = useMemo(
      () => (syncedLines ? toNormSync(syncedLines) : []),
      [syncedLines],
    );

    const renderContent = () => {
      if (loading) return <LyricsEmpty loading={true} />;
      if (lyricType === "none") return <LyricsEmpty loading={false} />;

      if (lyricType === "plain")
        return plainLyrics?.trim() ? (
          <PlainLyricsView text={plainLyrics} />
        ) : (
          <LyricsEmpty loading={false} />
        );

      if (lyricType === "synced")
        return normSynced.length ? (
          <SyncedLyricsView
            lines={normSynced}
            onSeek={handleSeek}
            focusRadius={focusRadius}
            accentColor={accentColor}
          />
        ) : (
          <LyricsEmpty loading={false} />
        );

      if (lyricType === "karaoke")
        return karaokeLines?.length ? (
          <KaraokeView
            lines={karaokeLines}
            onSeek={handleSeek}
            focusRadius={focusRadius}
            accentColor={accentColor}
            degraded={degraded}
          />
        ) : (
          <LyricsEmpty loading={false} />
        );

      return <LyricsEmpty loading={false} />;
    };

    return (
      <RafTimeContext.Provider value={rafTimeRef}>
        <div className="h-full">{renderContent()}</div>
      </RafTimeContext.Provider>
    );
  },
);

LyricsView.displayName = "LyricsView";
export default LyricsView;
