import { memo, useState, useCallback, useMemo } from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import {
  Heart,
  ListPlus,
  MoreHorizontal,
  Share2,
  Radio,
  Music2,
  Disc3,
  Calendar,
  Clock3,
  Mic2,
  Loader2,
  Play,
  Zap,
  CheckCheck,
} from "lucide-react";

import { ITrack } from "@/features/track/types";
import { useRecommendedTracks, useSimilarTracks } from "@/features/track";
import { cn } from "@/lib/utils";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { MarqueeText } from "./MarqueeText";
import { TrackLikeButton } from "@/features/interaction/components/LikeButton";
import ArtistDisplay from "@/features/artist/components/ArtistDisplay";
import { useContextSheet } from "@/app/provider/SheetProvider";
import { toCDN } from "@/utils/track-helper";

// ─────────────────────────────────────────────────────────────────────────────
// SPRING PRESETS — module scope, no alloc per render
// ─────────────────────────────────────────────────────────────────────────────

const SP = {
  snappy: { type: "spring", stiffness: 440, damping: 28 } as const,
  gentle: { type: "spring", stiffness: 300, damping: 30 } as const,
  pop: { type: "spring", stiffness: 520, damping: 24 } as const,
  swipe: { type: "spring", stiffness: 280, damping: 30, mass: 0.8 } as const,
} as const;

// PERF-4: Hoisted to module scope — not recreated per render
const SWIPE_VARIANTS: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 60 : -60 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -60 : 60 }),
};

const STAGGER_ITEM: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

const STAGGER_CONTAINER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — cached formatters
// ─────────────────────────────────────────────────────────────────────────────

const durationCache = new Map<number, string>();
function formatDuration(secs: number): string {
  if (!secs || isNaN(secs)) return "—";
  if (durationCache.has(secs)) return durationCache.get(secs)!;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const v = `${m}:${s.toString().padStart(2, "0")}`;
  durationCache.set(secs, v);
  return v;
}

const dateCache = new Map<string, string>();
function formatDate(d: string | Date | undefined): string {
  if (!d) return "—";
  const key = String(d);
  if (dateCache.has(key)) return dateCache.get(key)!;
  const v = new Date(d).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  dateCache.set(key, v);
  return v;
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON ROW
// ─────────────────────────────────────────────────────────────────────────────

const TrackRowSkeleton = memo(() => (
  <div className="flex items-center gap-3 p-2">
    <div className="w-10 h-10 rounded-lg bg-white/[0.06] shrink-0 animate-pulse" />
    <div className="flex-1 space-y-2">
      <div className="h-3 w-3/5 bg-white/[0.06] rounded animate-pulse" />
      <div className="h-2.5 w-2/5 bg-white/[0.04] rounded animate-pulse" />
    </div>
    <div className="h-6 w-6 bg-white/[0.04] rounded animate-pulse" />
  </div>
));
TrackRowSkeleton.displayName = "TrackRowSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK ROW — PERF-1: CSS hover, no motion.div for overlay
// ─────────────────────────────────────────────────────────────────────────────

interface TrackRowProps {
  item: ITrack;
  onPlay?: (track: ITrack) => void;
  onAddToPlaylist: (track: ITrack) => void;
  onMoreOptions: (track: ITrack) => void; // PERF-2: removed unused anchor param
  index: number;
}

const TrackRow = memo(
  ({ item, onPlay, onAddToPlaylist, onMoreOptions }: TrackRowProps) => {
    const prefersReduced = useReducedMotion();

    const handleMore = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onMoreOptions(item);
      },
      [item, onMoreOptions],
    );
    const handleAdd = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onAddToPlaylist(item);
      },
      [item, onAddToPlaylist],
    );
    const handlePlay = useCallback(() => onPlay?.(item), [item, onPlay]);
    const handleKey = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter") onPlay?.(item);
      },
      [item, onPlay],
    );

    const artistName =
      typeof item.artist === "object"
        ? (item.artist?.name ?? "Unknown")
        : "Unknown";

    return (
      <motion.div
        variants={prefersReduced ? {} : STAGGER_ITEM}
        layout="position"
        className="group relative flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-white/[0.06] active:bg-white/[0.09] transition-colors duration-150 cursor-pointer"
        onClick={handlePlay}
        role="button"
        tabIndex={0}
        onKeyDown={handleKey}
        aria-label={`Phát ${item.title} — ${artistName}`}
      >
        {/* Cover — PERF-1: CSS overlay, no Framer motion.div */}
        <div className="relative shrink-0 w-10 h-10">
          <ImageWithFallback
            src={toCDN(item.coverImage) || item.coverImage}
            alt={item.title}
            className="w-10 h-10 rounded-lg object-cover ring-1 ring-white/10"
          />
          <div
            className="absolute inset-0 rounded-lg bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
            aria-hidden="true"
          >
            <Play className="w-4 h-4 text-white fill-white" />
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white/90 truncate leading-snug">
            {item.title}
          </p>
          <ArtistDisplay
            mainArtist={item.artist}
            featuringArtists={item.featuringArtists}
            className="text-[11px]"
          />
        </div>

        {/* Actions — hidden by default, visible on hover/focus (cleaner mobile UX) */}
        <div
          className="flex items-center gap-0.5 shrink-0 opacity-100 md:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <motion.button
            whileTap={{ scale: 0.82 }}
            transition={SP.snappy}
            onClick={handleAdd}
            aria-label="Thêm vào playlist"
            className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-colors"
          >
            <ListPlus className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.82 }}
            transition={SP.snappy}
            onClick={handleMore}
            aria-label="Tùy chọn khác"
            className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </motion.button>
        </div>
      </motion.div>
    );
  },
);
TrackRow.displayName = "TrackRow";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION LABEL
// ─────────────────────────────────────────────────────────────────────────────

