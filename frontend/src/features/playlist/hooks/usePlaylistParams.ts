import { useMemo, useCallback } from "react";
import { useQueryParams } from "@/hooks/useQueryParams"; // Generic Hook
import { PlaylistFilterParams } from "../types";

// Default Values
const DEFAULT_PLAYLIST_PARAMS: PlaylistFilterParams = {
  page: 1,
  limit: 12,
  keyword: "",
  sort: "newest",
  isSystem: undefined,
  visibility: undefined, // Thêm visibility nếu chưa có
};

export const usePlaylistParams = (initialLimit = 12) => {
  // 1. Gọi Generic Hook
  const { params: rawParams, setParams } = useQueryParams({
    ...DEFAULT_PLAYLIST_PARAMS,
    limit: initialLimit,
  });

  // 2. Parse & Validate
  const filterParams = useMemo((): PlaylistFilterParams => {
    return {
      ...rawParams,
      // Parse boolean cho isSystem (vì URL params thường là string "true"/"false")
      isSystem:
        rawParams.isSystem === true
          ? true
          : rawParams.isSystem === false
            ? false
            : undefined,
    };
  }, [rawParams]);

  // 3. Handlers

  // Chuyển trang
  const handlePageChange = useCallback(
    (page: number) => {
      setParams({ page });
    },
    [setParams],
  );

  // Tìm kiếm
  const handleSearch = useCallback(
    (keyword: string) => {
      setParams({ keyword, page: 1 });
    },
    [setParams],
  );

  // 🔥 FIX: Generic Filter Change (Dùng cho Sort, Source, Visibility...)
  // Thay thế cho handleTypeChange cụ thể trước đây
  const handleFilterChange = useCallback(
    <K extends keyof PlaylistFilterParams>(
      key: K,
      value: PlaylistFilterParams[K] | null,
    ) => {
      setParams({ [key]: value, page: 1 });
    },
    [setParams],
  );

  // 🔥 FIX: Reset Filters
  const clearFilters = useCallback(() => {
    setParams({
      ...DEFAULT_PLAYLIST_PARAMS,
      limit: filterParams.limit, // Giữ nguyên limit hiện tại
    });
  }, [setParams, filterParams.limit]);

  return {
    filterParams,
    // Không cần expose setFilterParams thô nữa nếu không cần thiết
    handlePageChange,
    handleSearch,
    handleFilterChange,
    clearFilters,
  };
};
