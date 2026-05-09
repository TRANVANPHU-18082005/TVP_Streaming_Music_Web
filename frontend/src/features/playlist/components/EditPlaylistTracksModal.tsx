"use client";

import React, { useState, useMemo, useEffect, useCallback, memo } from "react";
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
import { toCDN } from "@/utils/track-helper";
import { TrackFilterParams } from "@/features/track";
import { APP_CONFIG } from "@/config/constants";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = "add" | "reorder" | "manage";

interface EditPlaylistTracksModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlistId: string | undefined;
}

// ─── Toast / Undo Notification ────────────────────────────────────────────────

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
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 animate-in slide-in-from-bottom-3 fade-in duration-200">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-foreground text-background shadow-2xl text-sm font-medium whitespace-nowrap">
        <span>{message}</span>
        <button
          type="button"
          onClick={onUndo}
          className="flex items-center gap-1.5 text-primary font-bold hover:opacity-80 transition-opacity"
        >
          <Undo2 className="size-3.5" />
          Hoàn tác
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-background/50 hover:text-background transition-colors ml-1"
          aria-label="Đóng thông báo"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
});
UndoToast.displayName = "UndoToast";

// ─── Confirm Dialog (thay confirm() native) ───────────────────────────────────

interface ConfirmDialogProps {
  message: string;
  description?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  isDestructive?: boolean;
}

const ConfirmDialog = memo(
  ({
    message,
    description,
    onConfirm,
    onCancel,
    confirmLabel = "Xác nhận",
    isDestructive = true,
  }: ConfirmDialogProps) => (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm rounded-2xl animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-card border border-border/60 rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex gap-3">
          <div className="size-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="size-5 text-destructive" />
          </div>
          <div>
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
            className="h-9 px-4 rounded-xl"
          >
            Huỷ
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isDestructive ? "destructive" : "default"}
            onClick={onConfirm}
            className="h-9 px-4 rounded-xl font-bold"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  ),
);
ConfirmDialog.displayName = "ConfirmDialog";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const TrackListSkeleton = ({ count = 5 }: { count?: number }) => (
  <div className="space-y-2.5">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        style={{ animationDelay: `${i * 60}ms` }}
        className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/30 animate-pulse"
      >
        <div className="size-8 rounded-xl bg-muted/60 flex-shrink-0" />
        <div className="size-10 rounded-xl bg-muted/50 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/3 bg-muted/50 rounded-full" />
          <div className="h-2.5 w-1/3 bg-muted/30 rounded-full" />
        </div>
      </div>
    ))}
  </div>
);

// ─── DragOverlay card (preview khi đang kéo) ─────────────────────────────────

