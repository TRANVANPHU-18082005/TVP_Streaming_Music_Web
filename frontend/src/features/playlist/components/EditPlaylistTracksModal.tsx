"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  memo,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import {
  ListMusic,
  Plus,
  Disc,
  CheckCircle2,
  Loader2,
  Save,
  Trash2,
  MoveVertical,
  Settings2,
  X,
  Music4,
  Undo2,
  AlertCircle,
} from "lucide-react";
import Pagination from "@/utils/pagination";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import MusicResult from "@/components/ui/Result";
import { cn } from "@/lib/utils";

import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import {
  usePlaylistDetail,
  usePlaylistTracksInfinite,
} from "@/features/playlist/hooks/usePlaylistsQuery";
import { usePlaylistMutations } from "@/features/playlist/hooks/usePlaylistMutations";
import { SortablePlaylistTrackRow } from "@/features/playlist/components/SortablePlaylistTrackRow";
import { ModalTrackFilter } from "@/features/track/components/ModalTrackFilter";
import { ITrack } from "@/features/track/types";
import { usePublicTracks } from "@/features/track/hooks/useTracksQuery";
import { TrackFilterParams } from "@/features/track";
import { APP_CONFIG } from "@/config/constants";
import {
  selectPlayer,
  setIsPlaying,
  setQueue,
} from "@/features/player/slice/playerSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { handleError } from "@/utils/handleError";
import LazyImage from "@/features/track/components/LazyImage";
import { useSelector } from "react-redux";
import ArtistDisplay from "@/features/artist/components/ArtistDisplay";
import { prefersReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { TrackTitleMarquee } from "@/features/player/components/TrackTitleMarquee";

// ─── Types ─────────────────────────────────────────────────────────────────

type TabKey = "add" | "reorder" | "manage";

interface EditPlaylistTracksModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlistId: string | undefined;
}

// ─── Undo Toast ────────────────────────────────────────────────────────────

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}

const UndoToast = memo(({ message, onUndo, onDismiss }: UndoToastProps) => {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    // fixed position inside modal — bottom-4 + safe area on iOS
    <div className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-30 animate-in slide-in-from-bottom-3 fade-in duration-200 pointer-events-auto w-[calc(100%-2rem)] max-w-sm">
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-foreground text-background shadow-2xl text-sm font-medium">
        <span className="flex-1 truncate text-[13px]">{message}</span>
        <button
          type="button"
          onClick={onUndo}
          className="flex items-center gap-1.5 text-primary font-bold hover:opacity-80 transition-opacity shrink-0 text-[13px]"
        >
          <Undo2 className="size-3.5" />
          Hoàn tác
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Đóng thông báo"
          className="text-background/40 hover:text-background transition-colors shrink-0 ml-0.5"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
});
UndoToast.displayName = "UndoToast";

// ─── Confirm Dialog ────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  message: string;
  description?: string;
  confirmLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog = memo(
  ({
    message,
    description,
    confirmLabel = "Xác nhận",
    isDestructive = true,
    onConfirm,
    onCancel,
  }: ConfirmDialogProps) => (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-5 bg-background/80 backdrop-blur-sm rounded-[inherit] animate-in fade-in duration-150">
      <div className="w-full max-w-xs bg-card border border-border/60 rounded-2xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex gap-3">
          <div className="size-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertCircle className="size-4.5 text-destructive" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-[14px] text-foreground">{message}</p>
            {description && (
              <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-9 px-4 rounded-xl text-sm"
          >
            Huỷ
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isDestructive ? "destructive" : "default"}
            onClick={onConfirm}
            className="h-9 px-4 rounded-xl text-sm font-bold"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  ),
);
ConfirmDialog.displayName = "ConfirmDialog";

// ─── Skeleton ──────────────────────────────────────────────────────────────

const TrackListSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className="space-y-2">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        style={{ animationDelay: `${i * 50}ms` }}
        className="flex items-center gap-3 p-2.5 rounded-2xl bg-card border border-border/30 animate-pulse"
      >
        <div className="size-10 rounded-xl bg-muted/50 shrink-0" />
        <div className="flex-1 space-y-1.5 min-w-0">
          <div className="h-3 w-3/5 bg-muted/50 rounded-full" />
          <div className="h-2.5 w-2/5 bg-muted/30 rounded-full" />
        </div>
        <div className="size-7 rounded-full bg-muted/30 shrink-0" />
      </div>
    ))}
  </div>
);

