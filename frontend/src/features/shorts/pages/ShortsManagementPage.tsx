import { useState, useMemo } from "react";
import {
  Plus, Search, TvMinimalPlay, Edit, Trash2, BarChart2,
  LayoutGrid, List, SlidersHorizontal, X, CheckSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useShorts, useCreateShort, useUpdateShort, useDeleteShort, useTogglePublish } from "../hooks/useShorts";
import { ShortEditor } from "../components/ShortEditor";
import { ShortCard } from "../components/ShortCard";
import { ShortDeleteDialog } from "../components/ShortDeleteDialog";
import { ShortStatsBar } from "../components/ShortStatsBar";
import { ITrackShort } from "../types";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { toast } from "sonner";
import TableSkeleton from "@/components/ui/TableSkeleton";
import { motion, AnimatePresence } from "framer-motion";

type ViewMode = "grid" | "table";
type SortKey = "createdAt" | "viewCount" | "likeCount" | "priority";
type FilterStatus = "all" | "published" | "draft";

export const ShortsManagementPage = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingShort, setEditingShort] = useState<ITrackShort | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title?: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useShorts({ limit: 100, search });
  const createShort = useCreateShort();
  const updateShort = useUpdateShort();
  const deleteShort = useDeleteShort();
  const togglePublish = useTogglePublish();

  const rawList: ITrackShort[] = data?.data?.data || [];

  // ── Filter + Sort ─────────────────────────────────────────────────────────
  const shortsList = useMemo(() => {
    let list = [...rawList];

    // Filter by status
    if (filterStatus === "published") list = list.filter((s) => s.isPublished);
    if (filterStatus === "draft") list = list.filter((s) => !s.isPublished);

    // Sort
    list.sort((a, b) => {
      if (sortBy === "viewCount") return (b.viewCount || 0) - (a.viewCount || 0);
      if (sortBy === "likeCount") return (b.likeCount || 0) - (a.likeCount || 0);
      if (sortBy === "priority") return (b.priority || 0) - (a.priority || 0);
      // createdAt default
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return list;
  }, [rawList, filterStatus, sortBy]);
  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddNew = () => {
    setEditingShort(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (short: ITrackShort) => {
    setEditingShort(short);
    setIsEditorOpen(true);
  };

  const handleDeleteConfirm = (id: string, title?: string) => {
    setDeleteTarget({ id, title });
  };

  const handleDeleteExecute = () => {
    if (!deleteTarget) return;
    deleteShort.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success("Đã xóa Short thành công");
        setDeleteTarget(null);
        setSelectedIds((prev) => { const n = new Set(prev); n.delete(deleteTarget!.id); return n; });
      },
      onError: () => toast.error("Xóa Short thất bại"),
    });
  };

  const handleTogglePublish = (id: string, isPublished: boolean) => {
    togglePublish.mutate({ id, isPublished }, {
      onSuccess: () => toast.success(isPublished ? "Đã xuất bản Short" : "Đã ẩn Short"),
    });
  };

  const handleSubmit = (formData: any) => {
    if (editingShort) {
      updateShort.mutate({ id: editingShort._id, data: formData }, {
        onSuccess: () => {
          toast.success("Cập nhật Short thành công");
          setIsEditorOpen(false);
        },
        onError: () => toast.error("Cập nhật thất bại"),
      });
    } else {
      createShort.mutate(formData, {
        onSuccess: () => {
          toast.success("Tạo Short mới thành công 🎉");
          setIsEditorOpen(false);
        },
        onError: () => toast.error("Tạo Short thất bại"),
      });
    }
  };

  // ── Bulk select helpers ───────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkPublish = (publish: boolean) => {
    selectedIds.forEach((id) => {
      togglePublish.mutate({ id, isPublished: publish });
    });
    toast.success(`Đã ${publish ? "xuất bản" : "ẩn"} ${selectedIds.size} Short`);
    clearSelection();
  };

  const hasSelection = selectedIds.size > 0;

  return (
    <div className="h-full flex flex-col gap-5">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <TvMinimalPlay className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            Music Shorts
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Quản lý các đoạn cắt ngắn (highlight) để hiển thị trên Shorts Feed.
          </p>
        </div>

        <Button onClick={handleAddNew} className="flex gap-2 shadow-md w-full md:w-auto">
          <Plus className="w-4 h-4" />
          Tạo Short mới
        </Button>
      </div>

      {/* ── STATS BAR ─────────────────────────────────────────────────────── */}
      <ShortStatsBar shorts={rawList} isLoading={isLoading} />

      {/* ── FILTERS & VIEW TOGGLE ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm tiêu đề, bài hát..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted-foreground/20 flex items-center justify-center hover:bg-muted-foreground/30 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
          <SelectTrigger className="w-36 bg-background/50 border-border/50 hover:bg-accent/50 transition-colors">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="published">Đang hiển thị</SelectItem>
            <SelectItem value="draft">Đang ẩn</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-40 bg-background/50 border-border/50 hover:bg-accent/50 transition-colors">
            <SlidersHorizontal className="w-3 h-3 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Mới nhất</SelectItem>
            <SelectItem value="viewCount">Nhiều lượt xem</SelectItem>
            <SelectItem value="likeCount">Nhiều like</SelectItem>
            <SelectItem value="priority">Độ ưu tiên cao</SelectItem>
          </SelectContent>
        </Select>

        {/* Spacer */}
        <div className="flex-1" />

        {/* View mode toggle */}
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg border border-border/50">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-md transition-all duration-200 ${viewMode === "grid" ? "bg-background shadow-sm text-primary ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              }`}
            title="Dạng lưới"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-1.5 rounded-md transition-all duration-200 ${viewMode === "table" ? "bg-background shadow-sm text-primary ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              }`}
            title="Dạng bảng"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── BULK ACTION BAR ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {hasSelection && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl overflow-hidden shadow-sm"
          >
            <CheckSquare className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-sm font-medium text-primary">
              Đã chọn {selectedIds.size} Short
            </span>
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={() => handleBulkPublish(true)} className="h-7 text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
              Xuất bản tất cả
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkPublish(false)} className="h-7 text-xs">
              Ẩn tất cả
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection} className="h-7 w-7 p-0 text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CONTENT AREA ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="rounded-2xl bg-muted/30 border border-border/30 animate-pulse" style={{ aspectRatio: "9/16" }} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden bg-card/50 shadow-sm">
              <TableSkeleton rows={8} cols={6} />
            </div>
          )
        ) : shortsList.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="h-full min-h-[300px] flex flex-col items-center justify-center gap-4 text-muted-foreground"
          >
            <div className="w-16 h-16 rounded-2xl bg-muted/50 border border-border/50 flex items-center justify-center shadow-inner">
              <TvMinimalPlay className="w-8 h-8 opacity-30" />
            </div>
            <div className="text-center">
              <p className="font-medium">
                {search || filterStatus !== "all" ? "Không tìm thấy Short nào" : "Chưa có Short nào"}
              </p>
              <p className="text-sm mt-1 opacity-60">
                {search ? `Không có kết quả cho "${search}"` : "Hãy tạo Short đầu tiên!"}
              </p>
            </div>
            {!search && filterStatus === "all" && (
              <Button onClick={handleAddNew} className="gap-2 mt-2">
                <Plus className="w-4 h-4" /> Tạo Short đầu tiên
              </Button>
            )}
          </motion.div>
        ) : viewMode === "grid" ? (
          /* ── Grid View ─────────────────────────────────────────────────── */
          <div className="overflow-y-auto h-full pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-4">
              {shortsList.map((short, i) => (
                <ShortCard
                  key={short._id}
                  short={short}
                  index={i}
                  onEdit={handleEdit}
                  onDelete={(id) => handleDeleteConfirm(id, short.title || short.track?.title)}
                  onTogglePublish={handleTogglePublish}
                  isSelected={selectedIds.has(short._id)}
                  onSelect={toggleSelect}
                />
              ))}
            </div>
          </div>
        ) : (
          /* ── Table View ─────────────────────────────────────────────────── */
          <div className="flex-1 overflow-hidden bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 flex flex-col shadow-sm">
            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-md">
                  <TableRow className="hover:bg-transparent border-b-border/50">
                    <TableHead className="w-[80px]">Thumb</TableHead>
                    <TableHead>Track</TableHead>
                    <TableHead className="hidden md:table-cell">Caption</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Tương tác</TableHead>
                    <TableHead className="text-center">Hiển thị</TableHead>
                    <TableHead className="text-right pr-6">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shortsList.map((short) => (
                    <TableRow key={short._id} className="group hover:bg-muted/50 transition-colors border-b-border/50">
                      <TableCell>
                        <div className="relative w-12 h-[72px] rounded-lg overflow-hidden bg-muted border border-border/50 shadow-sm">
                          <ImageWithFallback
                            src={short.moodVideo?.thumbnailUrl || short.track?.coverImage}
                            className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                          />
                          <div className="absolute bottom-0.5 right-0.5 bg-black/70 backdrop-blur-sm px-1 rounded text-[9px] font-bold text-white font-mono">
                            {short.duration?.toFixed(0)}s
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col max-w-[180px]">
                          <span className="font-semibold truncate text-sm text-foreground">{short.track?.title}</span>
                          <span className="text-xs text-muted-foreground truncate">{short.track?.artist?.name}</span>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono border-border/50">
                              {short.startTime?.toFixed(0)}s–{short.endTime?.toFixed(0)}s
                            </Badge>
                            {short.suggestedByAi && (
                              <Badge className="text-[9px] px-1 py-0 bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/30">AI</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="hidden md:table-cell max-w-[200px]">
                        <div className="flex flex-col gap-0.5">
                          {short.title && <span className="text-xs font-medium truncate italic">"{short.title}"</span>}
                          <span className="text-xs text-muted-foreground line-clamp-2">{short.caption || "Không có caption"}</span>
                          <Badge variant="secondary" className="text-[9px] font-normal w-fit mt-1">P: {short.priority}</Badge>
                        </div>
                      </TableCell>

                      <TableCell className="text-center hidden sm:table-cell">
                        <div className="flex flex-col items-center gap-0.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <BarChart2 className="w-3 h-3" />
                            <span>{short.viewCount || 0}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-pink-500/80">❤ {short.likeCount || 0}</span>
                            <span className="text-blue-500/80">↗ {short.shareCount || 0}</span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <Switch
                          checked={short.isPublished}
                          onCheckedChange={(c) => handleTogglePublish(short._id, c)}
                        />
                      </TableCell>

                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/20 hover:text-primary" onClick={() => handleEdit(short)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/20 hover:text-destructive" onClick={() => handleDeleteConfirm(short._id, short.title || short.track?.title)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {shortsList.length > 0 && (
              <div className="border-t border-border/50 p-3 text-xs text-muted-foreground text-center bg-muted/20">
                Hiển thị {shortsList.length} / {rawList.length} shorts
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── EDITOR SHEET ──────────────────────────────────────────────────── */}
      <Sheet open={isEditorOpen} onOpenChange={(v) => !v && setIsEditorOpen(false)}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl p-0 overflow-hidden flex flex-col gap-0 border-l-border/50 shadow-2xl"
        >
          <SheetHeader className="px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur-md flex-shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <TvMinimalPlay className="w-5 h-5 text-primary" />
              {editingShort ? "Chỉnh sửa Short" : "Tạo Short mới"}
            </SheetTitle>
            <SheetDescription>
              {editingShort
                ? `Đang chỉnh sửa: ${editingShort.track?.title || "Short"}`
                : "Tạo một đoạn highlight ngắn để xuất bản lên feed Shorts."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <ShortEditor
              initialData={editingShort || {}}
              onSubmit={handleSubmit}
              onCancel={() => setIsEditorOpen(false)}
              isLoading={createShort.isPending || updateShort.isPending}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── DELETE CONFIRMATION DIALOG ────────────────────────────────────── */}
      <ShortDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteExecute}
        shortTitle={deleteTarget?.title}
        isLoading={deleteShort.isPending}
      />
    </div>
  );
};
