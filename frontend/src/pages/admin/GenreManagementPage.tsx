import React, {
  useState,
  useMemo,
  useCallback,
  lazy,
  Suspense,
  useRef,
} from "react";
import { Plus, Trash2 } from "lucide-react";

import { APP_CONFIG } from "@/config/constants";

// Hooks
import { useGenreParams } from "@/features/genre/hooks/useGenreParams";
import { useGenreMutations } from "@/features/genre/hooks/useGenreMutations";

// UI Components
import { Button } from "@/components/ui/button";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import PageHeader from "@/components/ui/PageHeader";
import Pagination from "@/utils/pagination";
import MusicResult from "@/components/ui/Result";
// Lazy-load modals to reduce initial bundle cost for the admin page
const GenreModalLazy = lazy(
  () => import("@/features/genre/components/GenreModal"),
);
const ConfirmationModalLazy = lazy(
  () => import("@/components/ui/ConfirmationModal"),
);
import TableSkeleton from "@/components/ui/TableSkeleton";
import { GenreFilters } from "@/features/genre/components/GenreFilters";

import { handleError } from "@/utils/handleError";
import { useSmartBack } from "@/hooks/useSmartBack";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";

import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import { IGenre, useGenresByAdminQuery } from "@/features/genre";

// Lazy-load the heavy row component so admin page initial bundle is smaller
const GenreRowLazy = lazy(() =>
  import("./components/GenreRow").then((m) => ({ default: m.GenreRow })),
);