// ─── Drag Preview Card ─────────────────────────────────────────────────────

const DragPreviewCard = ({ track }: { track: ITrack }) => (
  <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl border border-primary/50 bg-background/95 shadow-2xl ring-1 ring-primary/20 cursor-grabbing">
    <div className="size-8 flex items-center justify-center text-primary/60 shrink-0">
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
        {[5, 12, 19].flatMap((cy) =>
          [9, 15].map((cx) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.5} />
          )),
        )}
      </svg>
    </div>
    <Avatar className="size-10 rounded-xl border border-border/50 shrink-0">
      <AvatarImage src={track.coverImage} className="object-cover" />
      <AvatarFallback className="bg-muted rounded-xl">
        <Disc className="size-4 opacity-40" />
      </AvatarFallback>
    </Avatar>
    <div className="min-w-0 flex-1">
      <p className="text-[13px] font-semibold text-primary truncate">
        {track.title}
      </p>
      <p className="text-[11px] text-muted-foreground truncate">
        {track.artist?.name}
      </p>
    </div>
  </div>
);

// ─── Shared Track Info Cell ────────────────────────────────────────────────
// Reusable block to avoid duplicating Link + ArtistDisplay logic

const TrackInfo = memo(
  ({ track, isActive }: { track: ITrack; isActive: boolean }) => {
    if (isActive) {
      return (
        <TrackTitleMarquee
          id={track._id}
          title={track.title}
          mainArtist={track.artist}
          featuringArtists={track.featuringArtists}
          className="text-[13px]"
          artistClassName="text-xs"
        />
      );
    }
    return (
      <>
        <Link
          to={`/tracks/${track._id}`}
          title={track.title}
          className={cn(
            "block truncate text-[13px] font-semibold leading-snug mb-0.5",
            "text-foreground/90 hover:text-foreground",
            prefersReducedMotion ? "" : "transition-colors duration-100",
          )}
        >
          {track.title}
        </Link>
        <ArtistDisplay
          mainArtist={track.artist}
          featuringArtists={track.featuringArtists}
          className={cn(
            "block truncate text-[11px] text-muted-foreground/55",
            "hover:text-muted-foreground/80 hover:underline underline-offset-2",
            prefersReducedMotion ? "" : "transition-colors duration-100",
          )}
        />
      </>
    );
  },
);
TrackInfo.displayName = "TrackInfo";

// ─── Add Track Row ─────────────────────────────────────────────────────────

interface AddTrackRowProps {
  track: ITrack;
  index: number;
  isAdded: boolean;
  isThisMutating: boolean;
  isAnyMutating: boolean;
  isPlaying: boolean;
  isActive: boolean;
  onAdd: (id: string) => void;
  onPlay: (track: ITrack) => void;
}

