import { useState } from "react";
import { Plus } from "lucide-react";

// UI Components
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/ui/PageHeader";
import Pagination from "@/utils/pagination";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import MusicResult from "@/components/ui/Result";
import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TableHead,
} from "@/components/ui/table";
import TableSkeleton from "@/components/ui/TableSkeleton";

// Feature Components
import { TrackFilters } from "@/features/track/components/TrackFilters";
import { TrackTable } from "@/features/track/components/TrackTable";
import TrackModal from "@/features/track/components/TrackModal";
import { BulkActionBar } from "@/features/track/components/BulkActionBar";
import { BulkEditModal } from "@/features/track/components/BulkEditModal";

// 🔥 NEW HOOKS
import { useTrackParams } from "@/features/track/hooks/useTrackParams";
import { useTrackMutations } from "@/features/track/hooks/useTrackMutations";

// Types & Config
import { BulkTrackFormValues } from "@/features/track/schemas/track.schema";
import { APP_CONFIG } from "@/config/constants";
import { ITrack } from "@/features/track/types";
import { useAdminTracks } from "@/features/track/hooks/useTracksQuery";

import { useSmartBack } from "@/hooks/useSmartBack";
import { Genrepageskeleton } from "@/features";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";

const TrackManagementPage = () => {
  // --- 1. STATE MANAGEMENT (URL) ---
  const {
    filterParams,
    handleSearch,
    handleFilterChange,
    handlePageChange,
    clearFilters, // Added clear filters handler
  } = useTrackParams(APP_CONFIG.PAGINATION_LIMIT);

  // --- 2. DATA FETCHING (Read) ---
  const { data, isLoading, isError, refetch } = useAdminTracks(filterParams);
  console.log(data);
  // --- 3. MUTATIONS (Write) ---
  const {
    createTrackAsync,
    updateTrackAsync,
    deleteTrack,
    retryFull,
    retryTranscode,
    retryLyrics,
    retryKaraoke,
    retryMood,
    bulkUpdateTrack,
    isMutating,
  } = useTrackMutations();

  // --- 4. LOCAL UI STATE ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [trackToEdit, setTrackToEdit] = useState<ITrack | null>(null);
  const [trackToDelete, setTrackToDelete] = useState<ITrack | null>(null);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState<"metadata" | "album" | null>(null);

  // --- HANDLERS ---

  // Selection Logic
  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id),
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && data?.tracks) {
      setSelectedIds(data.tracks.map((t) => t._id));
    } else {
      setSelectedIds([]);
    }
  };

  // Modal Handlers
  const handleOpenCreate = () => {
    setTrackToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (track: ITrack) => {
    setTrackToEdit(track);
    setIsModalOpen(true);
  };

  // 🔥 CORE LOGIC: Submit Form (Receives FormData from Modal Hook)
  const handleSubmitForm = async (formData: FormData) => {
    try {
      if (trackToEdit) {
        await updateTrackAsync(trackToEdit._id, formData);
      } else {
        await createTrackAsync(formData);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Failed to save track", error);
      // Keep modal open on error for user to fix
    }
  };

  const handleBulkSubmit = (data: BulkTrackFormValues) => {
    // Clean undefined values
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined),
    ) as BulkTrackFormValues;

    if (Object.keys(cleanData).length === 0) return;

    bulkUpdateTrack(
      { ids: selectedIds, data: cleanData },
      {
        onSuccess: () => {
          setBulkMode(null);
          setSelectedIds([]);
        },
      },
    );
  };

  // Safe Access Data
  const tracks = data?.tracks || [];
  const meta = data?.meta || {
    totalPages: 1,
    totalItems: 0,
    page: 1,
    pageSize: APP_CONFIG.PAGINATION_LIMIT,
  };
  const onBack = useSmartBack();
  const hasResults = tracks.length > 0;
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
    <div className="space-y-8 pb-32">
      {/* HEADER */}
      <PageHeader
        title="Tracks Management"
        subtitle={`Library contains ${meta.totalItems} tracks.`}
        action={
          <Button
            onClick={handleOpenCreate}
            className="shadow-md bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-6"
          >
            <Plus className="size-4 mr-2" /> Upload Track
          </Button>
        }
      />
      <div className="bg-card rounded-2xl shadow-sm">
        {/* FILTERS */}
        <TrackFilters
          params={filterParams}
          onSearch={handleSearch}
          onFilterChange={handleFilterChange}
          onReset={clearFilters}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[50px]"></TableHead>
                <TableHead className="w-[300px]">Track Info</TableHead>
                <TableHead>Album</TableHead>
                <TableHead>Genre</TableHead>
                <TableHead>Stats</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableSkeleton
                rows={meta.pageSize || APP_CONFIG.PAGINATION_LIMIT}
                cols={7}
                hasAvatar={true}
              />
            </TableBody>
          </Table>
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
          <TrackTable
            tracks={tracks}
            isLoading={isLoading}
            onEdit={handleOpenEdit}
            onDelete={setTrackToDelete}
            retryFull={retryFull}
            retryTranscode={retryTranscode}
            retryLyrics={retryLyrics}
            retryKaraoke={retryKaraoke}
            retryMood={retryMood}
            startIndex={
              (meta.page - 1) * (meta.pageSize ?? APP_CONFIG.PAGINATION_LIMIT)
            }
            selectedIds={selectedIds}
            onSelectOne={handleSelectOne}
            onSelectAll={handleSelectAll}
          />
        )}
      </div>

      {!isLoading && tracks.length > 0 && (
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
      {/* --- Action Bar & Modals --- */}

      {/* 1. Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.length}
        onClear={() => setSelectedIds([])}
        onEditAlbum={() => setBulkMode("album")}
        onEditMetadata={() => setBulkMode("metadata")}
        onDelete={() => {
          if (
            confirm(
              `Are you sure you want to delete ${selectedIds.length} tracks?`,
            )
          ) {
            // Implement bulk delete if API supports it
            alert("Bulk delete functionality coming soon!");
          }
        }}
      />

      {/* 2. Create/Edit Modal */}
      {isModalOpen && (
        <TrackModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          trackToEdit={trackToEdit}
          onSubmit={handleSubmitForm} // 🔥 Now accepts FormData
          isPending={isMutating}
        />
      )}

      {/* 3. Bulk Edit Modal */}
      {bulkMode && (
        <BulkEditModal
          isOpen={!!bulkMode}
          onClose={() => setBulkMode(null)}
          selectedCount={selectedIds.length}
          initialTab={bulkMode}
          onSubmit={handleBulkSubmit}
          isPending={isMutating}
        />
      )}

      {/* 4. Delete Confirmation */}
      <ConfirmationModal
        isOpen={!!trackToDelete}
        onCancel={() => setTrackToDelete(null)}
        onConfirm={() => {
          if (trackToDelete)
            deleteTrack(trackToDelete._id, {
              onSuccess: () => setTrackToDelete(null),
            });
        }}
        title="Delete Track?"
        isLoading={isMutating}
        description={
          <div>
            <p className="text-sm text-foreground/80 mb-2">
              Are you sure you want to permanently delete{" "}
              <strong className="text-foreground">
                {trackToDelete?.title}
              </strong>
              ?
            </p>
            <div className="bg-destructive/10 p-3 rounded-lg border border-destructive/20 flex items-start gap-3">
              <span className="text-lg">⚠️</span>
              <span className="text-destructive font-bold text-xs mt-0.5">
                Warning: This action will permanently remove the audio file and
                metadata. This cannot be undone.
              </span>
            </div>
          </div>
        }
        confirmLabel="Yes, Delete"
        isDestructive
      />
    </div>
  );
};

export default TrackManagementPage;