const SectionLabel = memo(
  ({
    icon: Icon,
    label,
    count,
  }: {
    icon: React.ElementType;
    label: string;
    count?: number;
  }) => (
    <div className="flex items-center gap-2 mb-2.5">
      <Icon className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
      <h4 className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
        {label}
      </h4>
      {count != null && (
        <span className="ml-auto text-[10px] text-[hsl(var(--primary)/0.5)] bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.15)] px-1.5 py-0.5 rounded-full font-mono tabular-nums">
          {count}
        </span>
      )}
    </div>
  ),
);
SectionLabel.displayName = "SectionLabel";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK INFO SECTION
// ─────────────────────────────────────────────────────────────────────────────

const TrackInfoSection = memo(({ track }: { track: ITrack }) => {
  const fullArtist =
    track.artist?.name +
    (track.featuringArtists.length > 0
      ? ` ft. ${track.featuringArtists.map((a) => a.name).join(", ")}`
      : "");
  const rows = useMemo(
    () => [
      { icon: Mic2, label: "Nghệ sĩ", value: fullArtist },
      { icon: Disc3, label: "Album", value: track.album?.title ?? "Single" },
      {
        icon: Calendar,
        label: "Phát hành",
        value: formatDate(track.releaseDate),
      },
      {
        icon: Clock3,
        label: "Thời lượng",
        value: formatDuration(track.duration),
      },
      ...(track.bitrate
        ? [{ icon: Zap, label: "Chất lượng", value: `${track.bitrate} kbps` }]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [track._id, track.bitrate],
  );

  return (
    <motion.section variants={STAGGER_ITEM}>
      <SectionLabel icon={Music2} label="Thông tin" />
      {/* Compact cover + title header */}
      <div className="flex items-center gap-3 px-1 py-2 mb-1">
        <div className="size-12 rounded-xl overflow-hidden shrink-0 ring-1 ring-white/10 shadow-lg">
          <ImageWithFallback
            src={toCDN(track.coverImage) || track.coverImage}
            alt=""
            className="size-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <MarqueeText
            text={track.title}
            className="font-bold tracking-tight text-brand text-[14px]"
            speed={38}
            pauseMs={1600}
          />
          <ArtistDisplay
            mainArtist={track.artist}
            featuringArtists={track.featuringArtists}
            className="text-[11px]"
          />
        </div>
      </div>
      <dl className="space-y-0.5">
        {rows.map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-white/[0.04] transition-colors"
          >
            <Icon className="w-3.5 h-3.5 text-white/25 shrink-0" />
            <dt className="text-[11px] text-white/30 w-20 shrink-0">{label}</dt>
            <dd className="text-[12px] text-white/75 font-medium truncate">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </motion.section>
  );
});
TrackInfoSection.displayName = "TrackInfoSection";

// ─────────────────────────────────────────────────────────────────────────────
// RECOMMENDED SECTION
// ─────────────────────────────────────────────────────────────────────────────

interface TrackSectionProps {
  excludeTrackId?: string;
  trackId?: string;
  onPlay: (track: ITrack) => void;
}

const RecommendedSection = memo(
  ({ excludeTrackId, onPlay }: TrackSectionProps) => {
    const { openOptionSheet, openAddToPlaylistSheet } = useContextSheet();

    const {
      data: tracks,
      isLoading,
      error,
      isFetching,
    } = useRecommendedTracks(5, excludeTrackId);
    const openSheet = useCallback(
      (type: "playlist" | "options", t: ITrack) => {
        if (type === "options") openOptionSheet(t);
        else if (type === "playlist") openAddToPlaylistSheet(undefined, [t]);
      },
      [openOptionSheet, openAddToPlaylistSheet],
    );
    // const closeSheet = useCallback(() => {
    //   closeContextSheet();
    // }, [closeContextSheet]);
    // PERF-2: no anchor param
    const handleMoreOptions = useCallback(
      (t: ITrack) => openSheet("options", t),
      [openSheet],
    );
    const handleAddToPlaylist = useCallback(
      (t: ITrack) => openSheet("playlist", t),
      [openSheet],
    );

    if (error) return null;

    return (
      <motion.section variants={STAGGER_ITEM}>
        <SectionLabel
          icon={Heart}
          label="Có thể bạn thích"
          count={tracks?.length}
        />
        <div className="space-y-0.5">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <TrackRowSkeleton key={i} />
            ))
          ) : (
            <motion.div
              variants={STAGGER_CONTAINER}
              initial="hidden"
              animate="show"
              className="space-y-0.5"
            >
              {tracks?.map((item, idx) => (
                <TrackRow
                  key={item._id}
                  item={item}
                  index={idx}
                  onPlay={onPlay}
                  onAddToPlaylist={handleAddToPlaylist}
                  onMoreOptions={handleMoreOptions}
                />
              ))}
            </motion.div>
          )}
          {isFetching && !isLoading && (
            <div className="flex justify-center py-1">
              <Loader2 className="w-3.5 h-3.5 text-white/20 animate-spin" />
            </div>
          )}
        </div>
      </motion.section>
    );
  },
);
RecommendedSection.displayName = "RecommendedSection";