const AddTrackRow = memo(
  ({
    track,
    index,
    isAdded,
    isThisMutating,
    isPlaying,
    isActive,
    isAnyMutating,
    onPlay,
    onAdd,
  }: AddTrackRowProps) => {
    const disabled = isAdded || isThisMutating || isAnyMutating;
    const { loadingState } = useSelector(selectPlayer);
    const isGlobalLoading =
      loadingState === "loading" || loadingState === "buffering";

    return (
      <div
        style={{ animationDelay: `${Math.min(index * 20, 200)}ms` }}
        className={cn(
          "flex items-center gap-2.5 p-2.5 rounded-2xl border transition-all duration-200 group",
          "animate-in fade-in slide-in-from-bottom-1",
          isAdded
            ? "bg-emerald-500/5 border-emerald-500/15"
            : "bg-card border-border/40 hover:border-primary/25 hover:shadow-sm",
        )}
      >
        {/* Cover */}
        <div className="shrink-0">
          <LazyImage
            src={track.coverImage}
            alt={track.title}
            isActive={isActive}
            isLoading={isGlobalLoading}
            isCurrentPlaying={isPlaying && isActive}
            onClick={() => onPlay(track)}
          />
        </div>

        {/* Info — flex-1 + min-w-0 is the only constraint needed */}
        <div className="min-w-0 flex-1">
          <TrackInfo track={track} isActive={isActive} />
        </div>

        {/* Add button — 44×44 touch area via padding trick */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => !isAdded && onAdd(track._id)}
          aria-label={
            isAdded ? `${track.title} đã được thêm` : `Thêm ${track.title}`
          }
          className={cn(
            "shrink-0 flex items-center justify-center rounded-full",
            "transition-all duration-150 outline-none",
            "focus-visible:ring-2 focus-visible:ring-primary/50",
            "size-8 p-[6px] -m-[3px]",
            isAdded
              ? "text-emerald-500 cursor-default"
              : [
                  "border border-border/50 bg-background shadow-sm",
                  "hover:bg-primary hover:text-primary-foreground hover:border-primary",
                  "hover:shadow-md hover:scale-110 active:scale-90",
                  disabled &&
                    "opacity-40 cursor-not-allowed pointer-events-none",
                ],
          )}
        >
          {isThisMutating ? (
            <Loader2 className="size-full animate-spin" />
          ) : isAdded ? (
            <CheckCircle2 className="size-full" />
          ) : (
            <Plus className="size-full" />
          )}
        </button>
      </div>
    );
  },
);
AddTrackRow.displayName = "AddTrackRow";

// ─── Manage Track Row ──────────────────────────────────────────────────────

interface ManageTrackRowProps {
  track: ITrack;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: (track: ITrack) => void;
  isRemoving: boolean;
  isAnyMutating: boolean;
  onRemove: (id: string) => void;
}

const ManageTrackRow = memo(
  ({
    isActive,
    isPlaying,
    onPlay,
    track,
    index,
    isRemoving,
    isAnyMutating,
    onRemove,
  }: ManageTrackRowProps) => {
    const { loadingState } = useSelector(selectPlayer);
    const isGlobalLoading =
      loadingState === "loading" || loadingState === "buffering";

    return (
      <div
        style={{ animationDelay: `${Math.min(index * 20, 200)}ms` }}
        className={cn(
          "flex items-center gap-2.5 p-2.5 rounded-2xl border transition-all duration-200 group",
          "animate-in fade-in slide-in-from-bottom-1",
          "bg-card border-border/40 hover:border-destructive/15",
        )}
      >
        {/* Index number */}
        <span className="w-5 text-center text-[10px] font-mono font-bold text-muted-foreground/35 shrink-0 tabular-nums select-none">
          {String(index + 1).padStart(2, "0")}
        </span>

        {/* Cover */}
        <div className="shrink-0">
          <LazyImage
            src={track.coverImage}
            alt={track.title}
            isActive={isActive}
            isLoading={isGlobalLoading}
            isCurrentPlaying={isPlaying && isActive}
            onClick={() => onPlay(track)}
          />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <TrackInfo track={track} isActive={isActive} />
        </div>

        {/* Remove button */}
        <button
          type="button"
          disabled={isRemoving || isAnyMutating}
          onClick={() => onRemove(track._id)}
          aria-label={`Xóa "${track.title}"`}
          className={cn(
            "shrink-0 flex items-center justify-center rounded-full",
            "transition-all duration-150 outline-none",
            "focus-visible:ring-2 focus-visible:ring-destructive/50",
            "size-8 p-[6px] -m-[3px]",
            isRemoving
              ? "cursor-wait text-muted-foreground/30"
              : [
                  "text-muted-foreground/40",
                  // Always visible on touch devices, subtle on desktop until hover
                  "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                  "hover:text-destructive hover:bg-destructive/10 active:scale-90",
                  isAnyMutating &&
                    !isRemoving &&
                    "opacity-30 cursor-not-allowed pointer-events-none",
                ],
          )}
        >
          {isRemoving ? (
            <Loader2 className="size-full animate-spin" />
          ) : (
            <Trash2 className="size-full" />
          )}
        </button>
      </div>
    );
  },
);
ManageTrackRow.displayName = "ManageTrackRow";

