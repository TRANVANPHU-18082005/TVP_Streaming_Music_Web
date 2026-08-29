import { useState, useMemo } from "react";
import {
  Plus, Search, Layers, Edit2, Trash2, Eye, LayoutGrid, List,
  Sparkles, Clock, Play, Heart, BarChart2, CheckSquare, X,
  TrendingUp, Filter, ChevronDown, ExternalLink, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { useMashupsAdmin, useDeleteMashup, useToggleMashupPublish } from "../hooks/useMashups";
import { IMashup, TRANSITION_META, formatMashupDuration } from "../types";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import TableSkeleton from "@/components/ui/TableSkeleton";

// ─── Helpers ─────────────────────────────────────────────────────────────────
type ViewMode = "grid" | "table";
type SortKey = "createdAt" | "playCount" | "likeCount" | "totalDuration";
type FilterStatus = "all" | "published" | "draft";
type FilterType = "all" | "auto" | "manual" | "ai";

const STATUS_BADGE = {
  published: { label: "Đã đăng", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  draft: { label: "Bản nháp", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
};

const TYPE_BADGE: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  ai: { label: "AI", icon: <Sparkles className="w-3 h-3" />, cls: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30" },
  manual: { label: "Manual", icon: <Edit2 className="w-3 h-3" />, cls: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30" },
  auto: { label: "Auto", icon: <Zap className="w-3 h-3" />, cls: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30" },
};

// ─── Mini Energy Curve ────────────────────────────────────────────────────────
const MiniEnergyCurve = ({ shorts, size = "sm" }: { shorts?: any[]; size?: "sm" | "xs" }) => {
  if (!shorts || shorts.length === 0) return null;
  const energies = shorts.map((_, i) => Math.max(0.15, Math.abs(Math.sin(i * 1.5) * 0.5 + 0.4)));
  const H = size === "xs" ? 16 : 24;
  const pts = energies.map((e, i) => {
    const x = (i / (energies.length - 1 || 1)) * 100;
    const y = H - e * H;
    return `${x},${y}`;
  });
  const pathD = `M ${pts.join(" L ")}`;
  return (
    <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: H }}>
      <path d={`M 0,${H} L ${pts.join(" L ")} L 100,${H} Z`} fill="#f59e0b20" />
      <path d={pathD} stroke="#f59e0b" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
};

// ─── Mashup Grid Card ─────────────────────────────────────────────────────────
const MashupGridCard = ({
  mashup,
  isSelected,
  onSelect,
  onTogglePublish,
  onDelete,
  onView,
  onEdit,
  isToggling,
}: {
  mashup: IMashup;
  isSelected: boolean;
  onSelect: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
  onView: () => void;
  onEdit: () => void;
  isToggling: boolean;
}) => {
  const coverUrl = mashup.coverImage || mashup.shorts?.[0]?.short?.track?.coverImage;
  const typeMeta = TYPE_BADGE[mashup.creationType] ?? TYPE_BADGE.manual;
  const transitionTypes = [...new Set(mashup.shorts?.map(s => s.transitionType).filter(Boolean))].slice(0, 2);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`relative rounded-2xl border overflow-hidden transition-all duration-300 group hover:shadow-xl dark:hover:shadow-black/40 hover:-translate-y-1 bg-card ${isSelected ? "border-primary shadow-md shadow-primary/20 ring-1 ring-primary" : "border-border/50 hover:border-primary/50"
        }`}
    >
      {/* Select checkbox */}
      <button
        onClick={onSelect}
        className={`absolute top-3 left-3 z-20 w-6 h-6 rounded-md border-2 transition-all duration-200 flex items-center justify-center shadow-sm ${isSelected ? "bg-primary border-primary" : "bg-black/40 border-white/60 opacity-0 group-hover:opacity-100 hover:bg-black/60 hover:border-white"
          }`}
      >
        {isSelected && <CheckSquare className="w-4 h-4 text-primary" />}
      </button>

      {/* Cover */}
      <div className="relative h-44 bg-black overflow-hidden">
        <ImageWithFallback
          src={coverUrl}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Top badges */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${mashup.isPublished ? STATUS_BADGE.published.cls : STATUS_BADGE.draft.cls
            }`}>
            {mashup.isPublished ? "Đã đăng" : "Bản nháp"}
          </span>
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${typeMeta.cls}`}>
            {typeMeta.icon}{typeMeta.label}
          </span>
        </div>

        {/* Action buttons on hover */}
        <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={onView}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center hover:bg-primary/80 transition-colors"
            title="Xem"
          >
            <Eye className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={onEdit}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center hover:bg-primary/80 transition-colors"
            title="Chỉnh sửa"
          >
            <Edit2 className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={onDelete}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center hover:bg-red-500/80 transition-colors"
            title="Xóa"
          >
            <Trash2 className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Duration */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/70 shadow-sm backdrop-blur px-2 py-0.5 rounded-md">
          <Clock className="w-3 h-3 text-white/70" />
          <span className="text-[10px] text-white font-mono">{formatMashupDuration(mashup.totalDuration || 0)}</span>
        </div>

        {/* Tracks count */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-primary/90 shadow-sm backdrop-blur px-2 py-0.5 rounded-md">
          <Layers className="w-3 h-3 text-white" />
          <span className="text-[10px] text-white font-bold">{mashup.shorts?.length || 0} tracks</span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5 space-y-3">
        {/* Title & creator */}
        <div>
          <h3 className="font-bold text-sm line-clamp-1 text-foreground">{mashup.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {mashup.createdBy?.name || "Unknown"} • {new Date(mashup.createdAt).toLocaleDateString("vi-VN")}
          </p>
        </div>

        {/* Energy curve */}
        <MiniEnergyCurve shorts={mashup.shorts} size="sm" />

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Play className="w-3 h-3" />{(mashup.playCount || 0).toLocaleString()}</span>
          <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{(mashup.likeCount || 0).toLocaleString()}</span>
          <span className="flex items-center gap-1 ml-auto">
            <BarChart2 className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400">{mashup.compatibilityScore || 0}%</span>
          </span>
        </div>

        {/* Transition badges */}
        {transitionTypes.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {transitionTypes.map(t => {
              const m = TRANSITION_META[t as keyof typeof TRANSITION_META];
              return m ? (
                <span
                  key={t}
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded border"
                  style={{ backgroundColor: `${m.color}15`, borderColor: `${m.color}40`, color: m.color }}
                >
                  {m.icon} {m.label}
                </span>
              ) : null;
            })}
          </div>
        )}

        {/* Footer: toggle publish */}
        <div className="flex items-center justify-between pt-2.5 border-t border-border/50">
          <span className="text-xs text-muted-foreground">{mashup.isPublished ? "Đang hiển thị" : "Đang ẩn"}</span>
          <Switch
            checked={mashup.isPublished}
            onCheckedChange={onTogglePublish}
            disabled={isToggling}
          />
        </div>
      </div>
    </motion.div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export const MashupManagementPage = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { data, isLoading } = useMashupsAdmin({
    search: search || undefined,
    status: filterStatus === "all" ? undefined : filterStatus,
    type: filterType === "all" ? undefined : filterType,
    sortBy,
    limit: 100,
  });

  const deleteMashup = useDeleteMashup();
  const togglePublish = useToggleMashupPublish();

  // Fallback: use data from the response, or mock empty
  const rawList: IMashup[] = (data?.data?.mashups || []) as IMashup[];

  const stats = useMemo(() => ({
    total: rawList.length,
    published: rawList.filter(m => m.isPublished).length,
    draft: rawList.filter(m => !m.isPublished).length,
    ai: rawList.filter(m => m.creationType === "ai").length,
  }), [rawList]);

  const handleTogglePublish = async (mashup: IMashup) => {
    setTogglingId(mashup._id);
    try {
      await togglePublish.mutateAsync({ id: mashup._id, isPublished: mashup.isPublished });
      toast.success(mashup.isPublished ? "Đã ẩn Mashup" : "Đã đăng Mashup");
    } catch {
      toast.error("Không thể cập nhật trạng thái");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMashup.mutateAsync(deleteTarget.id);
      toast.success(`Đã xóa "${deleteTarget.title}"`);
      setDeleteTarget(null);
      setSelectedIds(prev => { const n = new Set(prev); n.delete(deleteTarget.id); return n; });
    } catch {
      toast.error("Không thể xóa Mashup");
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all([...selectedIds].map(id => deleteMashup.mutateAsync(id)));
      toast.success(`Đã xóa ${selectedIds.size} mashup`);
      setSelectedIds(new Set());
    } catch {
      toast.error("Lỗi khi xóa hàng loạt");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === rawList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rawList.map(m => m._id)));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black font-display tracking-tight flex items-center gap-3">
            <div className="p-2 bg-primary/15 rounded-xl">
              <Layers className="w-6 h-6 text-primary" />
            </div>
            Quản Lý Mashup
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Quản lý, chỉnh sửa và kiểm duyệt tất cả Mashup trên hệ thống</p>
        </div>
        <Button
          onClick={() => navigate("/mashups/create")}
          className="gap-2 shadow-lg shadow-primary/20 rounded-xl"
        >
          <Plus className="w-4 h-4" /> Tạo Mashup Mới
        </Button>
      </div>

      {/* ── STATS PILLS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Tổng", value: stats.total, icon: <Layers className="w-4 h-4" />, color: "text-primary", bg: "bg-primary/10" },
          { label: "Đã đăng", value: stats.published, icon: <Eye className="w-4 h-4" />, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Bản nháp", value: stats.draft, icon: <Edit2 className="w-4 h-4" />, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "AI tạo", value: stats.ai, icon: <Sparkles className="w-4 h-4" />, color: "text-violet-400", bg: "bg-violet-500/10" },
        ].map(stat => (
          <div key={stat.label} className="flex items-center gap-3 p-4 rounded-2xl border border-border/50 bg-card shadow-sm backdrop-blur">
            <div className={`p-2 rounded-xl ${stat.bg}`}>
              <span className={stat.color}>{stat.icon}</span>
            </div>
            <div>
              <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── FILTER BAR ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm mashup..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-background/50 border-border/50 focus-visible:ring-primary focus-visible:border-primary transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <Select value={filterStatus} onValueChange={v => setFilterStatus(v as FilterStatus)}>
          <SelectTrigger className="w-36 bg-background/50 border-border/50 hover:bg-accent/50 transition-colors">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="published">Đã đăng</SelectItem>
            <SelectItem value="draft">Bản nháp</SelectItem>
          </SelectContent>
        </Select>

        {/* Type filter */}
        <Select value={filterType} onValueChange={v => setFilterType(v as FilterType)}>
          <SelectTrigger className="w-32 bg-background/50 border-border/50 hover:bg-accent/50 transition-colors">
            <SelectValue placeholder="Loại" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả loại</SelectItem>
            <SelectItem value="ai">AI</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="auto">Auto</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-36 bg-background/50 border-border/50 hover:bg-accent/50 transition-colors">
            <SelectValue placeholder="Sắp xếp" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Mới nhất</SelectItem>
            <SelectItem value="playCount">Lượt nghe</SelectItem>
            <SelectItem value="likeCount">Lượt thích</SelectItem>
            <SelectItem value="totalDuration">Thời lượng</SelectItem>
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg border border-border/50 ml-auto">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-md transition-all duration-200 ${viewMode === "grid" ? "bg-background shadow-sm text-primary ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}
            title="Dạng lưới"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-1.5 rounded-md transition-all duration-200 ${viewMode === "table" ? "bg-background shadow-sm text-primary ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}
            title="Dạng bảng"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── BULK ACTION BAR ── */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/30 shadow-sm"
          >
            <span className="text-sm font-semibold text-primary">Đã chọn {selectedIds.size}</span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              className="gap-2 rounded-lg"
              disabled={deleteMashup.isPending}
            >
              <Trash2 className="w-3.5 h-3.5" /> Xóa đã chọn
            </Button>
            <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CONTENT ── */}
      {isLoading ? (
        <TableSkeleton cols={6} rows={8} />
      ) : rawList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-muted/50 border border-border/50 rounded-2xl shadow-inner mt-4">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 border border-border/50 flex items-center justify-center shadow-inner mb-4">
            <Layers className="w-8 h-8 opacity-30" />
          </div>
          <p className="text-lg font-semibold opacity-60">Chưa có Mashup nào</p>
          <Button onClick={() => navigate("/mashups/create")} className="mt-4 gap-2">
            <Plus className="w-4 h-4" /> Tạo Mashup đầu tiên
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        // ── GRID VIEW ──
        <div>
          {/* Select all */}
          <div className="flex items-center gap-2 mb-4 bg-muted/50 border border-border/50 p-2.5 rounded-xl shadow-sm">
            <button onClick={toggleSelectAll} className="text-sm font-medium text-muted-foreground hover:text-primary flex items-center gap-2 transition-colors pl-1">
              <CheckSquare className="w-4 h-4" />
              {selectedIds.size === rawList.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </button>
            <span className="text-sm font-medium text-muted-foreground ml-auto pr-2">{rawList.length} mashup</span>
          </div>
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {rawList.map(mashup => (
                <MashupGridCard
                  key={mashup._id}
                  mashup={mashup}
                  isSelected={selectedIds.has(mashup._id)}
                  onSelect={() => toggleSelect(mashup._id)}
                  onTogglePublish={() => handleTogglePublish(mashup)}
                  onDelete={() => setDeleteTarget({ id: mashup._id, title: mashup.title })}
                  onView={() => navigate(`/mashups/${mashup._id}`)}
                  onEdit={() => navigate(`/mashups/create`, { state: { editMashupId: mashup._id } })}
                  isToggling={togglingId === mashup._id}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      ) : (
        // ── TABLE VIEW ──
        <div className="rounded-2xl border border-border/50 overflow-hidden bg-card/50 backdrop-blur shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="w-10">
                  <button onClick={toggleSelectAll}>
                    <CheckSquare className={`w-4 h-4 ${selectedIds.size === rawList.length ? "text-primary" : "text-muted-foreground"}`} />
                  </button>
                </TableHead>
                <TableHead>Mashup</TableHead>
                <TableHead>Người tạo</TableHead>
                <TableHead>Tracks</TableHead>
                <TableHead>Thời lượng</TableHead>
                <TableHead>Lượt nghe</TableHead>
                <TableHead>Thích</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rawList.map((mashup, idx) => {
                const coverUrl = mashup.coverImage || mashup.shorts?.[0]?.short?.track?.coverImage;
                const typeMeta = TYPE_BADGE[mashup.creationType] ?? TYPE_BADGE.manual;
                return (
                  <motion.tr
                    key={mashup._id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className={`border-border/50 hover:bg-muted/50 transition-colors ${selectedIds.has(mashup._id) ? "bg-primary/5" : ""}`}
                  >
                    <TableCell>
                      <button onClick={() => toggleSelect(mashup._id)}>
                        <CheckSquare className={`w-4 h-4 ${selectedIds.has(mashup._id) ? "text-primary" : "text-muted-foreground"}`} />
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                          <ImageWithFallback src={coverUrl} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate max-w-[180px]">{mashup.title}</p>
                          <div className="w-24 mt-1">
                            <MiniEnergyCurve shorts={mashup.shorts} size="xs" />
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{mashup.createdBy?.name || "—"}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <Layers className="w-3.5 h-3.5 text-primary" />
                        {mashup.shorts?.length || 0}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{formatMashupDuration(mashup.totalDuration || 0)}</TableCell>
                    <TableCell className="text-sm">{(mashup.playCount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{(mashup.likeCount || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border w-fit ${typeMeta.cls}`}>
                        {typeMeta.icon}{typeMeta.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={mashup.isPublished}
                        onCheckedChange={() => handleTogglePublish(mashup)}
                        disabled={togglingId === mashup._id}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/mashups/${mashup._id}`)}
                          className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                          title="Xem"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ id: mashup._id, title: mashup.title })}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── DELETE DIALOG ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa Mashup?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn chắc chắn muốn xóa <span className="font-semibold text-foreground">"{deleteTarget?.title}"</span>?
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMashup.isPending ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
