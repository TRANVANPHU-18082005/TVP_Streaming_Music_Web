import React, { useState, useMemo, useCallback, lazy, Suspense } from "react";
import { Plus } from "lucide-react";

import { APP_CONFIG } from "@/config/constants";

// Hooks
import { useGenreParams } from "@/features/genre/hooks/useGenreParams";
import { useGenreMutations } from "@/features/genre/hooks/useGenreMutations";

// UI Components
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/ui/PageHeader";
import Pagination from "@/utils/pagination";
import MusicResult from "@/components/ui/Result";
import CardSkeleton from "@/components/ui/CardSkeleton";
import { GenreFilters } from "@/features/genre/components/GenreFilters";
import { handleError } from "@/utils/handleError";
import { useSmartBack } from "@/hooks/useSmartBack";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { IGenre, useGenresByAdminQuery } from "@/features/genre";

// Lazy-load components
const GenreModalLazy = lazy(() => import("@/features/genre/components/GenreModal"));
const AdminGenreCard = lazy(() => import("@/features/genre/components/AdminGenreCard"));

const GenreManagementPage: React.FC = () => {
  const {
    filterParams,
    handleSearch,
    handleFilterChange,
    handlePageChange,
    clearFilters,
  } = useGenreParams();

  const { data, isLoading, isError, refetch } = useGenresByAdminQuery(filterParams);

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

  const {
    deleteGenre,
    toggleGenreStatus,
    createGenreAsync,
    updateGenreAsync,
    restoreGenreAsync,
    isMutating,
  } = useGenreMutations();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [genreToEdit, setGenreToEdit] = useState<IGenre | null>(null);

  const handleOpenCreate = useCallback(() => {
    setGenreToEdit(null);
    setIsModalOpen(true);
  }, []);
  
  const handleOpenEdit = useCallback((g: IGenre) => {
    setGenreToEdit(g);
    setIsModalOpen(true);
  }, []);
  
  const handleAskDelete = useCallback((g: IGenre) => {
    // We can call delete directly since the Card has its own Confirmation modal now, wait, the Card has a Confirmation modal internally.
    deleteGenre(g._id);
  }, [deleteGenre]);
  
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
        throw err;
      }
    },
    [genreToEdit, createGenreAsync, updateGenreAsync],
  );

  const onBack = useSmartBack();
  const isFiltering = Boolean(filterParams.keyword);
  const hasResults = genreData.length > 0;
  const isOffline = !useOnlineStatus();
  const skeletonCount = meta.pageSize || APP_CONFIG.GRID_LIMIT;

  // Deep Error
  if (isError && !hasResults) {
    return (
      <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
        <MusicResult variant="error" onRetry={refetch} />
      </div>
    );
  }
  
  // Offline
  if (isOffline) {
    return (
      <div className="section-container space-y-6 sm:space-y-8 pt-4 pb-4">
        <MusicResult variant="error-network" onRetry={refetch} onBack={onBack} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10 max-w-[1600px] mx-auto">
      {/* --- HEADER --- */}
      <PageHeader
        title="Genres Library"
        subtitle={`Organizing ${meta.totalItems} music styles in your system.`}
        action={
          <Button
            onClick={handleOpenCreate}
            className="shadow-md bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-6"
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

      {/* --- CONTENT GRID --- */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
          <CardSkeleton count={skeletonCount} />
        </div>
      ) : !hasResults ? (
        !isLoading && !isFiltering ? (
          <MusicResult variant="empty-genres" description="Genre hiện đang trống" />
        ) : (
          <MusicResult
            variant="empty-genres"
            description="Không có kết quả! Thử bộ lọc khác "
            onClearFilters={clearFilters}
            onBack={onBack}
          />
        )
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6 animate-in fade-in duration-500">
          <Suspense fallback={<CardSkeleton count={skeletonCount} />}>
            {genreData.map((genre) => (
              <AdminGenreCard
                key={genre._id}
                genre={genre}
                onEdit={handleOpenEdit}
                onDelete={handleAskDelete}
                onRestore={handleRestore}
                onToggleStatus={handleToggleStatus}
                isMutating={isMutating}
              />
            ))}
          </Suspense>
        </div>
      )}

      {/* --- FOOTER --- */}
      {!isLoading && genreData.length > 0 && (
        <div className="bg-card border rounded-2xl p-4 shadow-sm">
          <Pagination
            currentPage={meta.page}
            totalPages={meta.totalPages}
            onPageChange={handlePageChange}
            totalItems={meta.totalItems}
            pageSize={meta.pageSize || APP_CONFIG.PAGINATION_LIMIT}
          />
        </div>
      )}

      {/* --- MODALS (lazy) --- */}
      <Suspense fallback={null}>
        {isModalOpen && (
          <GenreModalLazy
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            genreToEdit={genreToEdit}
            onSubmit={handleSubmitForm}
            isPending={isMutating}
          />
        )}
      </Suspense>
    </div>
  );
};

export default GenreManagementPage;
