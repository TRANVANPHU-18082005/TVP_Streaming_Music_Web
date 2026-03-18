import React from "react";
import { Sparkles } from "lucide-react";
import { APP_CONFIG } from "@/config/constants";
import { toast } from "sonner"; // Hoặc thư viện toast bạn dùng
import { useQueryClient } from "@tanstack/react-query";

// Components
import PublicAlbumCard from "@/features/album/components/PublicAlbumCard";
import MusicResult from "@/components/ui/Result";
import Pagination from "@/utils/pagination";
import CardSkeleton from "@/components/ui/CardSkeleton";
import { PublicAlbumFilters } from "@/features/album/components/PublicAlbumFilters";

// Hooks & API
import { useAlbumParams } from "@/features/album/hooks/useAlbumParams";
import { useAlbumsQuery } from "@/features/album/hooks/useAlbumsQuery";
import albumApi from "@/features/album/api/albumApi";
import { albumKeys } from "@/features/album/utils/albumKeys";
import { useAppDispatch } from "@/store/hooks";
import { setIsPlaying, setQueue } from "@/features";

const AlbumPage = () => {
  const queryClient = useQueryClient();

  // --- 1. STATE QUẢN LÝ QUA URL ---
  const {
    filterParams,
    handleSearch,
    handleFilterChange,
    handlePageChange,
    clearFilters,
  } = useAlbumParams(24);

  // --- 2. DATA FETCHING ---
  const { data, isLoading, isError } = useAlbumsQuery(filterParams);
  const dispatch = useAppDispatch();
  const albums = data?.albums || [];
  const meta = data?.meta || {
    totalPages: 1,
    totalItems: 0,
    page: 1,
    pageSize: 24,
  };

  // 🔥 3. LOGIC PHÁT NHẠC (Truyền xuống Card)
  const handlePlayAlbum = async (albumId: string) => {
    try {
      // Gọi API lấy detail Album (Sử dụng Cache để tối ưu tốc độ)
      const res = await queryClient.fetchQuery({
        queryKey: albumKeys.detail(albumId),
        queryFn: () => albumApi.getById(albumId), // Hoặc getDetail tùy API của bạn
        staleTime: 1000 * 60 * 5, // Cache 5 phút
      });

      const tracks = res.data?.tracks; // Lấy mảng bài hát từ response

      // Chặn nếu Album không có nhạc
      if (!tracks || tracks.length === 0) {
        toast.error("Album này hiện chưa có bài hát nào!");
        return;
      }

      // Đưa vào Queue và Phát (Redux)
      dispatch(setQueue({ tracks, startIndex: 0 }));
      dispatch(setIsPlaying(true));

      // Giả lập độ trễ mạng để UI hiển thị vòng Loading
      await new Promise((resolve) => setTimeout(resolve, 600));

      toast.success(`Đang phát ${tracks.length} bài hát từ Album.`);
    } catch (error) {
      toast.error("Không thể lấy dữ liệu nhạc. Vui lòng thử lại.");
      throw error; // Rất quan trọng: Ném lỗi ra để PublicAlbumCard bắt và tắt nút Loading
    }
  };

  // --- 4. ERROR STATE ---
  if (isError) {
    return (
      <div className="container mx-auto px-4 sm:px-6 pt-12 pb-8">
        <div className="min-h-[70vh] flex items-center justify-center ">
          <MusicResult
            status="error"
            title="Không thể tải danh sách Album"
            description="Đã có lỗi xảy ra từ máy chủ. Vui lòng kiểm tra đường truyền và thử lại."
            secondaryAction={{
              label: "Tải lại trang",
              onClick: () => window.location.reload(),
            }}
          />
        </div>
      </div>
    );
  }

  // --- 5. RENDER UI ---
  return (
    <div className="relative min-h-screen pb-24">
      {/* BACKGROUND GRADIENT */}
      <div className="absolute top-0 left-0 right-0 h-[40vh] bg-gradient-to-b from-primary/10 via-background/80 to-background pointer-events-none -z-10" />

      {/* HERO HEADER */}
      <header className="container mx-auto px-4 sm:px-6 pt-12 pb-8">
        <div className="flex flex-col gap-3 max-w-2xl animate-in slide-in-from-bottom-4 fade-in duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary w-fit text-xs font-bold uppercase tracking-widest mb-2">
            <Sparkles className="size-3.5" />
            <span>Khám phá</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-foreground">
            Tuyển tập Đĩa nhạc
          </h1>
          <p className="text-base md:text-lg text-muted-foreground font-medium">
            Lắng nghe những album, đĩa đơn và EP hot nhất đang làm mưa làm gió
            trên bảng xếp hạng.
          </p>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="container mx-auto px-4 sm:px-6 space-y-8">
        {/* STICKY FILTERS */}
        <div className="sticky top-16 z-30 bg-background/80 backdrop-blur-xl border-b border-border/40 transition-all">
          <PublicAlbumFilters
            params={filterParams}
            onSearch={handleSearch}
            onFilterChange={handleFilterChange}
            onReset={clearFilters}
          />
        </div>

        {/* ALBUM GRID */}
        <div className="min-h-[50vh]">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10">
              <CardSkeleton
                count={meta.pageSize || APP_CONFIG.PAGINATION_LIMIT}
              />
            </div>
          ) : albums.length === 0 ? (
            <div className="flex flex-col items-center justify-center bg-card rounded-3xl border border-dashed border-border shadow-sm animate-in fade-in duration-500">
              <MusicResult
                status="empty"
                title="Không tìm thấy album nào"
                description={
                  filterParams.keyword
                    ? `Không có kết quả nào phù hợp với tìm kiếm "${filterParams.keyword}".`
                    : "Hiện tại hệ thống chưa có đĩa nhạc nào thỏa mãn điều kiện này."
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10">
              {albums.map((album, index) => (
                <div
                  key={album._id}
                  style={{ animationDelay: `${index * 50}ms` }}
                  className="animate-in zoom-in-95 fade-in duration-500 fill-mode-both"
                >
                  <PublicAlbumCard
                    album={album}
                    onPlay={() => handlePlayAlbum(album._id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PAGINATION */}
        {!isLoading && albums.length > 0 && (
          <div className="pt-6">
            <Pagination
              currentPage={meta.page}
              totalPages={meta.totalPages}
              onPageChange={handlePageChange}
              totalItems={meta.totalItems}
              itemsPerPage={meta.pageSize || APP_CONFIG.PAGINATION_LIMIT}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default AlbumPage;
