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
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 animate-in slide-in-from-bottom-3 fade-in duration-200 pointer-events-auto">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-foreground text-background shadow-2xl text-sm font-medium whitespace-nowrap">
        <span className="truncate max-w-[160px] sm:max-w-xs">{message}</span>
        <button
          type="button"
          onClick={onUndo}
          className="flex items-center gap-1.5 text-primary font-bold hover:opacity-80 transition-opacity shrink-0"
        >
          <Undo2 className="size-3.5" />
          Hoàn tác
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Đóng thông báo"
          className="text-background/50 hover:text-background transition-colors shrink-0"
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
    <div className="absolute inset-0 z-40 flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm rounded-[inherit] animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-card border border-border/60 rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex gap-3">
          <div className="size-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertCircle className="size-5 text-destructive" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm text-foreground">{message}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">
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
            className="h-10 px-4 rounded-xl"
          >
            Huỷ
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isDestructive ? "destructive" : "default"}
            onClick={onConfirm}
            className="h-10 px-4 rounded-xl font-bold"
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

const TrackListSkeleton = ({ count = 5 }: { count?: number }) => (
  <div className="space-y-2.5">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        style={{ animationDelay: `${i * 60}ms` }}
        className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/30 animate-pulse"
      >
        <div className="size-10 rounded-xl bg-muted/50 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/3 bg-muted/50 rounded-full" />
          <div className="h-2.5 w-1/3 bg-muted/30 rounded-full" />
        </div>
      </div>
    ))}
  </div>
);

// ─── Drag Preview Card ─────────────────────────────────────────────────────

