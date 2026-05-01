import React, { useState, useMemo, useEffect } from "react";
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
} from "lucide-react";

// UI Components
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import MusicResult from "@/components/ui/Result";
import { cn } from "@/lib/utils";

// DND Kit (Drag and Drop)
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

// Hooks & Sub-components
import {
  usePlaylistDetail,
  usePlaylistTracksInfinite,
} from "@/features/playlist/hooks/usePlaylistsQuery";
import { usePlaylistMutations } from "@/features/playlist/hooks/usePlaylistMutations";
import { SortablePlaylistTrackRow } from "@/features/playlist/components/SortablePlaylistTrackRow";
import { ModalTrackFilter } from "@/features/track/components/ModalTrackFilter";
import { ITrack, TrackFilterParams } from "@/features/track/types";
import { usePublicTracks } from "@/features/track/hooks/useTracksQuery";
import { toCDN } from "@/utils/track-helper";

/* ---------------- Skeleton Loader Tinh Tế ---------------- */
const TrackListSkeleton = () => (
  <div className="space-y-3">
    {[...Array(6)].map((_, i) => (
      <div
        key={i}
        style={{ animationDelay: `${i * 100}ms` }}
        className="flex items-center gap-4 p-3 rounded-xl bg-card border border-border/40 animate-pulse shadow-sm"
      >
        <div className="size-12 rounded-lg bg-muted/60 shrink-0" />
        <div className="flex-1 space-y-2.5">
          <div className="h-3.5 w-2/3 bg-muted/60 rounded-full" />
          <div className="h-2.5 w-1/3 bg-muted/40 rounded-full" />
        </div>
        <div className="size-8 rounded-full bg-muted/40 shrink-0" />
      </div>
    ))}
  </div>
);

/* -------------------------------------------------------------------------- */
/* MAIN MODAL                                                                 */
/* -------------------------------------------------------------------------- */

interface EditPlaylistTracksModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlistId: string | undefined;
}

export const EditPlaylistTracksModal: React.FC<
  EditPlaylistTracksModalProps