const DragPreviewCard = ({ track }: { track: ITrack }) => (
  <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl border border-primary/50 bg-background shadow-2xl ring-1 ring-primary/20 cursor-grabbing opacity-95">
    <div className="size-8 flex items-center justify-center text-primary">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="size-4"
      >
        <circle cx="9" cy="5" r="1" fill="currentColor" />
        <circle cx="9" cy="12" r="1" fill="currentColor" />
        <circle cx="9" cy="19" r="1" fill="currentColor" />
        <circle cx="15" cy="5" r="1" fill="currentColor" />
        <circle cx="15" cy="12" r="1" fill="currentColor" />
        <circle cx="15" cy="19" r="1" fill="currentColor" />
      </svg>
    </div>
    <Avatar className="size-10 rounded-xl border border-border/50">
      <AvatarImage
        src={toCDN(track.coverImage) || track.coverImage}
        className="object-cover"
      />
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

// ─── Track row cho Tab Add ────────────────────────────────────────────────────

interface AddTrackRowProps {
  track: ITrack;
  index: number;
  isAdded: boolean;
  isMutating: boolean;
  isAnyMutating: boolean;
  onAdd: (id: string) => void;
}

const AddTrackRow = memo(
  ({
    track,
    index,
    isAdded,
    isMutating,
    isAnyMutating,
    onAdd,
  }: AddTrackRowProps) => (
    <div
      style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 group",
        "animate-in fade-in slide-in-from-bottom-1",
        isAdded
          ? "bg-emerald-500/5 border-emerald-500/15"
          : "bg-card border-border/40 hover:border-primary/25 hover:shadow-sm",
      )}
    >
      {/* Cover */}
      <Avatar className="size-10 rounded-xl flex-shrink-0 border border-border/50 shadow-sm group-hover:shadow-md transition-shadow">
        <AvatarImage
          src={toCDN(track.coverImage) || track.coverImage}
          alt={track.title}
          className="object-cover"
        />
        <AvatarFallback className="bg-muted rounded-xl">
          <Disc className="size-4 opacity-30" />
        </AvatarFallback>
      </Avatar>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[13px] font-semibold truncate transition-colors leading-snug",
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

      {/* Action */}
      <button
        type="button"
        disabled={isAdded || isMutating || isAnyMutating}
        onClick={() => !isAdded && onAdd(track._id)}
        aria-label={
          isAdded ? `${track.title} đã được thêm` : `Thêm ${track.title}`
        }
        className={cn(
          "flex items-center justify-center flex-shrink-0 rounded-full transition-all duration-150 outline-none",
          "focus-visible:ring-2 focus-visible:ring-primary/50",
          isAdded
            ? "gap-1.5 h-8 px-3 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 cursor-default"
            : [
                "size-8 border border-border/50 bg-background shadow-sm",
                "hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-md hover:scale-105",
                "active:scale-95",
                (isMutating || isAnyMutating) &&
                  "opacity-40 cursor-not-allowed",
              ],
        )}
      >
        {isMutating ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : isAdded ? (
          <>
            <CheckCircle2 className="size-3.5" />
            <span className="hidden sm:inline">Đã thêm</span>
          </>
        ) : (
          <Plus className="size-3.5" />
        )}
      </button>
    </div>
  ),
);
AddTrackRow.displayName = "AddTrackRow";

// ─── Main Modal ───────────────────────────────────────────────────────────────

export const EditPlaylistTracksModal: React.FC<
  EditPlaylistTracksModalProps
