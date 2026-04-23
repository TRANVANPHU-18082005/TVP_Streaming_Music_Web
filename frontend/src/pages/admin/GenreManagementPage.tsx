import { useState, useMemo } from "react";
import {
  Plus,
  PenSquare,
  Trash2,
  Music,
  CornerDownRight,
  TrendingUp,
  ListMusic,
  Eye,
  EyeOff,
  ExternalLink,
  MoreVertical,
  Layers,
  FolderTree,
} from "lucide-react";

import { APP_CONFIG } from "@/config/constants";
import { cn } from "@/lib/utils";

// Hooks
import { useGenreParams } from "@/features/genre/hooks/useGenreParams";
import { useGenreMutations } from "@/features/genre/hooks/useGenreMutations";
import { useGenresQuery } from "@/features/genre/hooks/useGenresQuery";

// UI Components
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import PageHeader from "@/components/ui/PageHeader";
import Pagination from "@/utils/pagination";
import MusicResult from "@/components/ui/Result";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import GenreModal from "@/features/genre/components/GenreModal";
import TableSkeleton from "@/components/ui/TableSkeleton";
import { GenreFilters } from "@/features/genre/components/GenreFilters";
import { Link } from "react-router-dom";
import { toast } from "sonner"; // Giả sử bạn dùng sonner để thông báo
import { handleError } from "@/utils/handleError";
import { Genrepageskeleton, IGenre } from "@/features";
import { useSmartBack } from "@/hooks/useSmartBack";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";

