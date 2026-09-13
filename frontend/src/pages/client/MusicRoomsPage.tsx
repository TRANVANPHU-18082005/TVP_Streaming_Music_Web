// pages/client/MusicRoomsPage.tsx
/**
 * Trang khám phá phòng nhạc.
 * Tuân theo design system index.css (dark/light mode, glass, tokens).
 */

import React, { useEffect, useState, useCallback } from "react";
import { Plus, Radio, RefreshCw, Users, Lock, Music2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import RoomCard from "@/features/music-room/components/RoomCard";
import CreateRoomModal from "@/features/music-room/components/CreateRoomModal";
import RoomFilter from "@/features/music-room/components/RoomFilter";
import { usePublicRoomsQuery } from "@/features/music-room/hooks/useRoomsQuery";
import { useRoomMutations } from "@/features/music-room/hooks/useRoomMutations";
import { useRoomParams } from "@/features/music-room/hooks/useRoomParams";
import type { CreateRoomPayload } from "@/features/music-room/api/room.api";
import PaginationStrip from "@/utils/pagination";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "@/store/hooks";



const SP = { type: "spring", stiffness: 340, damping: 28 } as const;

const MusicRoomsPage = () => {
  const navigate = useNavigate();
  
  const { filterParams, handleSearch, handlePageChange, clearFilters } = useRoomParams();
  
  const { data, isLoading, refetch } = usePublicRoomsQuery(
    filterParams.page,
    filterParams.limit,
    filterParams.q
  );
  
  const rooms = data?.rooms || [];
  const meta = data?.meta || { total: 0, page: 1, totalPages: 1 };
  const hasResults = rooms.length > 0;
  const isFiltering = Boolean(filterParams.q);

  const currentUser = useAppSelector((state) => state.auth.user);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { createRoomAsync, isCreating } = useRoomMutations();

  useEffect(() => {
    const interval = setInterval(refetch, 30_000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Kiểm tra trước khi mở modal tạo phòng
  const handleOpenCreateModal = useCallback(() => {
    if (!currentUser) {
      toast.error("Vui lòng đăng nhập để tạo phòng");
      navigate("/login?next=/rooms");
      return;
    }
    // Kiểm tra xem user đã có phòng active trong danh sách public rooms
    const currentUserId = currentUser._id || currentUser.id;
    const myRoom = rooms.find(
      (r) => r.host && (r.host as any)._id?.toString() === currentUserId?.toString(),
    );
    if (myRoom) {
      toast("Bạn đang có phòng đang hoạt động!", {
        description: `Phòng "${myRoom.name}" — ${myRoom.memberCount} người đang nghe`,
        action: {
          label: "Vào phòng",
          onClick: () => navigate(`/rooms/${myRoom.roomCode}`),
        },
        duration: 6000,
      });
      return;
    }
    setShowCreateModal(true);
  }, [currentUser, rooms, navigate]);

  const handleCreateRoom = async (payload: CreateRoomPayload) => {
    try {
      const room = await createRoomAsync(payload);
      setShowCreateModal(false);
      navigate(`/rooms/${room.roomCode}`);
    } catch (err: any) {
      const errData = err?.response?.data;
      // Xử lý lỗi 409: user đã có phòng (backend validate)
      if (errData?.errorCode === "ROOM_ALREADY_EXISTS" && errData?.data?.roomCode) {
        setShowCreateModal(false);
        toast("Bạn đang có phòng đang hoạt động!", {
          description: errData.message,
          action: {
            label: "Vào phòng cũ",
            onClick: () => navigate(`/rooms/${errData.data.roomCode}`),
          },
          duration: 8000,
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-mesh-deep">
        {/* Ambient orbs — skin-aware */}
        <div
          className="pointer-events-none absolute -top-24 left-1/4 h-96 w-96 rounded-full opacity-20 blur-[120px]"
          style={{ background: "hsl(var(--brand-400))" }}
        />
        <div
          className="pointer-events-none absolute top-10 right-1/5 h-64 w-64 rounded-full opacity-10 blur-[90px]"
          style={{ background: "hsl(var(--wave-2))" }}
        />

        <div className="section-container relative py-16 md:py-20">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">

            {/* Left: Copy */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SP}
            >
              {/* Eyebrow badge */}
              <div className="mb-4 inline-flex items-center gap-2">
                <span className="badge badge-playing">
                  <Radio className="size-3" />
                  Music Rooms
                </span>
              </div>

              <h1 className="text-display-xl text-foreground">
                Cùng nghe nhạc
                <br />
                <span className="text-gradient-brand">với mọi người</span>
              </h1>

              <p className="mt-3 max-w-md text-base text-muted-foreground">
                Tham gia phòng nhạc, bình chọn bài hát và trải nghiệm âm nhạc
                cùng cộng đồng theo thời gian thực.
              </p>

              {/* Stats row */}
              <div className="mt-5 flex items-center gap-5">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="size-3.5 text-primary" />
                  <span>
                    <strong className="text-foreground">{rooms.reduce((acc, r) => acc + r.memberCount, 0)}</strong> đang online
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Music2 className="size-3.5 text-primary" />
                  <span>
                    <strong className="text-foreground">{rooms.length}</strong> phòng hoạt động
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Right: Actions */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SP, delay: 0.08 }}
              className="flex shrink-0 items-center gap-3"
            >
              <button
                id="refresh-rooms-btn"
                onClick={() => refetch()}
                disabled={isLoading}
                className="control-btn--primary flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand transition-all hover:scale-105 active:scale-95 bg-primary"

                title="Làm mới"
              >
                <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
              </button>

              <button
                id="create-room-btn"
                onClick={handleOpenCreateModal}
                className="control-btn--primary flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand transition-all hover:scale-105 active:scale-95 bg-primary"
              >
                <Plus className="size-4" />
                Tạo phòng
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="section-container space-y-6 py-10 pb-24">
        {/* Room Filter */}
        <div
          className="animate-fade-up animation-fill-both"
          style={{ animationDelay: "80ms" }}
        >
          <RoomFilter
            params={filterParams}
            onSearch={handleSearch}
            onReset={clearFilters}
          />
        </div>

        <AnimatePresence mode="wait">
          {isLoading && rooms.length === 0 ? (
            /* Skeleton loading */
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton h-48 rounded-2xl" />
              ))}
            </motion.div>

          ) : rooms.length === 0 ? (
            /* Empty state */
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={SP}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <div className="glass-frosted mb-6 flex size-24 items-center justify-center rounded-3xl shadow-elevated">
                <Music2 className="size-10 text-muted-foreground/50" />
              </div>
              <h2 className="text-section-title text-foreground">
                {isFiltering ? "Không tìm thấy phòng nào" : "Chưa có phòng nào"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {isFiltering
                  ? "Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc."
                  : "Hãy là người đầu tiên tạo phòng nhạc!"}
              </p>
              {isFiltering ? (
                <button
                  onClick={clearFilters}
                  className="pressable mt-6 flex items-center gap-2 rounded-full bg-secondary px-6 py-2.5 text-sm font-semibold text-secondary-foreground"
                >
                  Xóa bộ lọc
                </button>
              ) : (
                <button
                  onClick={handleOpenCreateModal}
                  className="pressable mt-6 flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand"
                >
                  <Plus className="size-4" />
                  Tạo phòng đầu tiên
                </button>
              )}
            </motion.div>

          ) : (
            /* Rooms grid */
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Section header */}
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-overline text-muted-foreground">
                    {rooms.length} phòng đang hoạt động
                  </span>
                  <span className="badge badge-live text-[10px]">LIVE</span>
                </div>
                {isLoading && (
                  <div className="spinner spinner-xs" />
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rooms.map((room, i) => (
                  <motion.div
                    key={room.roomCode}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SP, delay: i * 0.04 }}
                  >
                    <RoomCard room={room} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Pagination */}
        {!isLoading && hasResults && (
          <div className="mt-8 flex justify-center">
            <PaginationStrip
              currentPage={meta.page}
              totalPages={meta.totalPages}
              totalItems={meta.total}
              pageSize={filterParams.limit}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateRoomModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateRoom}
          isLoading={isCreating}
        />
      )}
    </div>
  );
};

export default MusicRoomsPage;