> = ({ isOpen, onClose, playlistId }) => {
  const [activeTab, setActiveTab] = useState<"add" | "reorder" | "manage">(
    "add",
  );
  // 1. LOCAL STATE CHO BỘ LỌC TÌM KIẾM
  const [trackParams, setTrackParams] = useState<TrackFilterParams>({
    sort: "newest",
  });

  // 2. FETCH TRACKS DỰA TRÊN LOCAL STATE
  const { data: searchRes, isLoading: isSearching } = usePublicTracks({
    ...trackParams,
    limit: 15,
    isPublic: true,
  });
  const searchResults = searchRes?.tracks || [];

  // --- 3. PLAYLIST DATA & MUTATIONS ---
  const { data: playlist, isLoading: isLoadingPlaylist } = usePlaylistDetail(
    playlistId || "",
  );

  const trackFetchLimit = 50;
  const { data: tracksData, isLoading: isLoadingTracks } =
    usePlaylistTracksInfinite(playlistId, trackFetchLimit);
  const { addTracks, removeTrack, reorderTracks, isTrackMutating } =
    usePlaylistMutations();

  // --- Local State DND ---
  const [orderedTracks, setOrderedTracks] = useState<ITrack[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [mutatingTrackId, setMutatingTrackId] = useState<string | null>(null);

  const currentTracks = useMemo(
    () => tracksData?.allTracks ?? [],
    [tracksData?.allTracks],
  );

  useEffect(() => {
    if (isDirty) return;

    const fetched = tracksData?.allTracks ?? [];
    if (fetched.length > 0) {
      const idOrder = playlist?.trackIds ?? fetched.map((t) => t._id);
      const map = new Map(fetched.map((t) => [t._id, t]));
      const ordered = idOrder
        .map((id) => map.get(id))
        .filter(Boolean) as ITrack[];
      setOrderedTracks(ordered);
      return;
    }

    if (playlist?.tracks && playlist.tracks.length) {
      setOrderedTracks(playlist.tracks as ITrack[]);
      return;
    }

    setOrderedTracks([]);
  }, [tracksData?.allTracks, playlist?.trackIds, playlist?.tracks, isDirty]);

  const existingTrackIds = useMemo(
    () => new Set(currentTracks.map((t: ITrack) => t._id)),
    [currentTracks],
  );

  // --- 4. DND LOGIC ---
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 100, tolerance: 5 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedTracks((items) => {
      const oldIndex = items.findIndex((t) => t._id === active.id);
      const newIndex = items.findIndex((t) => t._id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
    setIsDirty(true);
  };

  // --- 5. ACTION HANDLERS ---
  const handleSaveOrder = () => {
    if (!isDirty || !playlistId) return onClose();
    const trackIds = orderedTracks.map((t) => t._id);

    reorderTracks(playlistId, trackIds);
    setIsDirty(false);
    onClose();
  };

  const handleAddTrack = (trackId: string) => {
    if (!playlistId) return;
    setMutatingTrackId(trackId);
    addTracks(playlistId, [trackId]);
    setTimeout(() => setMutatingTrackId(null), 800);
  };

  const handleRemoveTrack = (trackId: string) => {
    if (!playlistId) return;
    setMutatingTrackId(trackId);
    removeTrack(playlistId, trackId);
    setTimeout(() => setMutatingTrackId(null), 800);
  };

  // Khóa cuộn trang khi mở modal
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6">
      {/* --- Backdrop --- */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" />

      {/* --- Modal Container --- */}
      <div className="relative z-[101] w-full max-w-3xl bg-background border border-border/50 shadow-2xl flex flex-col h-[100vh] sm:h-[85vh] rounded-t-3xl sm:rounded-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 overflow-hidden">
        {/* --- HEADER (Có hiệu ứng kính) --- */}
        <div className="shrink-0 px-6 sm:px-8 py-5 border-b border-border/50 flex justify-between items-center bg-background/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <div className="size-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 text-primary shadow-sm shrink-0">
              <ListMusic className="size-6" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-lg sm:text-xl text-foreground tracking-tight truncate">
                Quản lý Bài hát
              </h3>
              <p className="text-[13px] text-muted-foreground mt-0.5 font-medium truncate max-w-[200px] sm:max-w-[400px]">
                {playlist?.title || "Đang tải playlist..."}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full size-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* --- TABS & FILTERS --- */}
        <div className="shrink-0 px-6 sm:px-8 pt-5 pb-4 border-b border-border/40 bg-card z-10 space-y-4 shadow-sm">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="w-full"
          >
            <TabsList className="w-full h-11 bg-muted/50 p-1 grid grid-cols-3 gap-1 rounded-xl">
              {[
                { val: "add", icon: Plus, label: "Thêm Nhạc" },
                { val: "reorder", icon: MoveVertical, label: "Sắp xếp" },
                {
                  val: "manage",
                  icon: Settings2,
                  label: `Đã Lưu (${currentTracks.length})`,
                },
              ].map((item) => (
                <TabsTrigger
                  key={item.val}
                  value={item.val}
                  className="text-[11px] sm:text-xs font-bold uppercase tracking-widest gap-2 h-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg transition-all text-muted-foreground"
                >
                  <item.icon className="size-3.5" />
                  <span className="truncate hidden xs:inline-block">
                    {item.label}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Bộ lọc nội bộ */}
          {activeTab === "add" && (
            <div className="relative animate-in fade-in slide-in-from-top-2 duration-200">
              <ModalTrackFilter
                params={trackParams}
                onChange={setTrackParams}
              />
            </div>
          )}
        </div>

        {/* --- MAIN CONTENT (Khu vực cuộn có nền tách biệt) --- */}
        <div className="flex-1 overflow-hidden relative flex flex-col bg-muted/20">
          {/* ================= TAB 1: ADD TRACKS ================= */}
          {activeTab === "add" && (
            <ScrollArea className="flex-1 h-full">
              <div className="p-4 sm:p-6 space-y-3 pb-24">
                {isSearching ? (
                  <TrackListSkeleton />
                ) : searchResults.length === 0 ? (
                  <MusicResult
                    variant="empty"
                    title="Không tìm thấy bài hát"
                    description="Thử tìm kiếm với tên ca sĩ hoặc bài hát khác nhé."
                  />
                ) : (
                  searchResults.map((track: ITrack, index: number) => {
                    const isAdded = existingTrackIds.has(track._id);
                    const isMutatingThis =
                      mutatingTrackId === track._id && isTrackMutating;

                    return (
                      <div
                        key={track._id}
                        style={{ animationDelay: `${index * 30}ms` }}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-xl border transition-all duration-200 group animate-in fade-in slide-in-from-bottom-2",
                          isAdded
                            ? "bg-emerald-500/5 border-emerald-500/20"
                            : "bg-card border-border/40 hover:border-primary/30 hover:shadow-md",
                        )}
                      >
                        <div className="flex items-center gap-4 min-w-0 flex-1 mr-4">
                          <Avatar className="size-12 rounded-lg shrink-0 shadow-sm border border-border/50 group-hover:scale-105 transition-transform">
                            <AvatarImage
                              src={toCDN(track.coverImage) || track.coverImage}
                              className="object-cover"
                            />
                            <AvatarFallback className="bg-muted text-muted-foreground/50">
                              <Disc className="size-5" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <h4
                              className={cn(
                                "text-[14px] font-bold truncate transition-colors",
                                isAdded
                                  ? "text-emerald-600 dark:text-emerald-500"
                                  : "text-foreground group-hover:text-primary",
                              )}
                            >
                              {track.title}
                            </h4>
                            <p className="text-xs text-muted-foreground truncate font-medium mt-0.5">
                              {track.artist?.name}
                            </p>
                          </div>
                        </div>

                        <Button
                          size={isAdded ? "sm" : "icon"}
                          variant={isAdded ? "ghost" : "secondary"}
                          disabled={
                            isAdded || isMutatingThis || isTrackMutating
                          }
                          onClick={() => handleAddTrack(track._id)}
                          className={cn(
                            "shrink-0 transition-all rounded-full sm:w-auto h-9",
                            isAdded
                              ? "text-emerald-600 bg-transparent hover:bg-transparent cursor-default border-transparent px-3"
                              : "w-9 bg-background border border-border/50 hover:bg-primary hover:text-primary-foreground hover:border-primary shadow-sm hover:scale-105 active:scale-95",
                          )}
                        >
                          {isMutatingThis ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : isAdded ? (
                            <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide">
                              <CheckCircle2 className="size-4" />
                              <span className="hidden sm:inline">Đã thêm</span>
                            </span>
                          ) : (
                            <Plus className="size-4" />
                          )}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          )}

          {/* ================= TAB 2: REORDER ================= */}
          {activeTab === "reorder" && (
            <ScrollArea className="flex-1 h-full">
              <div className="p-4 sm:p-6 space-y-3 pb-24">
                {isLoadingPlaylist || isLoadingTracks ? (
                  <TrackListSkeleton />
                ) : orderedTracks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-4 animate-in fade-in">
                    <div className="p-6 bg-card rounded-full border border-dashed border-border shadow-sm">
                      <Music4 className="size-10 opacity-30" />
                    </div>
                    <p className="text-sm font-bold uppercase tracking-widest">
                      Playlist đang trống
                    </p>
                    <Button
                      variant="link"
                      onClick={() => setActiveTab("add")}
                      className="text-primary font-bold"
                    >
                      Thêm nhạc ngay
                    </Button>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={orderedTracks.map((t) => t._id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-3">
                        {orderedTracks.map((track, index) => (
                          <SortablePlaylistTrackRow
                            key={track._id}
                            track={track}
                            index={index}
                            isRemoving={false}
                            onRemove={() => {}}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </ScrollArea>
          )}

          {/* ================= TAB 3: MANAGE ================= */}
          {activeTab === "manage" && (
            <ScrollArea className="flex-1 h-full">
              <div className="p-4 sm:p-6 space-y-3 pb-24">
                {currentTracks.length === 0 ? (
                  <MusicResult
                    variant="empty"
                    title="Chưa có bài hát"
                    description="Chuyển sang tab Thêm Nhạc để tìm bài hát nhé."
                  />
                ) : (
                  currentTracks.map((track: ITrack, i: number) => {
                    const isMutatingThis =
                      mutatingTrackId === track._id && isTrackMutating;

                    return (
                      <div
                        key={track._id}
                        style={{ animationDelay: `${i * 30}ms` }}
                        className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-card hover:border-destructive/30 transition-all duration-200 group shadow-sm animate-in fade-in slide-in-from-bottom-2"
                      >
                        <div className="flex items-center gap-4 min-w-0 flex-1 mr-4">
                          <span className="w-6 text-center text-xs font-mono font-bold text-muted-foreground/50">
                            {i + 1}
                          </span>
                          <Avatar className="size-12 rounded-lg shrink-0 border border-border/50 shadow-sm group-hover:scale-105 transition-transform">
                            <AvatarImage
                              src={toCDN(track.coverImage) || track.coverImage}
                              className="object-cover"
                            />
                            <AvatarFallback className="bg-muted">
                              <Disc className="size-5 opacity-30" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <h4 className="text-[14px] font-bold truncate text-foreground transition-colors">
                              {track.title}
                            </h4>
                            <p className="text-xs text-muted-foreground truncate font-medium mt-0.5">
                              {track.artist?.name}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={isMutatingThis || isTrackMutating}
                          onClick={() => handleRemoveTrack(track._id)}
                          className="size-9 rounded-full text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all active:scale-90"
                        >
                          {isMutatingThis ? (
                            <Loader2 className="size-4 animate-spin text-destructive" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* --- FOOTER --- */}
        <div className="shrink-0 px-6 sm:px-8 py-4 border-t border-border/50 bg-background/95 backdrop-blur-md flex justify-between items-center z-20">
          <p className="hidden sm:block text-[11px] text-muted-foreground font-medium">
            {activeTab === "reorder"
              ? "Kéo thả để sắp xếp. Nhớ nhấn Lưu sau khi hoàn tất."
              : "Thay đổi sẽ được lưu và đồng bộ tự động."}
          </p>
          <div className="flex gap-3 w-full sm:w-auto justify-end">
            <Button
              onClick={onClose}
              variant="ghost"
              disabled={isTrackMutating}
              className="font-semibold text-muted-foreground hover:text-foreground h-10 px-5 rounded-lg transition-colors"
            >
              Đóng
            </Button>

            {/* Nút Save (Chỉ hiện khi đổi thứ tự) */}
            {activeTab === "reorder" && isDirty && (
              <Button
                onClick={handleSaveOrder}
                disabled={isTrackMutating}
                className="h-10 px-6 font-bold text-[13px] shadow-md hover:shadow-lg transition-all animate-in zoom-in duration-300 rounded-lg"
              >
                {isTrackMutating ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Save className="mr-2 size-4" />
                )}
                Lưu Thứ Tự
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
