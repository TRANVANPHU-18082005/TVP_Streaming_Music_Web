import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  memo,
  Suspense,
  type FC,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Globe,
  PenSquare,
  ListMusic,
  ChevronLeft,
  Clock,
  Users,
  Sparkles,
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import { useAppSelector } from "@/store/hooks";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { ITrack } from "@/features/track/types";
import { IPlaylist, IPlaylistDetail } from "@/features/playlist/types";
import { usePlaylistMutations } from "@/features/playlist/hooks/usePlaylistMutations";
import {
  usePlaylistDetail,
  usePlaylistTracksInfinite,
} from "@/features/playlist/hooks/usePlaylistsQuery";
import { useSyncInteractions } from "@/features/interaction/hooks/useSyncInteractions";
import PlaylistDetailSkeleton from "@/features/playlist/components/PlaylistDetailSkeleton";
import { usePlaylistPlayback } from "@/features/player/hooks/usePlaylistPlayback";
import { formatDuration } from "@/utils/track-helper";
import { buildPalette } from "@/utils/color";
import { useScrollY } from "@/hooks/useScrollY";
import { useTitleStyle } from "@/hooks/useTitleStyle";
import MusicResult from "@/components/ui/Result";
import { APP_CONFIG, SP_GENTLE, SP_HERO, SP_SNAPPY } from "@/config/constants";
import { useContextSheet } from "@/app/provider/SheetProvider";
import { PlaylistActionBarProps } from "./components/PlaylistActionBar";
import { PlaylistCoverProps } from "./components/PlaylistCover";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { WaveformBars } from "@/components/MusicVisualizer";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import type { QueueSourceType } from "@/features/player/slice/playerSlice";

dayjs.extend(relativeTime);

// ─── Lazy loads ───────────────────────────────────────────────────────────────
const LazyTrackList = React.lazy(() =>
  import("@/features/track/components/TrackList").then((m) => ({
    default: m.TrackList,
  })),
);
const LazyPlaylistModal = React.lazy(() =>
  import("@/features/playlist/components/PlaylistModal").then((m) => ({
    default: m.default,
  })),
);
const LazyEditPlaylistTracksModal = React.lazy(() =>
  import("@/features/playlist/components/EditPlaylistTracksModal").then(
    (m) => ({
      default: m.EditPlaylistTracksModal,
    }),
  ),
);

// Lightweight wrappers — single Suspense boundary per lazy component
const LazyPlaylistCover = React.lazy(() =>
  import("./components/PlaylistCover").then((m) => ({
    default: m.PlaylistCover,
  })),
);
const PlaylistCover = (props: PlaylistCoverProps) => (
  <Suspense fallback={null}>
    <LazyPlaylistCover {...props} />
  </Suspense>
);

