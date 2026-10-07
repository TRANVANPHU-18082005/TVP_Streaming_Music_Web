// pages/client/MusicRoomsPage.tsx
import { QueryErrorResult } from "@/components/ui/QueryState";
/**
 * Trang khám phá phòng nhạc.
 * Tuân theo design system index.css (dark/light mode, glass, tokens).
 */

import React, { useEffect, useState, useCallback } from "react";
import { Plus, Radio, RefreshCw, Music2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import RoomCard from "@/features/music-room/components/RoomCard";
import CreateRoomModal from "@/features/music-room/components/CreateRoomModal";
import RoomFilter from "@/features/music-room/components/RoomFilter";
import { useMyRoomQuery, usePublicRoomsQuery } from "@/features/music-room/hooks/useRoomsQuery";
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

  const { data, isLoading, isError, error, refetch } = usePublicRoomsQuery(
    filterParams.page,
    filterParams.limit,
    filterParams.q
  );

  const rooms = data?.rooms || [];
  const meta = data?.meta || { total: 0, page: 1, totalPages: 1 };
  const hasResults = rooms.length > 0;
  const isFiltering = Boolean(filterParams.q);

  const currentUser = useAppSelector((state) => state.auth.user);
  const { data: myRoom } = useMyRoomQuery(Boolean(currentUser));
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");

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
  }, [currentUser, myRoom, navigate]);

  const joinByCode = () => {
    const code = joinCode.trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
      toast.error("Mã phòng gồm 6 ký tự");
      return;
    }
    navigate(`/rooms/${code}`);
  };

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

        <div className="section-container relative py-10 md:py-12">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SP}
            >
              <div className="mb-3 inline-flex items-center gap-2">
                <span className="badge badge-playing">
                  <Radio className="size-3" />
                  Phòng nhạc
                </span>
              </div>
              <h1 className="text-display-xl text-foreground">
                Cùng nghe nhạc
                <br />
                <span className="text-gradient-brand">với mọi người</span>
              </h1>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Vào phòng, bình chọn bài và nghe cùng nhau theo thời gian thực.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SP, delay: 0.08 }}
              className="flex w-full max-w-md flex-col gap-2 sm:flex-row sm:items-center"
            >
              <form
                className="flex min-w-0 flex-1 gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  joinByCode();
                }}
              >
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="Mã phòng"
                  maxLength={6}
                  aria-label="Mã phòng"
                  className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm tracking-[0.2em] outline-none"
                />
                <button type="submit" className="pressable shrink-0 rounded-xl bg-secondary px-4 text-sm font-semibold text-secondary-foreground">
                  Vào
                </button>
              </form>
              <button
                id="create-room-btn"
                onClick={handleOpenCreateModal}
                className="pressable flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand"
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
        {myRoom && (
          <button
            type="button"
            onClick={() => navigate(`/rooms/${myRoom.roomCode}`)}
            className="flex w-full items-center justify-between rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-left"
          >
            <span>
              <span className="block text-sm font-semibold">Phòng của bạn đang mở</span>
              <span className="text-xs text-muted-foreground">
                {myRoom.name}
                {myRoom.currentTrack ? ` · ${myRoom.currentTrack.title}` : ""} · {myRoom.memberCount} người
              </span>
            </span>
            <span className="text-sm font-semibold text-primary">Vào phòng</span>
          </button>
        )}

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

          ) : isError && rooms.length === 0 ? (
            /* Error state */
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-12"
            >
              <QueryErrorResult error={error} onRetry={() => void refetch()} size="lg" />
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
                    {meta.total} phòng đang hoạt động
                  </span>
                  <span className="badge badge-live text-[10px]">Trực tiếp</span>
                </div>
                <button
                  id="refresh-rooms-btn"
                  type="button"
                  onClick={() => refetch()}
                  disabled={isLoading}
                  className="pressable flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                >
                  <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
                  Làm mới
                </button>
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