> = ({ isOpen, onClose, playlistId }) => {
  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<TabKey>("add");

  // ── Search / filter ──
  const [trackParams, setTrackParams] = useState<TrackFilterParams>({
    sort: "newest",
    page: 1,
    limit: APP_CONFIG.SELECTOR_LIMIT,
  });

  // ── Confirm dialog ──
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    description?: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  // ── Undo toast ──
  const [undoToast, setUndoToast] = useState<{
    message: string;
    onUndo: () => void;
  } | null>(null);

  // ── Mutating IDs set (support concurrent ops) ──
  const [mutatingIds, setMutatingIds] = useState<Set<string>>(new Set());

  // ── DND ──
  const [orderedTracks, setOrderedTracks] = useState<ITrack[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Track snapshot for undo (reorder)

  // ── Data ──
  const { data: searchRes, isLoading: isSearching } = usePublicTracks({
    ...trackParams,
    limit: 15,
    isPublic: true,
  });
  const searchResults: ITrack[] = searchRes?.tracks ?? [];

  const { data: playlist, isLoading: isLoadingPlaylist } = usePlaylistDetail(
    playlistId ?? "",
  );

  const { data: tracksData, isLoading: isLoadingTracks } =
    usePlaylistTracksInfinite(playlistId, APP_CONFIG.VIRTUALIZER_LIMIT);

  const { addTracks, removeTracks, reorderTracks, isTrackMutating } =
    usePlaylistMutations();

  // ── Derived ──
  const currentTracks = useMemo(
    () => tracksData?.allTracks ?? [],
    [tracksData?.allTracks],
  );

  const existingTrackIds = useMemo(
    () => new Set(currentTracks.map((t: ITrack) => t._id)),
    [currentTracks],
  );

  const visibleAddableTracks = useMemo(
    () => searchResults.filter((t) => !existingTrackIds.has(t._id)),
    [searchResults, existingTrackIds],
  );

  // ── Sync orderedTracks từ server (chỉ khi chưa dirty) ──
  useEffect(() => {
    if (isDirty) return;
    const fetched = tracksData?.allTracks ?? [];
    if (fetched.length === 0 && !playlist?.tracks?.length) {
      setOrderedTracks([]);
      return;
    }
    const source = fetched;
    if (source.length === 0 && playlist?.tracks?.length) return; // Chờ tải dữ liệu bài hát đầy đủ
    const idOrder = playlist?.trackIds ?? source.map((t) => t._id);
    const map = new Map(source.map((t) => [t._id, t]));
    const ordered = idOrder
      .map((id) => map.get(id))
      .filter(Boolean) as ITrack[];
    setOrderedTracks(ordered.length > 0 ? ordered : source);
  }, [tracksData?.allTracks, playlist?.trackIds, playlist?.tracks, isDirty]);

  // ── Lock body scroll ──
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // ── Reset khi đóng ──
  const handleClose = useCallback(() => {
    setConfirmDialog(null);
    setUndoToast(null);
    onClose();
  }, [onClose]);

  // ── Helpers mutating set ──
  const startMutating = useCallback((...ids: string[]) => {
    setMutatingIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  // ── DND sensors ──
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
      const oldIdx = items.findIndex((t) => t._id === active.id);
      const newIdx = items.findIndex((t) => t._id === over.id);
      return arrayMove(items, oldIdx, newIdx);
    });
    setIsDirty(true);
  }, []);

  // ── Actions ──

  const handleAddTrack = useCallback(
    (trackId: string) => {
      if (!playlistId) return;
      startMutating(trackId);
      addTracks(playlistId, [trackId]);
    },
    [playlistId, addTracks, startMutating],
  );

  const handleAddAllVisible = useCallback(() => {
    if (!playlistId || visibleAddableTracks.length === 0) return;
    setConfirmDialog({
      message: `Thêm ${visibleAddableTracks.length} bài hát?`,
      description: "Tất cả kết quả đang hiển thị sẽ được thêm vào playlist.",
      confirmLabel: "Thêm tất cả",
      onConfirm: () => {
        setConfirmDialog(null);
        const ids = visibleAddableTracks.map((t) => t._id);
        startMutating("bulk-add");
        addTracks(playlistId, ids);
      },
    });
  }, [playlistId, visibleAddableTracks, addTracks, startMutating]);

  const handleRemoveTrack = useCallback(
    (trackId: string) => {
      if (!playlistId) return;
      const track = currentTracks.find((t: ITrack) => t._id === trackId);
      startMutating(trackId);
      removeTracks(playlistId, [trackId]);
      // Undo
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
    [playlistId, currentTracks, removeTracks, startMutating, handleAddTrack],
  );

  const handleRemoveAll = useCallback(() => {
    if (!playlistId || currentTracks.length === 0) return;
    setConfirmDialog({
      message: `Xóa tất cả ${currentTracks.length} bài hát?`,
      description: "Hành động này không thể hoàn tác.",
      confirmLabel: "Xóa tất cả",
      onConfirm: () => {
        setConfirmDialog(null);
        const ids = currentTracks.map((t: ITrack) => t._id);
        startMutating("bulk-remove");
        removeTracks(playlistId, ids);
      },
    });
  }, [playlistId, currentTracks, removeTracks, startMutating]);

  const handleSaveOrder = useCallback(() => {
    if (!playlistId) return;
    if (!isDirty) {
      handleClose();
      return;
    }
    const trackIds = orderedTracks.map((t) => t._id);
    reorderTracks(playlistId, trackIds);
    setIsDirty(false);
    handleClose();
  }, [playlistId, isDirty, orderedTracks, reorderTracks, handleClose]);

  const handleDiscardReorder = useCallback(() => {
    setOrderedTracks(currentTracks);
    setIsDirty(false);
  }, [currentTracks]);

  // Tab loading states
  const isLoadingContent = isLoadingPlaylist || isLoadingTracks;
  const isBulkMutating =
    mutatingIds.has("bulk-add") || mutatingIds.has("bulk-remove");

  if (!isOpen) return null;

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
      />

      {/* Modal */}
      <div className="relative z-[101] w-full max-w-2xl flex flex-col h-[100dvh] sm:h-[88vh] sm:max-h-[740px] rounded-t-[28px] sm:rounded-3xl overflow-hidden bg-background border border-border/40 shadow-2xl animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300">
        {/* ── HEADER ── */}
        <div className="flex-shrink-0 px-5 sm:px-6 py-4 border-b border-border/40 flex items-center gap-3 bg-background/95 backdrop-blur-md z-10">
          <div className="size-10 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/15 flex-shrink-0">
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
            className="rounded-full size-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
          >
            <X className="size-4.5" />
          </Button>
        </div>

        {/* ── TABS ── */}
        <div className="flex-shrink-0 px-5 sm:px-6 pt-4 pb-3 border-b border-border/30 bg-card/50 z-10 space-y-4">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabKey)}
          >
            <TabsList className="w-full h-10 bg-muted/40 p-1 grid grid-cols-3 rounded-2xl">
              {(
                [
                  { val: "add", icon: Plus, label: "Thêm nhạc" },
                  {
                    val: "reorder",
                    icon: MoveVertical,
                    label: "Sắp xếp",
                    badge: isDirty ? "●" : undefined,
                  },
                  {
                    val: "manage",
                    icon: Settings2,
                    label: "Đã lưu",
                    badge:
                      currentTracks.length > 0
                        ? String(currentTracks.length)
                        : undefined,
                  },
                ] as const
              ).map((item) => (
                <TabsTrigger
                  key={item.val}
                  value={item.val}
                  className={cn(
                    "flex items-center justify-center gap-1.5 h-full rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all",
                    "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                    "text-muted-foreground",
                  )}
                >
                  <item.icon className="size-3.5 flex-shrink-0" />
                  <span className="hidden xs:inline truncate">
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

          {/* Filter bar — only for Add tab */}
          {activeTab === "add" && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <ModalTrackFilter
                params={trackParams}
                onChange={setTrackParams}
              />
            </div>
          )}
        </div>

        {/* ── CONTENT ── */}
        <div className="flex-1 overflow-hidden relative flex flex-col min-h-0">
          {/* ===== TAB 1: ADD ===== */}
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
                      visibleAddableTracks.length === 0 ||
                      isBulkMutating ||
                      isTrackMutating
                    }
                    onClick={handleAddAllVisible}
                    className="h-9 px-4 rounded-xl text-xs font-bold flex-shrink-0"
                  >
                    {mutatingIds.has("bulk-add") ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : visibleAddableTracks.length > 0 ? (
                      `Thêm ${visibleAddableTracks.length} bài`
                    ) : (
                      "Không còn bài mới"
                    )}
                  </Button>
                </div>

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
                  <div className="space-y-2 scroll-auto overflow-y-auto max-h-[400px]">
                    {searchResults.map((track: ITrack, idx) => (
                      <AddTrackRow
                        key={track._id}
                        track={track}
                        index={idx}
                        isAdded={existingTrackIds.has(track._id)}
                        isMutating={
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

          {/* ===== TAB 2: REORDER ===== */}
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
                        className="text-primary font-bold h-8"
                      >
                        Thêm nhạc ngay →
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* Reorder hint */}
                      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border border-border/30 bg-card/40 text-[12px] text-muted-foreground">
                        <MoveVertical className="size-3.5 flex-shrink-0 opacity-60" />
                        Kéo thả để sắp xếp. Nhớ nhấn{" "}
                        <strong className="text-foreground">Lưu thứ tự</strong>{" "}
                        sau khi hoàn tất.
                        {isDirty && (
                          <button
                            type="button"
                            onClick={handleDiscardReorder}
                            className="ml-auto text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors flex-shrink-0"
                          >
                            Hoàn tác
                          </button>
                        )}
                      </div>

                      <SortableContext
                        items={orderedTracks.map((t) => t._id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2 scroll-auto overflow-y-auto max-h-[400px]">
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

              {/* DragOverlay — renders outside the scroll area */}
              <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
                {activeDragTrack && <DragPreviewCard track={activeDragTrack} />}
              </DragOverlay>
            </DndContext>
          )}

          {/* ===== TAB 3: MANAGE ===== */}
          {activeTab === "manage" && (
            <ScrollArea className="flex-1">
              <div className="p-4 sm:p-5 space-y-2.5 pb-6">
                {/* Remove all bar */}
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
                      className="h-9 px-4 rounded-xl text-xs font-bold text-destructive hover:bg-destructive/10 flex-shrink-0"
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
                  <div className="space-y-2 scroll-auto overflow-y-auto max-h-[400px]">
                    {currentTracks.map((track: ITrack, i: number) => {
                      const isRemovingThis =
                        mutatingIds.has(track._id) && isTrackMutating;
                      return (
                        <div
                          key={track._id}
                          style={{
                            animationDelay: `${Math.min(i * 25, 300)}ms`,
                          }}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 group",
                            "animate-in fade-in slide-in-from-bottom-1",
                            "bg-card border-border/40 hover:border-destructive/20",
                          )}
                        >
                          {/* Index */}
                          <span className="w-6 text-center text-[10px] font-mono font-bold text-muted-foreground/40 flex-shrink-0">
                            {(i + 1).toString().padStart(2, "0")}
                          </span>

                          {/* Cover */}
                          <Avatar className="size-10 rounded-xl flex-shrink-0 border border-border/50 shadow-sm">
                            <AvatarImage
                              src={toCDN(track.coverImage) || track.coverImage}
                              alt={track.title}
                              className="object-cover"
                            />
                            <AvatarFallback className="bg-muted rounded-xl">
                              <Disc className="size-4 opacity-30" />
                            </AvatarFallback>
                          </Avatar>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold truncate text-foreground leading-snug">
                              {track.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {track.artist?.name}
                            </p>
                          </div>

                          {/* Remove */}
                          <button
                            type="button"
                            disabled={isRemovingThis || isTrackMutating}
                            onClick={() => handleRemoveTrack(track._id)}
                            aria-label={`Xóa "${track.title}"`}
                            className={cn(
                              "flex items-center justify-center size-8 rounded-full flex-shrink-0",
                              "transition-all duration-150 outline-none",
                              "focus-visible:ring-2 focus-visible:ring-destructive/50",
                              isRemovingThis
                                ? "cursor-wait text-muted-foreground/30"
                                : "text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 active:scale-90 md:opacity-0 group-hover:opacity-100",
                            )}
                          >
                            {isRemovingThis ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {/* ── Confirm dialog overlay ── */}
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

        {/* ── FOOTER ── */}
        <div className="flex-shrink-0 px-5 sm:px-6 py-3.5 border-t border-border/40 bg-background/95 backdrop-blur-md flex items-center justify-between gap-3 z-20">
          <p className="hidden sm:block text-[11px] text-muted-foreground font-medium truncate">
            {activeTab === "reorder"
              ? isDirty
                ? "Có thay đổi chưa lưu. Nhấn Lưu thứ tự để áp dụng."
                : "Kéo thả để sắp xếp, sau đó nhấn Lưu thứ tự."
              : "Thay đổi sẽ được đồng bộ tự động."}
          </p>
          <div className="flex gap-2 ml-auto">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isTrackMutating}
              className="h-9 px-4 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Đóng
            </Button>

            {activeTab === "reorder" && isDirty && (
              <Button
                type="button"
                onClick={handleSaveOrder}
                disabled={isTrackMutating}
                className="h-9 px-5 rounded-xl text-sm font-bold shadow-sm animate-in zoom-in-95 duration-200"
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