// ─────────────────────────────────────────────────────────────────────────────
// SIMILAR SECTION
// ─────────────────────────────────────────────────────────────────────────────

const SimilarSection = memo(({ trackId, onPlay }: TrackSectionProps) => {
  const { openOptionSheet, openAddToPlaylistSheet } = useContextSheet();

  const { data: tracks, isLoading, error } = useSimilarTracks(trackId!, 5);
  const openSheet = useCallback(
    (type: "playlist" | "options", t: ITrack) => {
      if (type === "options") openOptionSheet(t);
      else if (type === "playlist") openAddToPlaylistSheet(undefined, [t]);
    },
    [openOptionSheet, openAddToPlaylistSheet],
  );
  const handleMoreOptions = useCallback(
    (t: ITrack) => openSheet("options", t),
    [openSheet],
  );
  const handleAddToPlaylist = useCallback(
    (t: ITrack) => openSheet("playlist", t),
    [openSheet],
  );

  if (error || (!isLoading && !tracks?.length)) return null;

  return (
    <motion.section variants={STAGGER_ITEM}>
      <SectionLabel
        icon={Radio}
        label="Bài hát tương tự"
        count={tracks?.length}
      />
      <div className="space-y-0.5">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <TrackRowSkeleton key={i} />)
        ) : (
          <motion.div
            variants={STAGGER_CONTAINER}
            initial="hidden"
            animate="show"
            className="space-y-0.5"
          >
            {tracks?.map((item, idx) => (
              <TrackRow
                key={item._id}
                item={item}
                index={idx}
                onPlay={onPlay}
                onAddToPlaylist={handleAddToPlaylist}
                onMoreOptions={handleMoreOptions}
              />
            ))}
          </motion.div>
        )}
      </div>
    </motion.section>
  );
});
SimilarSection.displayName = "SimilarSection";