const GenreManagementPage: React.FC = () => {
  const VIRTUALIZE_THRESHOLD = 60;

  const {
    filterParams,
    handleSearch,
    handleFilterChange,
    handlePageChange,
    clearFilters,
  } = useGenreParams();

  const { data, isLoading, isError, refetch } =
    useGenresByAdminQuery(filterParams);

  const genreData = useMemo(() => data?.genres ?? [], [data?.genres]);
  const meta = useMemo(
    () => ({
      page: 1,
      pageSize: APP_CONFIG.GRID_LIMIT,
      totalItems: 0,
      totalPages: 1,
      ...(data?.meta || {}),
    }),
    [data?.meta],
  );

  const parentRef = useRef<HTMLDivElement | null>(null);

  const virtualizer = useVirtualizer({
    count: genreData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92,
    overscan: 6,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalVirtualH = virtualizer.getTotalSize();
  const shouldVirtualize = genreData.length > VIRTUALIZE_THRESHOLD;

  const {
    deleteGenre,
    toggleGenreStatus,
    createGenreAsync,
    updateGenreAsync,
    restoreGenreAsync,
    isMutating,
  } = useGenreMutations();

  // Reset parentId to 'none' for a genre (quick action)
  const handleResetParent = useCallback(
    async (g: IGenre) => {
      try {
        const fd = new FormData();
        // send empty string to explicitly clear parentId (backend accepts "" or null)
        fd.append("parentId", "");
        await updateGenreAsync({ id: g._id, data: fd } as any);
        toast.success(`Genre "${g.name}" là top-level.`);
      } catch (err) {
        handleError(err, "Lỗi khi đặt lại thể loại cha");
      }
    },
    [updateGenreAsync],
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [genreToEdit, setGenreToEdit] = useState<IGenre | null>(null);
  const [genreToDelete, setGenreToDelete] = useState<IGenre | null>(null);

  const handleOpenCreate = useCallback(() => {
    setGenreToEdit(null);
    setIsModalOpen(true);
  }, []);
  const handleOpenEdit = useCallback((g: IGenre) => {
    setGenreToEdit(g);
    setIsModalOpen(true);
  }, []);
  const handleAskDelete = useCallback((g: IGenre) => {
    setGenreToDelete(g);
  }, []);
  const handleToggleStatus = useCallback(
    async (g: IGenre) => {
      try {
        await toggleGenreStatus(g._id);
      } catch (err) {
        handleError(err, "Lỗi cập nhật trạng thái");
      }
    },
    [toggleGenreStatus],
  );

  const handleDeleteById = useCallback(async () => {
    if (!genreToDelete) return;
    deleteGenre(genreToDelete._id);
    setGenreToDelete(null);
  }, [genreToDelete, deleteGenre]);

  const handleRestore = useCallback(
    async (g: IGenre) => {
      try {
        await restoreGenreAsync?.(g._id);
      } catch (err) {
        handleError(err, "Lỗi khôi phục thể loại");
      }
    },
    [restoreGenreAsync],
  );

  const handleSubmitForm = useCallback(
    async (formData: FormData) => {
      try {
        if (genreToEdit)
          await updateGenreAsync({
            id: genreToEdit._id,
            data: formData,
          } as any);
        else await createGenreAsync(formData as any);
        setIsModalOpen(false);
      } catch (err) {
        handleError(err, "Lỗi lưu thể loại");
        // Rethrow so form hook can map field errors and keep modal open
        throw err;
      }
    },
    [genreToEdit, createGenreAsync, updateGenreAsync],
  );

  const onBack = useSmartBack();
  const isFiltering = Boolean(filterParams.keyword);
  const hasResults = genreData.length > 0;
  const isOffline = !useOnlineStatus();

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
          isAdmin
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
          <div className="px-4 pb-4">
            <Table
              className="w-full border-collapse"
              style={{ tableLayout: "fixed" }}
            >
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
                <TableSkeleton rows={meta.pageSize || 10} cols={7} hasAvatar />
              </TableBody>
            </Table>
          </div>
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
          <div
            ref={parentRef}
            className="px-4 pb-4 max-h-[60vh] overflow-y-auto"
          >
            <Table
              className="w-full border-collapse"
              style={{ tableLayout: "fixed" }}
            >
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
                  <TableSkeleton
                    rows={meta.pageSize || 10}
                    cols={7}
                    hasAvatar
                  />
                ) : genreData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-[450px]">
                      <MusicResult
                        variant="empty-genres"
                        description="Genre hiện đang trống"
                      />
                    </TableCell>
                  </TableRow>
                ) : shouldVirtualize ? (
                  <Suspense
                    fallback={
                      <>
                        {Array.from({
                          length: Math.min(8, genreData.length),
                        }).map((_, i) => (
                          <TableSkeleton key={`sk-fb-${i}`} rows={1} cols={7} />
                        ))}
                      </>
                    }
                  >
                    {(() => {
                      const first = virtualItems[0];
                      const last = virtualItems[virtualItems.length - 1];
                      const topH = first && first.start > 0 ? first.start : 0;
                      const botH = last ? totalVirtualH - last.end : 0;

                      return (
                        <>
                          {topH > 0 && (
                            <tr aria-hidden style={{ height: `${topH}px` }} />
                          )}
                          {virtualItems.map((vRow) => {
                            const g = genreData[vRow.index];
                            if (!g)
                              return (
                                <TableSkeleton
                                  key={`sk-${vRow.index}`}
                                  rows={1}
                                  cols={7}
                                />
                              );
                            return (
                              <GenreRowLazy
                                key={g._id}
                                genre={g}
                                index={vRow.index}
                                page={meta.page}
                                pageSize={
                                  meta.pageSize || APP_CONFIG.PAGINATION_LIMIT
                                }
                                onEdit={handleOpenEdit}
                                onAskDelete={handleAskDelete}
                                onRestore={handleRestore}
                                onResetParent={handleResetParent}
                                onToggleStatus={handleToggleStatus}
                                isMutating={isMutating}
                              />
                            );
                          })}
                          {botH > 0 && (
                            <tr aria-hidden style={{ height: `${botH}px` }} />
                          )}
                        </>
                      );
                    })()}
                  </Suspense>
                ) : (
                  <Suspense
                    fallback={
                      <>
                        {Array.from({
                          length: Math.min(8, genreData.length),
                        }).map((_, i) => (
                          <TableSkeleton key={`sk-fb-${i}`} rows={1} cols={7} />
                        ))}
                      </>
                    }
                  >
                    {genreData.map((genre: IGenre, index: number) => (
                      <GenreRowLazy
                        key={genre._id}
                        genre={genre}
                        index={index}
                        page={meta.page}
                        pageSize={meta.pageSize || APP_CONFIG.PAGINATION_LIMIT}
                        onEdit={handleOpenEdit}
                        onAskDelete={handleAskDelete}
                        onRestore={handleRestore}
                        onResetParent={handleResetParent}
                        onToggleStatus={handleToggleStatus}
                        isMutating={isMutating}
                      />
                    ))}
                  </Suspense>
                )}
              </TableBody>
            </Table>
          </div>
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

      {/* --- MODALS (lazy) --- */}
      <Suspense fallback={null}>
        <GenreModalLazy
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          genreToEdit={genreToEdit}
          onSubmit={handleSubmitForm}
          isPending={isMutating}
        />
      </Suspense>

      <Suspense fallback={null}>
        <ConfirmationModalLazy
          isOpen={!!genreToDelete}
          onCancel={() => setGenreToDelete(null)}
          onConfirm={handleDeleteById}
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
      </Suspense>
    </div>
  );
};

export default GenreManagementPage;
