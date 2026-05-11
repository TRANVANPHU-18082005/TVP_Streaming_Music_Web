"use client";

import { useState } from "react";
import { Plus, Video } from "lucide-react";
import { APP_CONFIG } from "@/config/constants";

// Components
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/ui/PageHeader";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import MusicResult from "@/components/ui/Result";
import Pagination from "@/utils/pagination";
import { useMoodVideoMutations } from "@/features/mood-video/hooks/useMoodVideoMutations";
import { useMoodVideosQuery } from "@/features/mood-video/hooks/useMoodVideoQuery";
import { useMoodVideoParams } from "@/features/mood-video/hooks/useMoodVideoParams";
import MoodVideoFilter from "@/features/mood-video/components/MoodVideoFilter";
import { MoodVideoGrid } from "@/features/mood-video/components/MoodVideoGrid";
import MoodVideoModal from "@/features/mood-video/components/MoodVideoModal";
import { IMoodVideo } from "@/features/mood-video/types";
import { useSmartBack } from "@/hooks/useSmartBack";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";
import { Genrepageskeleton } from "@/features/genre";

const MoodVideoManagementPage = () => {
  // --- 1. STATE MANAGEMENT (URL & Query) ---
  const {
    filterParams,
    handleSearch,
    handleFilterChange,
    handlePageChange,
    clearFilters,
  } = useMoodVideoParams(APP_CONFIG.PAGINATION_LIMIT || 12);

  const { data, isLoading, refetch, isError } =
    useMoodVideosQuery(filterParams);
  const {
    createMoodVideo: createVideo,
    updateMoodVideoAsync,
    deleteMoodVideo,
    toggleActive,
    isMutating,
  } = useMoodVideoMutations();

  // --- 2. LOCAL UI STATE ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<IMoodVideo | null>(null);
  const [videoToDelete, setVideoToDelete] = useState<IMoodVideo | null>(null);

  // --- 3. HANDLERS ---
  const handleOpenCreate = () => {
    setEditingVideo(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (video: IMoodVideo) => {
    setEditingVideo(video);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    // Tìm video trong list để lấy title hiển thị lên modal confirm
    const video = data?.videos.find((v: IMoodVideo) => v._id === id);
    if (video) setVideoToDelete(video);
  };

  const handleConfirmDelete = () => {
    if (videoToDelete) {
      deleteMoodVideo(videoToDelete._id, {
        onSuccess: () => setVideoToDelete(null),
      });
    }
  };

  const handleFormSubmit = async (formData: FormData) => {
    try {
      if (editingVideo) {
        await updateMoodVideoAsync(editingVideo._id, formData);
      } else {
        await createVideo(formData);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Failed to save Mood Video", error);
    }
  };

  // Safe access data
  const videos = data?.videos || [];
  const meta = data?.meta || {
    totalPages: 1,
    totalItems: 0,
    page: 1,
    pageSize: 12,
  };
  const onBack = useSmartBack();
  const hasResults = videos.length > 0;

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
    <div className="space-y-8 pb-12">
      {/* --- HEADER --- */}
      <PageHeader
        title="Mood Library (Canvas)"
        subtitle={`Managing ${meta.totalItems} visual canvases for your tracks.`}
        action={
          <Button
            onClick={handleOpenCreate}
            className="shadow-md bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-6"
          >
            <Plus className="w-4 h-4 mr-2" /> Upload Canvas
          </Button>
        }
      />

      {/* --- FILTER --- */}
      <MoodVideoFilter
        params={filterParams}
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onReset={clearFilters}
      />

      {/* --- CONTENT GRID --- */}
      <div className="min-h-[400px]">
        <MoodVideoGrid
          videos={videos}
          isLoading={isLoading}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
          onToggleActive={toggleActive}
          onAddClick={handleOpenCreate}
        />
      </div>

      {/* --- PAGINATION --- */}
      {!isLoading && videos.length > 0 && (
        <div className="bg-card/50 backdrop-blur-sm border rounded-2xl p-4 shadow-raised">
          <Pagination
            currentPage={meta.page}
            totalPages={meta.totalPages}
            onPageChange={handlePageChange}
            totalItems={meta.totalItems}
            pageSize={meta.pageSize || APP_CONFIG.PAGINATION_LIMIT}
          />
        </div>
      )}

      {/* --- MODALS --- */}

      {/* 1. Create/Edit Modal */}
      {isModalOpen && (
        <MoodVideoModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          videoToEdit={editingVideo}
          onSubmit={handleFormSubmit}
          isPending={isMutating}
        />
      )}

      {/* 2. Delete Confirmation */}
      <ConfirmationModal
        isOpen={!!videoToDelete}
        onCancel={() => setVideoToDelete(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isMutating}
        title="Delete Mood Video?"
        description={
          <div className="space-y-3">
            <p>
              Are you sure you want to delete{" "}
              <strong className="text-foreground">
                {videoToDelete?.title}
              </strong>
              ?
            </p>
            <div className="bg-destructive/10 p-3 rounded-xl border border-destructive/20 text-destructive text-sm font-medium">
              <p className="flex items-center gap-2">
                <Video className="size-4" />
                This video is currently used by {videoToDelete?.usageCount ||
                  0}{" "}
                tracks.
              </p>
              <p className="mt-1 opacity-80">
                You must unassign this video from all tracks before it can be
                deleted.
              </p>
            </div>
          </div>
        }
        confirmLabel="Confirm Delete"
        isDestructive
      />
    </div>
  );
};

export default MoodVideoManagementPage;