// ─────────────────────────────────────────────────────────────────────────────
// ACTION BAR
// ─────────────────────────────────────────────────────────────────────────────

const ActionBar = memo(({ track }: { track: ITrack }) => {
  const { openOptionSheet, openAddToPlaylistSheet } = useContextSheet();
  const [shared, setShared] = useState(false);

  const openSheet = useCallback(
    (type: "playlist" | "options", t: ITrack) => {
      if (type === "options") openOptionSheet(t);
      else if (type === "playlist") openAddToPlaylistSheet(undefined, [t]);
    },
    [openOptionSheet, openAddToPlaylistSheet],
  );

  const handleAddToPlaylist = useCallback(
    () => openSheet("playlist", track),
    [openSheet, track],
  );

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/track/${track._id}`;
    const title = track.title;
    const text = `Nghe "${title}" trên TVP Music`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // user cancelled or not supported
    }
  }, [track._id, track.title]);

  return (
    <motion.div variants={STAGGER_ITEM} className="flex gap-2">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.96 }}
        transition={SP.snappy}
        onClick={handleAddToPlaylist}
        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.11] text-[13px] font-semibold text-white/75 hover:text-white transition-colors border border-white/[0.06]"
      >
        <ListPlus className="w-4 h-4" />
        Thêm vào playlist
      </motion.button>

      {/* Like button — uses real Redux store via TrackLikeButton */}
      <div className="flex items-center justify-center px-3 rounded-xl bg-white/[0.07] border border-white/[0.06] hover:bg-white/[0.11] transition-colors">
        <TrackLikeButton id={track._id} />
      </div>

      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.88 }}
        transition={SP.snappy}
        onClick={handleShare}
        aria-label={shared ? "Đã sao chép link" : "Chia sẻ"}
        className={cn(
          "px-3.5 rounded-xl border transition-all duration-200",
          shared
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
            : "bg-white/[0.07] border-white/[0.06] text-white/50 hover:text-white/80 hover:bg-white/[0.11]",
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={shared ? "copied" : "share"}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={SP.pop}
            className="flex items-center justify-center"
          >
            {shared ? (
              <CheckCheck className="w-4 h-4" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </motion.div>
  );
});
ActionBar.displayName = "ActionBar";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: TrackDetailPanel
// ─────────────────────────────────────────────────────────────────────────────

interface TrackDetailPanelProps {
  track: ITrack;
  direction: number;
  onPlayTrack?: (track: ITrack) => void;
}

export const TrackDetailPanel = memo(
  ({ track, direction, onPlayTrack }: TrackDetailPanelProps) => {
    const handlePlay = useCallback(
      (t: ITrack) => onPlayTrack?.(t),
      [onPlayTrack],
    );

    return (
      <motion.div
        key={`info-${track._id}`}
        custom={direction}
        variants={SWIPE_VARIANTS}
        initial="enter"
        animate="center"
        exit="exit"
        transition={SP.swipe}
        className="absolute inset-0 flex flex-col"
      >
        <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-none px-5 py-4">
          <motion.div
            variants={STAGGER_CONTAINER}
            initial="hidden"
            animate="show"
            className="space-y-5"
          >
            {/* Track info */}
            <TrackInfoSection track={track} />

            <motion.div
              variants={STAGGER_ITEM}
              className="h-px bg-white/[0.06] mx-1"
            />

            {/* Action bar — uses context for sheets */}
            <ActionBar track={track} />

            <motion.div
              variants={STAGGER_ITEM}
              className="h-px bg-white/[0.06] mx-1"
            />

            {/* Recommended — uses context for sheets */}
            <RecommendedSection
              excludeTrackId={track._id}
              onPlay={handlePlay}
            />

            {/* Similar — uses context for sheets */}
            <SimilarSection trackId={track._id} onPlay={handlePlay} />

            <div className="h-4" aria-hidden />
          </motion.div>
        </div>
        {/* NOTE: Sheets are NOT rendered here anymore.
          They live in FullPlayer and are opened via usePlayerSheet() context. */}
      </motion.div>
    );
  },
);

TrackDetailPanel.displayName = "TrackDetailPanel";
export default TrackDetailPanel;