// ─── Summary Bar ──────────────────────────────────────────────────────────
// Sticky info + action row used in Add and Manage tabs

interface SummaryBarProps {
  left: React.ReactNode;
  right: React.ReactNode;
}
const SummaryBar = ({ left, right }: SummaryBarProps) => (
  <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm">
    <div className="min-w-0">{left}</div>
    <div className="shrink-0">{right}</div>
  </div>
);

// ─── Main Modal ────────────────────────────────────────────────────────────

export const EditPlaylistTracksModal: React.FC<
  EditPlaylistTracksModalProps
> = ({ isOpen, onClose, playlistId }) => {
  const [activeTab, setActiveTab] = useState<TabKey>("add");

  const [trackParams, setTrackParams] = useState<TrackFilterParams>({
    sort: "newest",
    page: 1,
    limit: APP_CONFIG.SELECTOR_LIMIT,
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    description?: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  const [undoToast, setUndoToast] = useState<{
    message: string;
    onUndo: () => void;
  } | null>(null);

  const [mutatingIds, setMutatingIds] = useState<Set<string>>(new Set());
  const [orderedTracks, setOrderedTracks] = useState<ITrack[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────
  const { data: searchRes, isLoading: isSearching } = usePublicTracks({
    ...trackParams,
    limit: 15,
    isPublic: true,
  });

  const { data: playlist, isLoading: isLoadingPlaylist } = usePlaylistDetail(
    playlistId ?? "",
  );

  const { data: tracksData, isLoading: isLoadingTracks } =
    usePlaylistTracksInfinite(playlistId, APP_CONFIG.MAX_LIMIT);

  const { addTracks, removeTracks, reorderTracks, isTrackMutating } =
    usePlaylistMutations();

  // ── Derived state ──────────────────────────────────────────────────────
  const searchResults = useMemo<ITrack[]>(
    () => searchRes?.tracks ?? [],
    [searchRes?.tracks],
  );
  const meta = useMemo(() => searchRes?.meta, [searchRes?.meta]);

  const currentTracks = useMemo<ITrack[]>(
    () => tracksData?.allTracks ?? [],
    [tracksData?.allTracks],
  );

  const existingTrackIds = useMemo(
    () => new Set(currentTracks.map((t: ITrack) => t._id)),
    [currentTracks],
  );

  const addableTracks = useMemo(
    () => searchResults.filter((t) => !existingTrackIds.has(t._id)),
    [searchResults, existingTrackIds],
  );

  const isLoadingContent = isLoadingPlaylist || isLoadingTracks;
  const isBulkMutating =
    mutatingIds.has("bulk-add") || mutatingIds.has("bulk-remove");

  // ── Sync orderedTracks ─────────────────────────────────────────────────
  useEffect(() => {
    if (isDirty) return;
    const source = tracksData?.allTracks ?? [];
    if (source.length === 0) return;
    const idOrder = playlist?.trackIds ?? source.map((t: ITrack) => t._id);
    const map = new Map(source.map((t: ITrack) => [t._id, t]));
    const ordered = idOrder
      .map((id: string) => map.get(id))
      .filter(Boolean) as ITrack[];
    setOrderedTracks(ordered.length > 0 ? ordered : source);
  }, [tracksData?.allTracks, playlist?.trackIds, isDirty]);

  // ── Clear mutatingIds after mutation settles ───────────────────────────
  const prevMutating = useRef(isTrackMutating);
  const onPageChange = useCallback(
    (page: number) => setTrackParams((prev) => ({ ...prev, page })),
    [],
  );
  useEffect(() => {
    if (prevMutating.current && !isTrackMutating) setMutatingIds(new Set());
    prevMutating.current = isTrackMutating;
  }, [isTrackMutating]);

  // ── Lock body scroll ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // ── Helpers ────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setConfirmDialog(null);
    setUndoToast(null);
    onClose();
  }, [onClose]);

  const addToMutating = useCallback((...ids: string[]) => {
    setMutatingIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  // ── DnD ───────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
  );

  const activeDragTrack = useMemo(
    () =>
      activeDragId ? orderedTracks.find((t) => t._id === activeDragId) : null,
    [activeDragId, orderedTracks],
  );

  const handleDragStart = useCallback(
    (e: DragStartEvent) => setActiveDragId(String(e.active.id)),
    [],
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedTracks((items) => {
      const from = items.findIndex((t) => t._id === active.id);
      const to = items.findIndex((t) => t._id === over.id);
      return arrayMove(items, from, to);
    });
    setIsDirty(true);
  }, []);

  // ── Track actions ──────────────────────────────────────────────────────
  const handleAddTrack = useCallback(
    (trackId: string) => {
      if (!playlistId) return;
      addToMutating(trackId);
      addTracks(playlistId, [trackId]);
    },
    [playlistId, addTracks, addToMutating],
  );

  const handleAddAllVisible = useCallback(() => {
    if (!playlistId || addableTracks.length === 0) return;
    setConfirmDialog({
      message: `Thêm ${addableTracks.length} bài hát?`,
      description: "Tất cả kết quả đang hiển thị sẽ được thêm vào playlist.",
      confirmLabel: "Thêm tất cả",
      onConfirm: () => {
        setConfirmDialog(null);
        addToMutating("bulk-add");
        addTracks(
          playlistId,
          addableTracks.map((t) => t._id),
        );
      },
    });
  }, [playlistId, addableTracks, addTracks, addToMutating]);

  const { currentTrackId, isPlaying: isGlobalPlaying } =
    useAppSelector(selectPlayer);
  const dispatch = useAppDispatch();

  const handlePlayTrack = useCallback(
    async (t: ITrack) => {
      if (currentTrackId === t._id) {
        dispatch(setIsPlaying(!isGlobalPlaying));
        return;
      }
      try {
        dispatch(
          setQueue({
            trackIds: [t._id],
            initialMetadata: [t],
            startIndex: 0,
            isShuffling: false,
            source: { id: t._id, type: "single", title: t.title, url: "" },
          }),
        );
      } catch (err) {
        handleError(err, "Không thể phát bài hát này");
      }
    },
    [currentTrackId, isGlobalPlaying, dispatch],
  );

  const handleRemoveTrack = useCallback(
    (trackId: string) => {
      if (!playlistId) return;
      const track = currentTracks.find((t: ITrack) => t._id === trackId);
      addToMutating(trackId);
      removeTracks(playlistId, [trackId]);
      if (track) {
        setUndoToast({
          message: `Đã xóa "${track.title}"`,
          onUndo: () => {
            setUndoToast(null);
            handleAddTrack(trackId);
          },
        });
      }
    },
    [playlistId, currentTracks, removeTracks, addToMutating, handleAddTrack],
  );

  const handleRemoveAll = useCallback(() => {
    if (!playlistId || currentTracks.length === 0) return;
    setConfirmDialog({
      message: `Xóa tất cả ${currentTracks.length} bài hát?`,
      description: "Hành động này không thể hoàn tác.",
      confirmLabel: "Xóa tất cả",
      onConfirm: () => {
        setConfirmDialog(null);
        addToMutating("bulk-remove");
        removeTracks(
          playlistId,
          currentTracks.map((t: ITrack) => t._id),
        );
      },
    });
  }, [playlistId, currentTracks, removeTracks, addToMutating]);

  const handleSaveOrder = useCallback(() => {
    if (!playlistId) return;
    if (isDirty) {
      reorderTracks(
        playlistId,
        orderedTracks.map((t) => t._id),
      );
      setIsDirty(false);
    }
    handleClose();
  }, [playlistId, isDirty, orderedTracks, reorderTracks, handleClose]);

  const handleDiscardReorder = useCallback(() => {
    setOrderedTracks(currentTracks);
    setIsDirty(false);
  }, [currentTracks]);

  if (!isOpen) return null;

  // ── Tab config ─────────────────────────────────────────────────────────
  const tabs = [
    {
      val: "add" as TabKey,
      icon: Plus,
      label: "Thêm nhạc",
      shortLabel: "Thêm",
    },
    {
      val: "reorder" as TabKey,
      icon: MoveVertical,
      label: "Sắp xếp",
      shortLabel: "Xếp",
      badge: isDirty ? "●" : undefined,
    },
    {
      val: "manage" as TabKey,
      icon: Settings2,
      label: "Đã lưu",
      shortLabel: "Đã lưu",
      badge:
        currentTracks.length > 0 ? String(currentTracks.length) : undefined,
    },
  ] as const;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Quản lý bài hát trong playlist"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        aria-hidden="true"
        onClick={handleClose}
      />

      {/* ── Modal shell ─────────────────────────────────────────────────
          On mobile  : full-height sheet from bottom (100dvh)
          On sm+     : centered card, max 740px tall
          flex-col + overflow-hidden is the key — each section controls
          its own scroll, no fixed-height inner divs needed.
      */}
      <div className="relative z-[101] w-full max-w-2xl flex flex-col h-[100dvh] sm:h-[88vh] sm:max-h-[740px] rounded-t-[28px] sm:rounded-3xl bg-background border border-border/30 shadow-2xl animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300 overflow-hidden">
        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div className="shrink-0 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-border/40 flex items-center gap-3 bg-background/95 backdrop-blur-md z-10">
          {/* Drag handle (mobile only) */}
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-border/60 sm:hidden" />

          <div className="size-9 sm:size-10 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/15 shrink-0">
            <ListMusic className="size-4 sm:size-5 text-primary" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-[15px] sm:text-[17px] text-foreground tracking-tight truncate leading-tight">
              Quản lý Bài hát
            </h2>
            <p className="text-[11px] sm:text-[12px] text-muted-foreground truncate mt-0.5">
              {isLoadingPlaylist
                ? "Đang tải..."
                : (playlist?.title ?? "Playlist")}
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClose}
            aria-label="Đóng"
            className="rounded-full size-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* ── TABS + FILTER ────────────────────────────────────────────── */}
        <div className="shrink-0 px-4 sm:px-6 pt-3 pb-3 border-b border-border/30 bg-card/40 z-10 space-y-3">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabKey)}
          >
            <TabsList className="w-full h-10 sm:h-11 bg-muted/40 p-1 grid grid-cols-3 rounded-2xl">
              {tabs.map((item) => (
                <TabsTrigger
                  key={item.val}
                  value={item.val}
                  className={cn(
                    "flex items-center justify-center gap-1.5 h-full rounded-xl transition-all",
                    "text-[11px] sm:text-[12px] font-bold uppercase tracking-wide",
                    "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                    "text-muted-foreground",
                  )}
                >
                  <item.icon className="size-3.5 shrink-0" />
                  {/* shortLabel on mobile, full label on sm+ */}
                  <span className="sm:hidden">{item.shortLabel}</span>
                  <span className="hidden sm:inline truncate">
                    {item.label}
                  </span>
                  {"badge" in item && item.badge && (
                    <span
                      className={cn(
                        "inline-flex items-center justify-center rounded-full leading-none",
                        item.badge === "●"
                          ? "text-primary text-[14px] -mt-0.5"
                          : "bg-primary/15 text-primary text-[9px] font-black px-1.5 py-0.5 min-w-[18px]",
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Filter only shown in Add tab */}
          {activeTab === "add" && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
              <ModalTrackFilter
                params={trackParams}
                onChange={setTrackParams}
              />
            </div>
          )}
        </div>

        {/* ── CONTENT AREA ─────────────────────────────────────────────
            flex-1 + min-h-0 lets this section grow to fill remaining space.
            Each tab wraps its list in a single ScrollArea — no nested
            overflow divs with fixed heights.
        */}
        <div className="flex-1 min-h-0 relative flex flex-col">
          {/* ══ TAB: ADD ══════════════════════════════════════════════ */}
          {activeTab === "add" && (
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-4 sm:px-5 pt-3 pb-6 space-y-2.5">
                {/* Summary bar */}
                <SummaryBar
                  left={
                    <>
                      <p className="text-[13px] font-bold text-foreground">
                        {searchResults.length} kết quả
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {currentTracks.length} bài đã có trong playlist
                      </p>
                    </>
                  }
                  right={
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={
                        addableTracks.length === 0 ||
                        isBulkMutating ||
                        isTrackMutating
                      }
                      onClick={handleAddAllVisible}
                      className="h-9 px-3.5 rounded-xl text-xs font-bold"
                    >
                      {mutatingIds.has("bulk-add") ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : addableTracks.length > 0 ? (
                        `+ ${addableTracks.length} bài`
                      ) : (
                        "Đã có tất cả"
                      )}
                    </Button>
                  }
                />

                {/* Track list */}
                {isSearching ? (
                  <TrackListSkeleton />
                ) : searchResults.length === 0 ? (
                  <MusicResult
                    variant="empty"
                    title="Không tìm thấy bài hát"
                    description="Thử tìm kiếm với tên ca sĩ hoặc bài hát khác."
                  />
                ) : (
                  <div className="space-y-1.5">
                    {searchResults.map((track, idx) => (
                      <AddTrackRow
                        key={track._id}
                        track={track}
                        index={idx}
                        isActive={currentTrackId === track._id}
                        isPlaying={
                          isGlobalPlaying && currentTrackId === track._id
                        }
                        isAdded={existingTrackIds.has(track._id)}
                        isThisMutating={
                          mutatingIds.has(track._id) && isTrackMutating
                        }
                        isAnyMutating={isTrackMutating}
                        onPlay={handlePlayTrack}
                        onAdd={handleAddTrack}
                      />
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {!isSearching && searchResults.length > 0 && (
                  <div className="pt-1">
                    <Pagination
                      currentPage={meta?.page || 1}
                      totalPages={meta?.totalPages || 1}
                      onPageChange={onPageChange}
                      totalItems={meta?.totalItems || 0}
                      pageSize={meta?.pageSize || APP_CONFIG.PAGINATION_LIMIT}
                    />
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {/* ══ TAB: REORDER ══════════════════════════════════════════ */}
          {activeTab === "reorder" && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <ScrollArea className="flex-1 min-h-0">
                <div className="px-4 sm:px-5 pt-3 pb-6 space-y-2.5">
                  {isLoadingContent ? (
                    <TrackListSkeleton />
                  ) : orderedTracks.length === 0 ? (
                    // Empty state — centered vertically using min-h trick
                    <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground animate-in fade-in">
                      <div className="size-14 rounded-full bg-card border border-dashed border-border flex items-center justify-center">
                        <Music4 className="size-7 opacity-20" />
                      </div>
                      <p className="text-sm font-bold">Playlist đang trống</p>
                      <Button
                        type="button"
                        variant="link"
                        onClick={() => setActiveTab("add")}
                        className="text-primary font-bold h-9"
                      >
                        Thêm nhạc ngay →
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* Drag hint bar */}
                      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl border border-border/30 bg-card/50 text-[11px] sm:text-[12px] text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <MoveVertical className="size-3.5 shrink-0 opacity-50" />
                          <span>
                            Kéo thả để sắp xếp.{" "}
                            <strong className="text-foreground">
                              Lưu thứ tự
                            </strong>{" "}
                            khi xong.
                          </span>
                        </div>
                        {isDirty && (
                          <button
                            type="button"
                            onClick={handleDiscardReorder}
                            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors shrink-0 ml-2"
                          >
                            Hoàn tác
                          </button>
                        )}
                      </div>

                      <SortableContext
                        items={orderedTracks.map((t) => t._id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-1.5">
                          {orderedTracks.map((track, idx) => (
                            <SortablePlaylistTrackRow
                              key={track._id}
                              track={track}
                              index={idx}
                              onPlay={handlePlayTrack}
                              isActive={currentTrackId === track._id}
                              isPlaying={
                                isGlobalPlaying && currentTrackId === track._id
                              }
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </>
                  )}
                </div>
              </ScrollArea>

              <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
                {activeDragTrack && <DragPreviewCard track={activeDragTrack} />}
              </DragOverlay>
            </DndContext>
          )}

          {/* ══ TAB: MANAGE ═══════════════════════════════════════════ */}
          {activeTab === "manage" && (
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-4 sm:px-5 pt-3 pb-6 space-y-2.5">
                {currentTracks.length > 0 && (
                  <SummaryBar
                    left={
                      <>
                        <p className="text-[13px] font-bold text-foreground">
                          {currentTracks.length} bài hát
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Nhấn ⏐ để xóa từng bài.
                        </p>
                      </>
                    }
                    right={
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isBulkMutating || isTrackMutating}
                        onClick={handleRemoveAll}
                        className="h-9 px-3 rounded-xl text-xs font-bold text-destructive hover:bg-destructive/10"
                      >
                        {mutatingIds.has("bulk-remove") ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="size-3.5 mr-1" />
                            Xóa tất cả
                          </>
                        )}
                      </Button>
                    }
                  />
                )}

                {currentTracks.length === 0 ? (
                  isLoadingContent ? (
                    <TrackListSkeleton />
                  ) : (
                    <MusicResult
                      variant="empty"
                      title="Chưa có bài hát"
                      description="Chuyển sang tab Thêm nhạc để bắt đầu."
                    />
                  )
                ) : (
                  <div className="space-y-1.5">
                    {currentTracks.map((track: ITrack, i: number) => (
                      <ManageTrackRow
                        key={track._id}
                        track={track}
                        index={i}
                        isActive={currentTrackId === track._id}
                        isPlaying={
                          isGlobalPlaying && currentTrackId === track._id
                        }
                        isRemoving={
                          mutatingIds.has(track._id) && isTrackMutating
                        }
                        isAnyMutating={isTrackMutating}
                        onPlay={handlePlayTrack}
                        onRemove={handleRemoveTrack}
                      />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {/* ── Confirm overlay ── */}
          {confirmDialog && (
            <ConfirmDialog
              message={confirmDialog.message}
              description={confirmDialog.description}
              confirmLabel={confirmDialog.confirmLabel}
              onConfirm={confirmDialog.onConfirm}
              onCancel={() => setConfirmDialog(null)}
            />
          )}

          {/* ── Undo toast ── */}
          {undoToast && (
            <UndoToast
              message={undoToast.message}
              onUndo={undoToast.onUndo}
              onDismiss={() => setUndoToast(null)}
            />
          )}
        </div>

        {/* ── FOOTER ──────────────────────────────────────────────────── */}
        {/* pb-safe: handles iPhone home indicator */}
        <div
          className={cn(
            "shrink-0 px-4 sm:px-6 py-3",
            "pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
            "border-t border-border/40 bg-background/95 backdrop-blur-md",
            "flex items-center justify-between gap-3 z-20",
          )}
        >
          {/* Hint text — two lines on mobile, one on sm+ */}
          <p className="text-[11px] text-muted-foreground font-medium min-w-0 flex-1 hidden sm:block truncate">
            {activeTab === "reorder"
              ? isDirty
                ? "Có thay đổi chưa lưu — nhấn Lưu thứ tự để áp dụng."
                : "Kéo thả để sắp xếp, sau đó nhấn Lưu thứ tự."
              : "Thay đổi được đồng bộ tự động."}
          </p>

          {/* Mobile: show dirty indicator instead of full hint */}
          {activeTab === "reorder" && isDirty && (
            <p className="text-[11px] text-amber-500 font-bold sm:hidden flex-1 min-w-0 truncate">
              Chưa lưu
            </p>
          )}

          <div className="flex gap-2 ml-auto shrink-0">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isTrackMutating}
              className="h-9 px-3.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Đóng
            </Button>

            {activeTab === "reorder" && isDirty && (
              <Button
                type="button"
                onClick={handleSaveOrder}
                disabled={isTrackMutating}
                className="h-9 px-4 rounded-xl text-sm font-bold shadow-sm animate-in zoom-in-95 duration-200"
              >
                {isTrackMutating ? (
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                ) : (
                  <Save className="size-3.5 mr-1.5" />
                )}
                Lưu thứ tự
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default EditPlaylistTracksModal;