const LazyPlaylistActionBar = React.lazy(() =>
  import("./components/PlaylistActionBar").then((m) => ({
    default: m.PlaylistActionBar,
  })),
);
const PlaylistActionBar = (props: PlaylistActionBarProps) => (
  <Suspense fallback={null}>
    <LazyPlaylistActionBar {...props} />
  </Suspense>
);

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PlaylistDetailPageProps {
  variant?: "page" | "embedded";
  slugOverride?: string;
  onClose?: () => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const VisibilityBadge = memo<{ visibility?: string }>(({ visibility }) => {
  if (visibility === "private") {
    return (
      <Badge
        variant="destructive"
        className="uppercase text-[9px] font-black tracking-widest px-2 py-0.5 gap-1 shrink-0"
      >
        <Lock className="size-2.5" aria-hidden /> Riêng tư
      </Badge>
    );
  }
  if (visibility === "public") {
    return (
      <Badge
        variant="outline"
        className="uppercase text-[9px] font-black tracking-widest px-2 py-0.5 gap-1 border-border/40 shrink-0"
      >
        <Globe className="size-2.5" aria-hidden /> Công khai
      </Badge>
    );
  }
  return null;
});
VisibilityBadge.displayName = "VisibilityBadge";

const PlaylistMeta = memo<{
  trackCount: number;
  durationSec: number;
  createdAt?: string;
  className?: string;
  compact?: boolean;
}>(({ trackCount, durationSec, createdAt, className, compact }) => (
  <div
    className={cn(
      "flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium text-muted-foreground",
      compact ? "text-[11px]" : "text-[13px]",
      className,
    )}
  >
    <span className="font-bold text-foreground/80">{trackCount} bài hát</span>
    {durationSec > 0 && (
      <>
        <span className="opacity-40 hidden sm:inline" aria-hidden>
          ·
        </span>
        <span>{formatDuration(durationSec)}</span>
      </>
    )}
    {createdAt && !compact && (
      <>
        <span className="opacity-40 hidden sm:inline" aria-hidden>
          ·
        </span>
        <span>{dayjs(createdAt).fromNow()}</span>
      </>
    )}
  </div>
));
PlaylistMeta.displayName = "PlaylistMeta";

// Modals kept in one lazy boundary group — avoids 3 separate Suspense nodes
const PlaylistModals = memo<{
  playlist?: IPlaylist;
  isEditMetaOpen: boolean;
  isManageTracksOpen: boolean;
  isDeleteOpen: boolean;
  isMutating: boolean;
  handleSubmitForm: (data: FormData) => Promise<void>;
  onCloseEditMeta: () => void;
  onCloseManageTracks: () => void;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
}>(
  ({
    playlist,
    isEditMetaOpen,
    isManageTracksOpen,
    isDeleteOpen,
    isMutating,
    handleSubmitForm,
    onCloseEditMeta,
    onCloseManageTracks,
    onCloseDelete,
    onConfirmDelete,
  }) => (
    <>
      {/* Only mount lazily when actually open — avoid rendering closed modals */}
      {isEditMetaOpen && (
        <Suspense fallback={null}>
          <LazyPlaylistModal
            isOpen
            onClose={onCloseEditMeta}
            playlistToEdit={playlist}
            onSubmit={handleSubmitForm}
            isPending={isMutating}
          />
        </Suspense>
      )}
      {isManageTracksOpen && (
        <Suspense fallback={null}>
          <LazyEditPlaylistTracksModal
            isOpen
            onClose={onCloseManageTracks}
            playlistId={playlist?._id}
          />
        </Suspense>
      )}
      <ConfirmationModal
        isOpen={isDeleteOpen}
        onCancel={onCloseDelete}
        onConfirm={onConfirmDelete}
        title="Xóa danh sách phát?"
        description={`Hành động này không thể hoàn tác. "${playlist?.title}" sẽ bị xóa vĩnh viễn.`}
        confirmLabel="Xóa vĩnh viễn"
        isDestructive
      />
    </>
  ),
);
PlaylistModals.displayName = "PlaylistModals";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Sum track durations — extracted so it isn't inlined in render */
function sumDuration(tracks: ITrack[]): number {
  return tracks.reduce((s, t) => s + (t.duration ?? 0), 0);
}

// ─── Main component ───────────────────────────────────────────────────────────

const PlaylistDetailPage: FC<PlaylistDetailPageProps> = ({
  variant = "page",
  slugOverride,
  onClose,
}) => {
  const { id: paramId } = useParams<{ id: string }>();
  const id = slugOverride ?? paramId ?? "";
  const navigate = useNavigate();

  const isEmbedded = variant === "embedded";
  const user = useAppSelector((s) => s.auth.user);

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollY = useScrollY(scrollRef, !isEmbedded);
  const isScrolled = scrollY > (isEmbedded ? 140 : 285);

  const [isEditMetaOpen, setIsEditMetaOpen] = useState(false);
  const [isManageTracksOpen, setIsManageTracksOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: playlist, isLoading, isError, refetch } = usePlaylistDetail(id);

  const {
    data: tracksData,
    isLoading: isLoadingTracks,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: tracksError,
    refetch: refetchTracks,
  } = usePlaylistTracksInfinite(playlist?._id);

  const {
    togglePlayPlaylist,
    shufflePlaylist,
    isThisPlaylistPlaying,
    isThisPlaylistActive,
    isFetching,
  } = usePlaylistPlayback(playlist);

  // ── Derived ───────────────────────────────────────────────────────────────

  // Stable reference only changes when the actual track list changes
  const allTracks = useMemo<ITrack[]>(
    () => tracksData?.allTracks ?? [],
    [tracksData?.allTracks],
  );

  // Prefer authoritative length from playlist doc; fall back to paged count
  const totalItems = playlist?.trackIds.length ?? tracksData?.totalItems ?? 0;

  // totalDurationSec — only recalculate when allTracks changes
  const totalDurationSec = useMemo(() => sumDuration(allTracks), [allTracks]);

  // Palette — derive once from themeColor
  const palette = useMemo(
    () => buildPalette(playlist?.themeColor ?? "#8b5cf6"),
    [playlist?.themeColor],
  );

  // Stable style objects — only rebuild when palette changes
  const heroStyle = useMemo(
    () => ({ background: palette.heroGradient }),
    [palette.heroGradient],
  );
  const stickyStyle = useMemo(
    () =>
      ({
        animationDelay: "80ms",
        "--local-shadow-color": palette.hslChannels || "var(--primary)",
      }) as React.CSSProperties,
    [palette.hslChannels],
  );

  // Sync interaction hooks
  const playlistIds = useMemo(
    () => (playlist?._id ? [playlist._id] : []),
    [playlist?._id],
  );
  useSyncInteractions(playlistIds, "like", "playlist", !!playlist?._id);

  const { className: titleCls, style: titleStyle } = useTitleStyle(
    playlist?.title ?? "",
  );

  const { updatePlaylistAsync, deletePlaylist, isMutating } =
    usePlaylistMutations();

  const isOwner = useMemo(
    () => playlist?.user?._id === user?._id || user?.role === "admin",
    [playlist?.user?._id, user?._id, user?.role],
  );

  // Prefetch heavy chunks early — fire once on mount
  useEffect(() => {
    void import("@/features/track/components/TrackList");
    void import("./components/PlaylistActionBar");
    void import("./components/PlaylistCover");
  }, []);

  // ── Stable callbacks ──────────────────────────────────────────────────────

  const handleBack = useSmartBack();

  const handleSubmitForm = useCallback(
    async (formData: FormData) => {
      if (!playlist) return;
      try {
        await updatePlaylistAsync(playlist._id, formData);
        setIsEditMetaOpen(false);
      } catch {
        // Keep modal open so user can fix errors
      }
    },
    [playlist, updatePlaylistAsync],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!playlist) return;
    deletePlaylist(playlist._id);
    setIsDeleteOpen(false);
    if (isEmbedded && onClose) onClose();
    else navigate("/playlists");
  }, [playlist, deletePlaylist, isEmbedded, onClose, navigate]);

  const closeEditMeta = useCallback(() => setIsEditMetaOpen(false), []);
  const closeManageTracks = useCallback(() => setIsManageTracksOpen(false), []);
  const closeDelete = useCallback(() => setIsDeleteOpen(false), []);
  const openEditMeta = useCallback(() => setIsEditMetaOpen(true), []);
  const openManageTracks = useCallback(() => setIsManageTracksOpen(true), []);

  const { openPlaylistSheet } = useContextSheet();
  const handleMoreOptions = useCallback(
    (p: IPlaylistDetail) => openPlaylistSheet(p),
    [openPlaylistSheet],
  );

  // ── Shared prop objects ───────────────────────────────────────────────────

  const sharedActionBarProps: PlaylistActionBarProps = useMemo(
    () => ({
      playlist: playlist!,
      handleMoreOptions,
      palette,
      isLoadingPlay: isFetching,
      isLoadingShuffle: isFetching,
      isPlaying: isThisPlaylistPlaying,
      hasTracks: totalItems > 0,
      isOwner,
      onPlay: togglePlayPlaylist,
      onShuffle: shufflePlaylist,
      onManageTracks: openManageTracks,
    }),
    [
      playlist,
      handleMoreOptions,
      palette,
      isFetching,
      isThisPlaylistPlaying,
      totalItems,
      isOwner,
      togglePlayPlaylist,
      shufflePlaylist,
      openManageTracks,
    ],
  );

  const trackListProps = useMemo(
    () => ({
      allTrackIds: playlist?.trackIds,
      tracks: allTracks,
      totalItems,
      isLoading: isLoadingTracks,
      error: tracksError as Error | null,
      isFetchingNextPage,
      hasNextPage: hasNextPage ?? false,
      onFetchNextPage: fetchNextPage,
      onRetry: refetchTracks,
      source: {
        id: playlist?._id ?? "",
        type: "playlist" as QueueSourceType,
        title: playlist?.title,
        url: `/playlists/${playlist?.slug}`,
      },
    }),
    [
      playlist?.trackIds,
      allTracks,
      totalItems,
      isLoadingTracks,
      tracksError,
      isFetchingNextPage,
      hasNextPage,
      fetchNextPage,
      refetchTracks,
      playlist?._id,
      playlist?.title,
      playlist?.slug,
    ],
  );

  const modalProps = useMemo(
    () => ({
      playlist,
      isEditMetaOpen,
      isManageTracksOpen,
      isDeleteOpen,
      isMutating,
      handleSubmitForm,
      onCloseEditMeta: closeEditMeta,
      onCloseManageTracks: closeManageTracks,
      onCloseDelete: closeDelete,
      onConfirmDelete: handleConfirmDelete,
    }),
    [
      playlist,
      isEditMetaOpen,
      isManageTracksOpen,
      isDeleteOpen,
      isMutating,
      handleSubmitForm,
      closeEditMeta,
      closeManageTracks,
      closeDelete,
      handleConfirmDelete,
    ],
  );
  const isOnline = useOnlineStatus();
  // ── Render guards — ordered from cheapest to most specific ────────────────

  if (isLoading && !playlist) return <PlaylistDetailSkeleton />;

  // Transitional skeleton while switching playlists
  if (isLoading) return <WaveformBars active />;
  // Check offline FIRST — no point rendering if there's no network
  if (!isOnline) {
    return (
      <div className="section-container space-y-6 pt-4 pb-4">
        <MusicResult
          variant="error-network"
          onRetry={refetch}
          onBack={handleBack}
        />
      </div>
    );
  }
  if (isError || !playlist) {
    return (
      <div className="section-container space-y-6 pt-4 pb-4">
        <MusicResult variant="error" onRetry={refetch} />
      </div>
    );
  }

  // ─── EMBEDDED ──────────────────────────────────────────────────────────────

  if (isEmbedded) {
    return (
      <>
        <div
          ref={scrollRef}
          className="relative flex flex-col h-full overflow-y-auto bg-background text-foreground scrollbar-thin"
          role="region"
          aria-label={`Playlist: ${playlist.title}`}
        >
          {/* Gradient hero strip */}
          <div
            aria-hidden
            className="sticky top-0 h-[160px] shrink-0 pointer-events-none z-0"
            style={heroStyle}
          />

          <div className="relative z-10 -mt-[160px] px-4 pb-10">
            {onClose && (
              <div className="pt-4 pb-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-1.5 text-sm font-bold text-foreground/70 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded"
                >
                  <ChevronLeft className="size-4" aria-hidden /> Đóng
                </button>
              </div>
            )}

            <motion.div
              className="flex items-center gap-3.5 pt-3 pb-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SP_GENTLE}
            >
              <PlaylistCover
                playlist={playlist}
                palette={palette}
                isOwner={isOwner}
                size="sm"
                onEditCover={openEditMeta}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                    {playlist.isSystem ? "Hệ thống" : "Playlist"}
                  </span>
                  <VisibilityBadge visibility={playlist.visibility} />
                </div>

                <h2 className="text-xl font-black tracking-tight leading-tight line-clamp-2 text-foreground">
                  {playlist.title}
                </h2>

                <PlaylistMeta
                  trackCount={totalItems}
                  durationSec={totalDurationSec}
                  createdAt={playlist.createdAt}
                  className="mt-1"
                  compact
                />

                <AnimatePresence>
                  {isThisPlaylistPlaying && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="flex items-center gap-1.5 mt-2"
                    >
                      <WaveformBars color={palette.hex} active />
                      <span
                        className="text-[9px] font-black uppercase tracking-widest"
                        style={{ color: palette.hex }}
                      >
                        Đang phát
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            <div className="mb-5">
              <PlaylistActionBar {...sharedActionBarProps} density="full" />
            </div>

            {playlist.description && (
              <p className="text-sm text-muted-foreground font-medium leading-relaxed mb-4 line-clamp-3">
                {playlist.description}
              </p>
            )}

            <Suspense fallback={<WaveformBars active />}>
              <LazyTrackList {...trackListProps} />
            </Suspense>
          </div>
        </div>

        <PlaylistModals {...modalProps} />
      </>
    );
  }

  // ─── PAGE ─────────────────────────────────────────────────────────────────

  return (
    <main className="relative min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30 selection:text-primary">
      {/* Layered background — hero gradient + noise texture + fade-to-bg */}
      <div
        aria-hidden
        className="absolute inset-0 h-[70vh] pointer-events-none transition-colors duration-1000"
        style={heroStyle}
      />
      <div
        aria-hidden
        className="absolute inset-0 h-[70vh] pointer-events-none opacity-[0.03] dark:opacity-[0.06]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "180px 180px",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 h-[70vh] bg-gradient-to-b from-transparent via-background/50 to-background pointer-events-none"
      />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        {/* ── Back button ── */}
        <div className="pt-5 pb-2">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-sm font-bold transition-all duration-200 text-foreground/60 hover:text-foreground px-2 py-1 rounded-lg hover:bg-background/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
          >
            <ChevronLeft className="size-4" aria-hidden /> Quay lại
          </button>
        </div>

        {/* ── Hero section ── */}
        <motion.section
          aria-label="Playlist details"
          className="flex flex-col md:flex-row items-center md:items-end gap-7 md:gap-10 pt-10 pb-8 md:pt-16 md:pb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          {/* Cover */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...SP_HERO, delay: 0.08 }}
          >
            <PlaylistCover
              playlist={playlist}
              palette={palette}
              isOwner={isOwner}
              isPlaying={isThisPlaylistPlaying}
              size="lg"
              onEditCover={openEditMeta}
            />
          </motion.div>

          {/* Meta */}
          <motion.div
            className="flex flex-col items-center md:items-start text-center md:text-left gap-3 w-full min-w-0 pb-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SP_HERO, delay: 0.14 }}
          >
            {/* Type + visibility badges */}
            <div className="flex items-center gap-2 flex-wrap justify-center md:justify-start">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/30 backdrop-blur-md border border-white/15 text-[10px] font-black uppercase tracking-[0.18em] text-foreground/85">
                {playlist.isSystem ? (
                  <>
                    <Sparkles className="size-3" aria-hidden /> Hệ thống
                  </>
                ) : (
                  <>
                    <Users className="size-3" aria-hidden /> Cộng đồng
                  </>
                )}
              </div>
              <VisibilityBadge visibility={playlist.visibility} />
            </div>

            {/* Title */}
            <h1
              className={cn(
                "font-black tracking-tighter text-foreground drop-shadow-lg w-full",
                "text-center md:text-left",
                titleCls,
              )}
              style={titleStyle}
            >
              {playlist.title}
            </h1>

            {/* Description or add-description prompt */}
            {playlist.description ? (
              <p className="text-sm md:text-[15px] text-muted-foreground font-medium line-clamp-2 max-w-xl mt-0.5 text-center md:text-left">
                {playlist.description}
              </p>
            ) : isOwner ? (
              <button
                type="button"
                onClick={openEditMeta}
                className="text-sm text-muted-foreground/45 italic hover:text-primary transition-colors flex items-center gap-1.5 mt-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded"
              >
                <PenSquare className="size-3.5" aria-hidden /> Thêm mô tả cho
                danh sách phát…
              </button>
            ) : null}

            {/* Owner row */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-2.5 gap-y-1.5 mt-1.5">
              <button
                type="button"
                onClick={() => navigate(`/profile/${playlist.user?._id}`)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity group/user focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded"
                aria-label={`Xem hồ sơ: ${playlist.user?.fullName ?? "Hệ thống"}`}
              >
                <Avatar className="size-6 border-[1.5px] border-background/70 shadow-sm">
                  <AvatarImage src={playlist.user?.avatar} />
                  <AvatarFallback className="text-[9px] font-black bg-primary/20 text-primary">
                    {playlist.user?.fullName?.[0] ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-black text-foreground group-hover/user:underline underline-offset-3 decoration-2">
                  {playlist.user?.fullName ?? "Hệ thống"}
                </span>
              </button>

              <span
                className="text-foreground/30 text-xs hidden sm:inline"
                aria-hidden
              >
                •
              </span>

              <PlaylistMeta
                trackCount={totalItems}
                durationSec={totalDurationSec}
                createdAt={playlist.createdAt}
              />
            </div>

            {/* Now-playing status pill */}
            <AnimatePresence>
              {isThisPlaylistActive && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.88, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.88, y: 4 }}
                  transition={SP_SNAPPY}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-sm"
                  style={{
                    background: palette.r(0.1),
                    borderColor: palette.r(0.28),
                  }}
                >
                  <WaveformBars
                    color={palette.hex}
                    active={isThisPlaylistPlaying}
                  />
                  <span
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: palette.hex }}
                  >
                    {isThisPlaylistPlaying ? "Đang phát" : "Đã tạm dừng"}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.section>

        {/* ── Sticky action bar ── */}
        <div
          className={cn(
            "sticky z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-8 overflow-x-scroll scrollbar-thin",
            "flex items-center justify-between gap-4",
            "transition-[background,box-shadow,border-color] duration-300",
            "top-[var(--navbar-height,64px)]",
            "shadow-brand-dynamic",
            isScrolled
              ? "bg-background/88 backdrop-blur-2xl border-b border-border/40 shadow-sm"
              : "bg-transparent border-b border-transparent",
          )}
          style={stickyStyle}
        >
          <PlaylistActionBar {...sharedActionBarProps} density="full" />

          {/* Scrolled identity strip */}
          <AnimatePresence>
            {isScrolled && (
              <motion.div
                className="flex items-center gap-2.5 pointer-events-none select-none shrink-0"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={SP_GENTLE}
                aria-hidden
              >
                <AnimatePresence>
                  {isThisPlaylistPlaying && (
                    <WaveformBars
                      color={palette.hex}
                      active={isThisPlaylistPlaying}
                    />
                  )}
                </AnimatePresence>

                <span className="text-sm font-bold text-foreground/80 truncate max-w-[120px] sm:max-w-[200px] lg:max-w-[320px] hidden sm:block">
                  {playlist.title}
                </span>

                {/* Thumbnail with playing ring */}
                <div
                  className={cn(
                    "size-9 sm:size-10 rounded-lg overflow-hidden shrink-0 border bg-muted flex items-center justify-center transition-all duration-300",
                    isThisPlaylistPlaying
                      ? "border-transparent"
                      : "border-border/30",
                  )}
                  style={
                    isThisPlaylistPlaying
                      ? { boxShadow: `0 0 0 2px ${palette.r(0.7)}` }
                      : undefined
                  }
                >
                  {playlist.coverImage ? (
                    <ImageWithFallback
                      src={playlist.coverImage}
                      alt=""
                      aria-hidden
                      className="size-full object-cover"
                    />
                  ) : (
                    <ListMusic
                      className="size-4 text-muted-foreground/40"
                      aria-hidden
                    />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Track list ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SP_GENTLE, delay: 0.22 }}
        >
          <Suspense fallback={<WaveformBars active />}>
            <LazyTrackList
              {...trackListProps}
              maxHeight="auto"
              skeletonCount={APP_CONFIG.PAGINATION_LIMIT}
              moodColor={palette.hslChannels}
              staggerAnimation
            />
          </Suspense>
        </motion.div>

        {/* ── Footer ── */}
        {totalItems > 0 && (
          <footer className="mt-16 pt-7 border-t border-border/25 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground/60 font-medium pb-8">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 opacity-50" aria-hidden />
              Tạo ngày {dayjs(playlist.createdAt).format("DD/MM/YYYY")}
            </span>
            <span
              className="text-muted-foreground/30 hidden sm:inline"
              aria-hidden
            >
              ·
            </span>
            <span className="font-bold text-foreground/60">
              {totalItems} bài hát
            </span>
            {totalDurationSec > 0 && (
              <>
                <span
                  className="text-muted-foreground/30 hidden sm:inline"
                  aria-hidden
                >
                  ·
                </span>
                <span>{formatDuration(totalDurationSec)}</span>
              </>
            )}
          </footer>
        )}
      </div>

      <PlaylistModals {...modalProps} />
    </main>
  );
};

export default PlaylistDetailPage;