const GenreManagementPage = () => {
  // --- 1. STATE & DATA FETCHING ---
  const {
    filterParams,
    handleSearch,
    handleFilterChange,
    handlePageChange,
    clearFilters,
  } = useGenreParams(APP_CONFIG.PAGINATION_LIMIT);

  const { data, isLoading, isError, refetch } = useGenresQuery(filterParams);

  // --- 2. MUTATIONS ---
  const {
    createGenreAsync,
    updateGenreAsync,
    deleteGenre,
    toggleGenreStatus,
    isMutating,
  } = useGenreMutations();

  // --- 3. LOCAL UI STATE ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [genreToEdit, setGenreToEdit] = useState<IGenre | null>(null);
  const [genreToDelete, setGenreToDelete] = useState<IGenre | null>(null);

  // --- 4. HANDLERS ---
  const handleOpenCreate = () => {
    setGenreToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (genre: IGenre) => {
    setGenreToEdit(genre);
    setIsModalOpen(true);
  };

  const handleDelete = () => {
    if (genreToDelete) {
      deleteGenre(genreToDelete._id, {
        onSuccess: () => {
          setGenreToDelete(null);
          toast.success("Genre deleted successfully");
        },
      });
    }
  };

  const handleToggleStatus = async (genre: IGenre) => {
    try {
      await toggleGenreStatus(genre._id);
      toast.success(
        genre.isActive
          ? "Genre archived successfully"
          : "Genre published successfully",
      );
    } catch (error) {
      handleError(error, "Lỗi cập nhật trạng thái");
    }
  };

  const handleSubmitForm = async (formData: FormData) => {
    try {
      if (genreToEdit) {
        await updateGenreAsync({ id: genreToEdit._id, data: formData });
        toast.success("Genre updated successfully");
      } else {
        await createGenreAsync(formData);
        toast.success("Genre created successfully");
      }
      setIsModalOpen(false);
    } catch (error) {
      handleError(error, "Lỗi tạo thể loại");
    }
  };

  // --- 5. RENDER LOGIC ---
  const genreData = useMemo(() => data?.genres || [], [data]);
  const meta = data?.meta || {
    totalPages: 0,
    totalItems: 0,
    page: 1,
    pageSize: 10,
  };

  const onBack = useSmartBack();
  const hasResults = genreData.length > 0;
  const isFiltering = Boolean(filterParams.keyword);

  const isOffline = !navigator.onLine;
  // ── Error state ─────────────────────────────────────────────────────────
  // Initial Load
  if (isLoading && !hasResults) {
    return <Genrepageskeleton cardCount={meta.pageSize} />;
  }
  // Switching
  if (isLoading && hasResults) {
    return <WaveformLoader glass={false} text="Đang tải" />;
  }
  // Deep Error
  if (isError && !hasResults) {
    return (
      <>
        <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
          <MusicResult variant="error" onRetry={refetch} />
        </div>
      </>
    );
  }
  // Offline
  if (isOffline) {
    return (
      <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
        <MusicResult
          variant="error-network"
          onRetry={refetch}
          onBack={onBack}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10 max-w-[1600px] mx-auto ">
      {/* --- HEADER --- */}
      <PageHeader
        title="Genres Library"
        subtitle={`Organizing ${meta.totalItems} music styles in your system.`}
        action={
          <Button
            onClick={handleOpenCreate}
            className="shadow-lg bg-primary hover:bg-primary/90 font-bold px-6 transition-all active:scale-95"
          >
            <Plus className="size-4 mr-2" /> New Genre
          </Button>
        }
      />

      {/* --- FILTERS --- */}
      <div className="bg-card rounded-2xl shadow-sm">
        <GenreFilters
          params={filterParams}
          onSearch={handleSearch}
          onFilterChange={handleFilterChange}
          onReset={clearFilters}
        />
      </div>

      {/* --- TABLE --- */}
      <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden transition-all relative">
        {/* Loading overlay khi đang fetching ngầm */}
        {isLoading ? (
          <TableSkeleton rows={meta.pageSize || 10} cols={7} hasAvatar />
        ) : !hasResults ? (
          !isLoading && !isFiltering ? (
            <MusicResult
              variant="empty-genres"
              description="Genre hiện đang trống"
            />
          ) : (
            <MusicResult
              variant="empty-genres"
              description="Không có kết quả! Thử bộ lọc khác "
              onClearFilters={clearFilters}
              onBack={onBack}
            />
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30 border-b">
                <TableHead className="w-[60px] font-bold text-center text-xs uppercase tracking-wider">
                  #
                </TableHead>
                <TableHead className="min-w-[300px] font-bold text-xs uppercase tracking-wider">
                  Identity
                </TableHead>
                <TableHead className="w-[180px] font-bold text-center text-xs uppercase tracking-wider">
                  Level
                </TableHead>
                <TableHead className="w-[150px] font-bold text-xs uppercase tracking-wider">
                  Content
                </TableHead>
                <TableHead className="w-[120px] font-bold text-xs uppercase tracking-wider">
                  Ranking
                </TableHead>
                <TableHead className="w-[140px] font-bold text-xs uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="text-right font-bold text-xs uppercase tracking-wider pr-6">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableSkeleton rows={meta.pageSize || 10} cols={7} hasAvatar />
              ) : genreData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-[450px]">
                    <MusicResult
                      variant="empty-genres"
                      description="Genre hiện đang trống"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                genreData.map((genre: IGenre, index: number) => {
                  const parent = genre.parentId as IGenre | null;

                  return (
                    <TableRow
                      key={genre._id}
                      className="group hover:bg-muted/40 transition-colors duration-150 border-b last:border-0"
                    >
                      {/* INDEX */}
                      <TableCell className="text-center">
                        <span className="font-mono text-[11px] text-muted-foreground/50 font-medium">
                          {String(
                            (meta.page - 1) *
                              (meta.pageSize || APP_CONFIG.PAGINATION_LIMIT) +
                              index +
                              1,
                          ).padStart(2, "0")}
                        </span>
                      </TableCell>

                      {/* IDENTITY */}
                      <TableCell>
                        <div className="flex items-center gap-4">
                          <div className="relative shrink-0">
                            <div className="size-12 rounded-xl overflow-hidden border-2 border-background shadow-md bg-muted group-hover:scale-105 transition-transform duration-300">
                              {genre.image ? (
                                <img
                                  src={genre.image}
                                  alt={genre.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-primary/5">
                                  <Music className="size-5 text-primary/30" />
                                </div>
                              )}
                            </div>
                            <div
                              className="absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-background shadow-sm"
                              style={{
                                backgroundColor: genre.color || "#CBD5E1",
                              }}
                            />
                          </div>

                          <div className="flex flex-col min-w-0">
                            <Link
                              to={`/genres/${genre.slug || genre._id}`}
                              className="font-bold text-sm text-foreground hover:text-primary transition-colors truncate flex items-center gap-1.5"
                            >
                              {genre.name}
                              {genre.parentId && (
                                <CornerDownRight className="size-3 text-muted-foreground/40" />
                              )}
                            </Link>
                            <span className="text-[11px] text-muted-foreground line-clamp-1 italic">
                              {genre.description || "No description provided"}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* HIERARCHY */}
                      <TableCell className="text-center">
                        {parent ? (
                          <Badge
                            variant="outline"
                            className="bg-primary/5 text-primary border-primary/10 hover:bg-primary/20 font-medium transition-colors"
                          >
                            <FolderTree className="size-3 mr-1.5" />{" "}
                            {parent.name}
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-muted/50 text-muted-foreground/60 border-transparent font-normal"
                          >
                            <Layers className="size-3 mr-1.5 opacity-40" />{" "}
                            Master
                          </Badge>
                        )}
                      </TableCell>

                      {/* METRICS */}
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 text-[11px] font-bold">
                            <ListMusic className="size-3 text-primary" />
                            <span>{genre.trackCount || 0} Tracks</span>
                          </div>
                          <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary/40 transition-all duration-1000"
                              style={{
                                width: `${Math.min((genre.trackCount || 0) * 2, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </TableCell>

                      {/* DISCOVERY */}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-muted-foreground/50">
                            RANK: {genre.priority || 0}
                          </span>
                          {genre.isTrending && (
                            <div className="flex items-center text-[9px] font-black text-orange-500 bg-orange-500/10 w-fit px-2 py-0.5 rounded-full border border-orange-500/20 shadow-sm animate-pulse">
                              <TrendingUp className="size-2.5 mr-1" /> TRENDING
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* VISIBILITY */}
                      <TableCell>
                        <div
                          className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border shadow-sm transition-all",
                            genre.isActive
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : "bg-destructive/10 text-destructive border-destructive/20",
                          )}
                        >
                          <div
                            className={cn(
                              "size-1.5 rounded-full",
                              genre.isActive
                                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                : "bg-destructive/30",
                            )}
                          />
                          {genre.isActive ? "PUBLISHED" : "HIDDEN"}
                        </div>
                      </TableCell>

                      {/* ACTIONS */}
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenEdit(genre)}
                                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-primary hover:bg-primary/5"
                                >
                                  <PenSquare className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Quick Edit</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 transition-colors active:bg-muted"
                              >
                                <MoreVertical className="size-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-52 p-1.5 shadow-xl border-border/50"
                            >
                              <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground/60 px-2 py-2">
                                Management
                              </DropdownMenuLabel>

                              <DropdownMenuItem
                                onClick={() => handleOpenEdit(genre)}
                                className="rounded-lg cursor-pointer"
                              >
                                <ExternalLink className="mr-2 size-4 text-primary" />{" "}
                                View Analytics
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => handleToggleStatus(genre)}
                                className="rounded-lg cursor-pointer"
                                disabled={isMutating}
                              >
                                {genre.isActive ? (
                                  <>
                                    <EyeOff className="mr-2 size-4 text-orange-500" />{" "}
                                    Archive Genre
                                  </>
                                ) : (
                                  <>
                                    <Eye className="mr-2 size-4 text-emerald-500" />{" "}
                                    Publish Genre
                                  </>
                                )}
                              </DropdownMenuItem>

                              <DropdownMenuSeparator className="my-1.5" />

                              <DropdownMenuItem
                                onClick={() => setGenreToDelete(genre)}
                                className="rounded-lg text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                                disabled={isMutating}
                              >
                                <Trash2 className="mr-2 size-4" /> Permanent
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* --- FOOTER --- */}
      {!isLoading && genreData.length > 0 && (
        <div className="bg-card border rounded-2xl p-4 shadow-sm">
          <Pagination
            currentPage={meta.page}
            totalPages={meta.totalPages}
            onPageChange={handlePageChange}
            totalItems={meta.totalItems}
            itemsPerPage={meta.pageSize || APP_CONFIG.PAGINATION_LIMIT}
          />
        </div>
      )}

      {/* --- MODALS --- */}
      <GenreModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        genreToEdit={genreToEdit}
        onSubmit={handleSubmitForm}
        isPending={isMutating}
      />

      <ConfirmationModal
        isOpen={!!genreToDelete}
        onCancel={() => setGenreToDelete(null)}
        onConfirm={handleDelete}
        isLoading={isMutating}
        title="Confirm Deletion"
        description={
          <div className="space-y-3">
            <p>
              Are you sure you want to remove{" "}
              <strong>{genreToDelete?.name}</strong>?
            </p>
            <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-xl text-xs text-destructive leading-relaxed font-medium">
              <span className="font-bold flex items-center gap-1.5 mb-1">
                <Trash2 className="size-3" /> Warning
              </span>
              This action cannot be undone. All tracks associated with this
              genre will lose this classification.
            </div>
          </div>
        }
        confirmLabel={isMutating ? "Deleting..." : "Confirm Delete"}
        isDestructive
      />
    </div>
  );
};

export default GenreManagementPage;
