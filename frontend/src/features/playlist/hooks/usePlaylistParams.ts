import { useMemo, useCallback, useEffect } from "react";
import { useQueryParams } from "@/hooks/useQueryParams";
import {
  playlistParamsSchema,
  type PlaylistFilterParams,
} from "../schemas/playlist.schema";

// Default Values - Dùng làm mốc để Reset
const DEFAULT_PLAYLIST_PARAMS: PlaylistFilterParams = {
  page: 1,
  limit: 12,
  keyword: undefined,
  sort: "newest",
  type: undefined,
  visibility: undefined,
  isSystem: undefined,
};

export const usePlaylistParams = (initialLimit = 12) => {
  // 1. Lấy dữ liệu thô (raw) từ URL thông qua Generic Hook
  const { params: rawParams, setParams } = useQueryParams({
    ...DEFAULT_PLAYLIST_PARAMS,
    limit: initialLimit,
  });

  // 2. MÀNG LỌC ZOD (Data sạch):
  // Biến "true"/"false" thành boolean thực, "abc" thành undefined...
  const filterParams = useMemo(() => {
    // .parse() kết hợp với .catch() trong schema sẽ trả về data an toàn nhất
    return playlistParamsSchema.parse(rawParams);
  }, [rawParams]);

  // 3. ĐỒNG BỘ URL (Self-healing):
  // Nếu User gõ bậy trên URL, Zod parse ra data sạch, ta ghi đè lại URL bằng data sạch đó.
  useEffect(() => {
    const isDirty = JSON.stringify(rawParams) !== JSON.stringify(filterParams);

    if (isDirty) {
      // Dùng { replace: true } để không tạo thêm lịch sử (Nút Back không bị kẹt)
      setParams(filterParams, { replace: true });
    }
  }, [rawParams, filterParams, setParams]);

  // 4. HANDLERS (Giao diện gọi các hàm này)

  // Chuyển trang
  const handlePageChange = useCallback(
    (page: number) => {
      setParams({ page });
    },
    [setParams],
  );

  // Tìm kiếm (Keyword)
  const handleSearch = useCallback(
    (keyword: string) => {
      const trimmed = keyword.trim();
      // Nếu rỗng thì set undefined để useQueryParams tự động xóa key khỏi URL
      setParams({
        keyword: trimmed === "" ? undefined : trimmed,
        page: 1,
      });
    },
    [setParams],
  );

  // Thay đổi Filter chung (Type, Sort, Visibility...)
  const handleFilterChange = useCallback(
    <K extends keyof PlaylistFilterParams>(
      key: K,
      value: PlaylistFilterParams[K] | null | undefined,
    ) => {
      // Chuẩn hóa giá trị rỗng thành undefined để URL "đẹp" hơn
      const cleanValue = value === "" ? undefined : value;
      setParams({ [key]: cleanValue, page: 1 });
    },
    [setParams],
  );

  // Xóa toàn bộ bộ lọc
  const clearFilters = useCallback(() => {
    setParams({
      ...DEFAULT_PLAYLIST_PARAMS,
      limit: initialLimit,
    });
  }, [setParams, initialLimit]);

  return {
    filterParams,
    setFilterParams: setParams, // Expose để dùng cho các trường hợp đặc biệt
    handlePageChange,
    handleSearch,
    handleFilterChange,
    clearFilters,
  };
};