const DragPreviewCard = ({ track }: { track: ITrack }) => (
  <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl border border-primary/50 bg-background shadow-2xl ring-1 ring-primary/20 cursor-grabbing opacity-95">
    <div className="size-8 flex items-center justify-center text-primary shrink-0">
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

// ─── Add Track Row ─────────────────────────────────────────────────────────

interface AddTrackRowProps {
  track: ITrack;
  index: number;
  isAdded: boolean;
  isThisMutating: boolean;
  isAnyMutating: boolean;
  onAdd: (id: string) => void;
}

const AddTrackRow = memo(
  ({
    track,
    index,
    isAdded,
    isThisMutating,
    isAnyMutating,
    onAdd,
  }: AddTrackRowProps) => {
    const disabled = isAdded || isThisMutating || isAnyMutating;

    return (
      <div
        style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}
        className={cn(
          // w-full + overflow-hidden prevent flex blowout on narrow screens
          "w-full flex items-center gap-2.5 p-2.5 rounded-2xl border transition-all duration-200 group overflow-hidden",
          "animate-in fade-in slide-in-from-bottom-1",
          isAdded
            ? "bg-emerald-500/5 border-emerald-500/15"
            : "bg-card border-border/40 hover:border-primary/25 hover:shadow-sm",
        )}
      >
        {/* Cover — fixed width, never shrinks */}
        <Avatar className="size-10 rounded-xl shrink-0 border border-border/50 shadow-sm group-hover:shadow-md transition-shadow">
          <AvatarImage
            src={track.coverImage}
            alt={track.title}
            className="object-cover"
          />
          <AvatarFallback className="bg-muted rounded-xl">
            <Disc className="size-4 opacity-30" />
          </AvatarFallback>
        </Avatar>

        {/* Info — takes all remaining space, truncates text */}
        <div className="min-w-0 flex-1 overflow-hidden max-w-55 md:max-w-none">
          <p
            className={cn(
              "text-[13px] font-semibold truncate leading-snug transition-colors",
              isAdded
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-foreground group-hover:text-primary",
            )}
          >
            {track.title}
          </p>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {track.artist?.name}
          </p>
        </div>

        {/*
         * Touch target = 44×44px via padding trick:
         * Visual button is size-8 (32px), but -m-1 + p-1 extends
         * the tappable area to 40px without affecting flex layout.
         * shrink-0 ensures it never gets squeezed by the info column.
         */}
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
            // 44px tappable zone without altering flex width:
            // visual 32px + 6px padding each side = 44px hit area
            "size-8 p-[6px] -m-[3px]",
            isAdded
              ? "text-emerald-500 cursor-default"
              : [
                  "border border-border/50 bg-background shadow-sm",
                  "hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-md hover:scale-110",
                  "active:scale-90",
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
  isRemoving: boolean;
  isAnyMutating: boolean;
  onRemove: (id: string) => void;
}

const ManageTrackRow = memo(
  ({
    track,
    index,
    isRemoving,
    isAnyMutating,
    onRemove,
  }: ManageTrackRowProps) => (
    <div
      style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}
      className={cn(
        "w-full flex items-center gap-2.5 p-2.5 rounded-2xl border transition-all duration-200 group overflow-hidden",
        "animate-in fade-in slide-in-from-bottom-1",
        "bg-card border-border/40 hover:border-destructive/20",
      )}
    >
      <span className="w-5 text-center text-[10px] font-mono font-bold text-muted-foreground/40 shrink-0 tabular-nums">
        {String(index + 1).padStart(2, "0")}
      </span>

      <Avatar className="size-10 rounded-xl shrink-0 border border-border/50 shadow-sm">
        <AvatarImage
          src={track.coverImage}
          alt={track.title}
          className="object-cover"
        />
        <AvatarFallback className="bg-muted rounded-xl">
          <Disc className="size-4 opacity-30" />
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="text-[13px] font-semibold truncate text-foreground leading-snug">
          {track.title}
        </p>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
          {track.artist?.name}
        </p>
      </div>

      {/* Same padding-trick touch target as AddTrackRow */}
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
                "hover:text-destructive hover:bg-destructive/10 active:scale-90",
                // Always visible on mobile (no hover), hidden on md until hover
                "opacity-100 md:opacity-0 group-hover:opacity-100",
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
  ),
);
ManageTrackRow.displayName = "ManageTrackRow";

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

  // Track IDs currently mid-mutation — cleared once server responds
  const [mutatingIds, setMutatingIds] = useState<Set<string>>(new Set());

  // DnD reorder state
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
    usePlaylistTracksInfinite(playlistId, APP_CONFIG.VIRTUALIZER_LIMIT);

  const { addTracks, removeTracks, reorderTracks, isTrackMutating } =
    usePlaylistMutations();

  // ── Derived state ──────────────────────────────────────────────────────
  const searchResults = useMemo<ITrack[]>(
    () => searchRes?.tracks ?? [],
    [searchRes?.tracks],
  );

  const currentTracks = useMemo<ITrack[]>(
    () => tracksData?.allTracks ?? [],
    [tracksData?.allTracks],
  );

  const existingTrackIds = useMemo(
    () => new Set(currentTracks.map((t: ITrack) => t._id)),
    [currentTracks],
  );

  // Only tracks not yet in playlist — drives the "add N bài" button count
  const addableTracks = useMemo(
    () => searchResults.filter((t) => !existingTrackIds.has(t._id)),
    [searchResults, existingTrackIds],
  );

  const isLoadingContent = isLoadingPlaylist || isLoadingTracks;
  const isBulkMutating =
    mutatingIds.has("bulk-add") || mutatingIds.has("bulk-remove");

  // ── Sync orderedTracks from server (only when not dirty) ──────────────
  useEffect(() => {
    if (isDirty) return;
    const source = tracksData?.allTracks ?? [];
    if (source.length === 0) return; // wait for data

    const idOrder = playlist?.trackIds ?? source.map((t: ITrack) => t._id);
    const map = new Map(source.map((t: ITrack) => [t._id, t]));
    const ordered = idOrder
      .map((id: string) => map.get(id))
      .filter(Boolean) as ITrack[];

    setOrderedTracks(ordered.length > 0 ? ordered : source);
  }, [tracksData?.allTracks, playlist?.trackIds, isDirty]);

  // ── Clear mutatingIds once server says mutation is done ────────────────
  const prevMutating = useRef(isTrackMutating);
  useEffect(() => {
    if (prevMutating.current && !isTrackMutating) {
      setMutatingIds(new Set());
    }
    prevMutating.current = isTrackMutating;
  }, [isTrackMutating]);

  // ── Lock body scroll on open ───────────────────────────────────────────
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

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveDragId(String(e.active.id));
  }, []);

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
    { val: "add" as TabKey, icon: Plus, label: "Thêm nhạc" },
    {
      val: "reorder" as TabKey,
      icon: MoveVertical,
      label: "Sắp xếp",
      badge: isDirty ? "●" : undefined,
    },
    {
      val: "manage" as TabKey,
      icon: Settings2,
      label: "Đã lưu",
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
        className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
        aria-hidden="true"
        onClick={handleClose}
      />

      {/* Modal shell */}
      <div className="relative z-[101] w-full max-w-2xl flex flex-col h-[100dvh] sm:h-[88vh] sm:max-h-[740px] rounded-t-[28px] sm:rounded-3xl overflow-hidden bg-background border border-border/40 shadow-2xl animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300">
        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <div className="shrink-0 px-5 sm:px-6 py-4 border-b border-border/40 flex items-center gap-3 bg-background/95 backdrop-blur-md z-10">
          <div className="size-10 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/15 shrink-0">
            <ListMusic className="size-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-base sm:text-lg text-foreground tracking-tight truncate leading-tight">
              Quản lý Bài hát
            </h2>
            <p className="text-[12px] text-muted-foreground truncate">
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
            className="rounded-full size-10 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
          >
            <X className="size-4.5" />
          </Button>
        </div>

        {/* ── TABS ───────────────────────────────────────────────────── */}
        <div className="shrink-0 px-5 sm:px-6 pt-4 pb-3 border-b border-border/30 bg-card/50 z-10 space-y-3">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabKey)}
          >
            <TabsList className="w-full h-11 bg-muted/40 p-1 grid grid-cols-3 rounded-2xl">
              {tabs.map((item) => (
                <TabsTrigger
                  key={item.val}
                  value={item.val}
                  className={cn(
                    "flex items-center justify-center gap-1.5 h-full rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all",
                    "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                    "text-muted-foreground",
                  )}
                >
                  <item.icon className="size-3.5 shrink-0" />
                  {/* Show label on sm+ only */}
                  <span className="hidden sm:inline truncate">
                    {item.label}
                  </span>
                  {"badge" in item && item.badge && (
                    <span
                      className={cn(
                        "inline-flex items-center justify-center rounded-full text-[9px] font-black leading-none px-1.5 py-0.5 min-w-[18px]",
                        item.badge === "●"
                          ? "text-primary"
                          : "bg-primary/15 text-primary",
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {activeTab === "add" && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <ModalTrackFilter
                params={trackParams}
                onChange={setTrackParams}
              />
            </div>
          )}
        </div>

        {/* ── CONTENT ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden relative flex flex-col min-h-0">
          {/* === TAB: ADD === */}
          {activeTab === "add" && (
            <ScrollArea className="flex-1">
              <div className="p-4 sm:p-5 space-y-2.5 pb-6">
                {/* Summary bar */}
                <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-border/40 bg-card/60">
                  <div>
                    <p className="text-[13px] font-bold text-foreground">
                      {searchResults.length} kết quả
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {currentTracks.length} bài đã có trong playlist
                    </p>
                  </div>
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
                    className="h-10 px-4 rounded-xl text-xs font-bold shrink-0"
                  >
                    {mutatingIds.has("bulk-add") ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : addableTracks.length > 0 ? (
                      `Thêm ${addableTracks.length} bài`
                    ) : (
                      "Không còn bài mới"
                    )}
                  </Button>
                </div>

                {isSearching ? (
                  <TrackListSkeleton />
                ) : searchResults.length === 0 ? (
                  <MusicResult
                    variant="empty"
                    title="Không tìm thấy bài hát"
                    description="Thử tìm kiếm với tên ca sĩ hoặc bài hát khác."
                  />
                ) : (
                  <div className="space-y-2 overflow-y-scroll h-[400px] overflow-x-scroll">
                    {searchResults.map((track, idx) => (
                      <AddTrackRow
                        key={track._id}
                        track={track}
                        index={idx}
                        isAdded={existingTrackIds.has(track._id)}
                        isThisMutating={
                          mutatingIds.has(track._id) && isTrackMutating
                        }
                        isAnyMutating={isTrackMutating}
                        onAdd={handleAddTrack}
                      />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {/* === TAB: REORDER === */}
          {activeTab === "reorder" && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <ScrollArea className="flex-1">
                <div className="p-4 sm:p-5 space-y-2.5 pb-6">
                  {isLoadingContent ? (
                    <TrackListSkeleton />
                  ) : orderedTracks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground animate-in fade-in">
                      <div className="size-16 rounded-full bg-card border border-dashed border-border flex items-center justify-center">
                        <Music4 className="size-8 opacity-20" />
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
                      <div className="flex items-center justify-between gap-2.5 px-4 py-2.5 rounded-2xl border border-border/30 bg-card/40 text-[12px] text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <MoveVertical className="size-3.5 shrink-0 opacity-60" />
                          <span>
                            Kéo thả để sắp xếp — nhấn{" "}
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
                            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors shrink-0"
                          >
                            Hoàn tác
                          </button>
                        )}
                      </div>

                      <SortableContext
                        items={orderedTracks.map((t) => t._id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {orderedTracks.map((track, idx) => (
                            <SortablePlaylistTrackRow
                              key={track._id}
                              track={track}
                              index={idx}
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

          {/* === TAB: MANAGE === */}
          {activeTab === "manage" && (
            <ScrollArea className="flex-1">
              <div className="p-4 sm:p-5 space-y-2.5 pb-6">
                {currentTracks.length > 0 && (
                  <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-border/40 bg-card/60">
                    <div>
                      <p className="text-[13px] font-bold text-foreground">
                        {currentTracks.length} bài hát
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Xóa từng bài hoặc xóa toàn bộ playlist.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isBulkMutating || isTrackMutating}
                      onClick={handleRemoveAll}
                      className="h-10 px-4 rounded-xl text-xs font-bold text-destructive hover:bg-destructive/10 shrink-0"
                    >
                      {mutatingIds.has("bulk-remove") ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="size-3.5 mr-1.5" />
                          Xóa tất cả
                        </>
                      )}
                    </Button>
                  </div>
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
                  <div className="space-y-2">
                    {currentTracks.map((track: ITrack, i: number) => (
                      <ManageTrackRow
                        key={track._id}
                        track={track}
                        index={i}
                        isRemoving={
                          mutatingIds.has(track._id) && isTrackMutating
                        }
                        isAnyMutating={isTrackMutating}
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

        {/* ── FOOTER ─────────────────────────────────────────────────── */}
        {/* pb-safe handles iPhone home indicator */}
        <div className="shrink-0 px-5 sm:px-6 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] border-t border-border/40 bg-background/95 backdrop-blur-md flex items-center justify-between gap-3 z-20">
          <p className="hidden sm:block text-[11px] text-muted-foreground font-medium truncate">
            {activeTab === "reorder"
              ? isDirty
                ? "Có thay đổi chưa lưu. Nhấn Lưu thứ tự để áp dụng."
                : "Kéo thả để sắp xếp, sau đó nhấn Lưu thứ tự."
              : "Thay đổi được đồng bộ tự động."}
          </p>
          <div className="flex gap-2 ml-auto">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isTrackMutating}
              className="h-10 px-4 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Đóng
            </Button>

            {activeTab === "reorder" && isDirty && (
              <Button
                type="button"
                onClick={handleSaveOrder}
                disabled={isTrackMutating}
                className="h-10 px-5 rounded-xl text-sm font-bold shadow-sm animate-in zoom-in-95 duration-200"
              >
                {isTrackMutating ? (
                  <Loader2 className="size-3.5 animate-spin mr-2" />
                ) : (
                  <Save className="size-3.5 mr-2" />
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
