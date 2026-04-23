import { useState } from "react";
import { Plus } from "lucide-react";
import { APP_CONFIG } from "@/config/constants";

// Components
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/ui/PageHeader";
import CardSkeleton from "@/components/ui/CardSkeleton";
import Pagination from "@/utils/pagination";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import MusicResult from "@/components/ui/Result";

// Feature Components
import PlaylistFilter from "@/features/playlist/components/PlaylistFilter";
import PlaylistCard from "@/features/playlist/components/PlaylistCard";
import PlaylistModal from "@/features/playlist/components/PlaylistModal";

// 🔥 Hooks mới (đã tách)
import { usePlaylistParams } from "@/features/playlist/hooks/usePlaylistParams";
import { usePlaylistsQuery } from "@/features/playlist/hooks/usePlaylistsQuery";
import { usePlaylistMutations } from "@/features/playlist/hooks/usePlaylistMutations";
import { IPlaylist, Playlistpageskeleton } from "@/features";

import { useSmartBack } from "@/hooks/useSmartBack";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";

const PlaylistManagementPage = () => {
  // --- 1. STATE MANAGEMENT (URL Source of Truth) ---
  const {
    filterParams,
    handleSearch,
    handleFilterChange, // Thay thế setFilterParams bằng handler chuẩn
    handlePageChange,
    clearFilters: handleReset, // Đổi tên cho đồng bộ UI
  } = usePlaylistParams(APP_CONFIG.PAGINATION_LIMIT || 12);

  // --- 2. DATA FETCHING (Read) ---
  const { data, isLoading, isError, refetch } = usePlaylistsQuery(filterParams);

  // --- 3. MUTATIONS (Write) ---
  const {
    createPlaylistAsync,
    updatePlaylistAsync,
    deletePlaylist,
    isMutating, // Loading cho Save/Delete
  } = usePlaylistMutations();

  // --- 4. LOCAL UI STATE ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [playlistToEdit, setPlaylistToEdit] = useState<IPlaylist | null>(null);
  const [playlistToDelete, setPlaylistToDelete] = useState<IPlaylist | null>(
    null,
  );

  // --- HANDLERS ---
  const handleOpenCreate = () => {
    setPlaylistToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (playlist: IPlaylist) => {
    setPlaylistToEdit(playlist);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (playlistToDelete) {
      deletePlaylist(playlistToDelete._id, {
        onSuccess: () => setPlaylistToDelete(null),
      });
    }
  };

  // 🔥 CORE LOGIC: Handle Form Submit (FormData)
  // Logic giống hệt AlbumManagementPage: Đơn giản, dễ hiểu
  const handleSubmitForm = async (formData: FormData) => {
    try {
      if (playlistToEdit) {
        await updatePlaylistAsync(playlistToEdit._id, formData);
      } else {
        await createPlaylistAsync(formData);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Failed to save playlist", error);
      // Giữ modal mở để user sửa lỗi
    }
  };

  // Safe Access Data
  const playlists = data?.playlists || [];
  const meta = data?.meta || {
    totalPages: 1,
    totalItems: 0,
    page: 1,
    pageSize: 12,
  };
  const skeletonCount = meta.pageSize || APP_CONFIG.PAGINATION_LIMIT;
  const hasResults = playlists.length > 0;
  const isFiltering = Boolean(filterParams.keyword);

  const onBack = useSmartBack();
  const isOffline = !navigator.onLine;
  // ── Error state ─────────────────────────────────────────────────────────
  // Initial Load
  if (isLoading && !hasResults) {
    return <Playlistpageskeleton cardCount={meta.pageSize || 18} />;
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
        title="Playlists Management"
        subtitle={`Managing ${meta.totalItems} playlists in the system.`}
        action={
          <Button
            onClick={handleOpenCreate}
            className="shadow-md bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-6"
          >
            <Plus className="w-4 h-4 mr-2" /> New Playlist
          </Button>
        }
      />

      {/* --- FILTER --- */}
      {/* Truyền trực tiếp các handler từ usePlaylistParams.
          Component Filter không cần biết setParams là gì, chỉ cần biết onSearch, onFilterChange...
      */}
      <div className="bg-card rounded-2xl shadow-sm">
        <PlaylistFilter
          params={filterParams}
          onSearch={handleSearch}
          onFilterChange={handleFilterChange} // Sử dụng hàm generic
          onReset={handleReset}
        />
      </div>

      {/* --- CONTENT --- */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
          {/* Render 10 cái skeleton với hiệu ứng wave */}
          <CardSkeleton count={skeletonCount} />
        </div>
      ) : !hasResults ? (
        !isLoading && !isFiltering ? (
          <MusicResult
            variant="empty-playlists"
            description="Album hiện đang trống"
          />
        ) : (
          <MusicResult
            variant="empty-playlists"
            description="Không có kết quả! Thử bộ lọc khác "
            onClearFilters={handleReset}
            onBack={onBack}
          />
        )
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6 animate-in fade-in duration-500">
          {playlists.map((playlist: IPlaylist) => (
            <PlaylistCard
              key={playlist._id}
              playlist={playlist}
              onEdit={() => handleOpenEdit(playlist)}
              onDelete={() => setPlaylistToDelete(playlist)}
            />
          ))}
        </div>
      )}

      {!isLoading && playlists.length > 0 && (
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

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <PlaylistModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          playlistToEdit={playlistToEdit}
          onSubmit={handleSubmitForm}
          isPending={isMutating} // Loading spinner cho nút Save
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={!!playlistToDelete}
        onCancel={() => setPlaylistToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Playlist?"
        isLoading={isMutating}
        description={
          <div className="space-y-4">
            <p className="text-sm text-foreground/80">
              Are you sure you want to delete{" "}
              <strong className="text-foreground text-base">
                {playlistToDelete?.title}
              </strong>
              ?
            </p>
            {playlistToDelete?.isSystem ? (
              <div className="text-xs font-medium text-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800/50 flex items-start gap-3">
                <span className="text-lg leading-none">⚠️</span>
                <p>
                  This is a <strong>System Playlist</strong>. Deleting it will
                  remove it from the homepage of all users.
                </p>
              </div>
            ) : (
              <div className="text-xs font-medium text-muted-foreground bg-muted/50 p-3 rounded-lg border border-border flex items-start gap-3">
                <span className="text-lg leading-none">ℹ️</span>
                <p>
                  This is a User Playlist. Typically, you only delete this if it
                  violates platform policies.
                </p>
              </div>
            )}
          </div>
        }
        confirmLabel="Yes, Delete"
        isDestructive
      />
    </div>
  );
};

export default PlaylistManagementPage;
