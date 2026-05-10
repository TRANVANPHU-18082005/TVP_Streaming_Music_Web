import { useState } from "react";
import { Plus } from "lucide-react";
import { APP_CONFIG } from "@/config/constants";

// Components
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/ui/PageHeader";
import AlbumFilter from "@/features/album/components/AlbumFilter";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import AlbumCard from "@/features/album/components/AlbumCard";
import MusicResult from "@/components/ui/Result";
import Pagination from "@/utils/pagination";
import CardSkeleton from "@/components/ui/CardSkeleton";

// Hooks
import { useAlbumParams } from "@/features/album/hooks/useAlbumParams";
import { useAlbumMutations } from "@/features/album/hooks/useAlbumMutations";
import AlbumModal from "@/features/album/components/album-modal";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";
import { useSmartBack } from "@/hooks/useSmartBack";
import {
  Albumpageskeleton,
  IAlbum,
  useAlbumsByAdminQuery,
} from "@/features/album";

const AlbumManagementPage = () => {
  // --- 1. STATE MANAGEMENT (URL) ---
  const {
    filterParams,
    handleSearch,
    handleFilterChange,
    handlePageChange,
    clearFilters,
  } = useAlbumParams();
  const { data, isLoading, isError, refetch } =
    useAlbumsByAdminQuery(filterParams);
  const {
    createAlbumAsync,
    updateAlbumAsync,
    deleteAlbum,
    restoreAlbum,
    isMutating,
  } = useAlbumMutations();

  // --- 4. LOCAL UI STATE ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<IAlbum | null>(null);
  const [albumToDelete, setAlbumToDelete] = useState<IAlbum | null>(null);

  // --- HANDLERS ---
  const handleOpenCreate = () => {
    setEditingAlbum(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (album: IAlbum) => {
    setEditingAlbum(album);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (album: IAlbum) => {
    setAlbumToDelete(album);
  };

  const handleConfirmDelete = () => {
    if (albumToDelete) {
      deleteAlbum(albumToDelete._id, {
        onSuccess: () => setAlbumToDelete(null),
      });
    }
  };

  // 🔥 CORE LOGIC: Handle Form Submit (Data is FormData)
  const handleFormSubmit = async (formData: FormData) => {
    try {
      if (editingAlbum) {
        await updateAlbumAsync({ id: editingAlbum._id, data: formData });
      } else {
        await createAlbumAsync(formData);
      }
      // Chỉ đóng modal khi API thành công (không có lỗi ném ra)
      setIsModalOpen(false);
    } catch (error) {
      console.error("Failed to save album", error);
      // Rethrow so the form hook can map server validation errors to fields
      throw error;
    }
  };

  // Safe access data
  const albums = data?.albums || [];
  const meta = data?.meta || {
    totalPages: 1,
    totalItems: 0,
    page: 1,
    pageSize: 12,
  };
  const skeletonCount = meta.pageSize || APP_CONFIG.PAGINATION_LIMIT;
  const hasResults = albums.length > 0;
  const onBack = useSmartBack();
  const isFiltering = Boolean(filterParams.keyword);
  const isOffline = !navigator.onLine;
  // ── Error state ─────────────────────────────────────────────────────────
  // Initial Load
  if (isLoading && !hasResults) {
    return <Albumpageskeleton cardCount={meta.pageSize || 18} />;
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
    <div className="space-y-8 pb-12">
      {/* --- HEADER --- */}
      <PageHeader
        title="Albums Management"
        subtitle={`Managing ${meta.totalItems} albums in your library.`}
        action={
          <Button
            onClick={handleOpenCreate}
            className="shadow-md bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-6"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Album
          </Button>
        }
      />

      {/* --- FILTER --- */}
      <div className="bg-card rounded-2xl shadow-sm">
        <AlbumFilter
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
          {/* Render 10 cái skeleton với hiệu ứng wave */}
          <CardSkeleton count={skeletonCount} />
        </div>
      ) : !hasResults ? (
        !isLoading && !isFiltering ? (
          <MusicResult
            variant="empty-albums"
            description="Album hiện đang trống"
          />
        ) : (
          <MusicResult
            variant="empty-albums"
            description="Không có kết quả! Thử bộ lọc khác "
            onClearFilters={clearFilters}
            onBack={onBack}
          />
        )
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6 animate-in fade-in duration-500">
          {albums.map((album) => (
            <AlbumCard
              isMutating={isMutating}
              key={album._id}
              album={album}
              onEdit={handleEditClick}
              onDelete={() =>
                album.isDeleted
                  ? restoreAlbum(album._id)
                  : handleDeleteClick(album)
              }
            />
          ))}
        </div>
      )}

      {!isLoading && albums.length > 0 && (
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

      {/* 1. Create/Edit Modal */}
      {isModalOpen && (
        <AlbumModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          albumToEdit={editingAlbum}
          onSubmit={handleFormSubmit}
          isPending={isMutating} //
        />
      )}

      {/* 2. Delete Confirmation */}
      <ConfirmationModal
        isOpen={!!albumToDelete}
        onCancel={() => setAlbumToDelete(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isMutating}
        title="Delete Album?"
        description={
          <span>
            Are you sure you want to delete{" "}
            <strong className="text-foreground">{albumToDelete?.title}</strong>?
            <br />
            <span className="text-destructive font-bold text-sm mt-2 block bg-destructive/10 p-2 rounded border border-destructive/20">
              This action cannot be undone and will remove all tracks associated
              with this album.
            </span>
          </span>
        }
        confirmLabel="Yes, Delete"
        isDestructive
      />
    </div>
  );
};

export default AlbumManagementPage;
