import { useMemo, useCallback, useEffect } from "react";
import { useQueryParams } from "@/hooks/useQueryParams";

export type RoomFilterParams = {
  page: number;
  limit: number;
  q?: string;
};

const DEFAULT_ROOM_PARAMS: RoomFilterParams = {
  page: 1,
  limit: 20,
  q: undefined,
};

export const useRoomParams = () => {
  // 1. Lấy dữ liệu thô từ URL
  const { params: rawParams, setParams } = useQueryParams<RoomFilterParams>({
    ...DEFAULT_ROOM_PARAMS,
  });

  // 2. Chuyển đổi kiểu dữ liệu cho chuẩn
  const filterParams = useMemo(() => ({
    page: Number(rawParams.page) || 1,
    limit: Number(rawParams.limit) || 20,
    q: rawParams.q || undefined,
  }), [rawParams]);

  useEffect(() => {
    const isDirty = JSON.stringify(rawParams) !== JSON.stringify(filterParams);
    if (isDirty) {
      setParams(filterParams, { replace: true });
    }
  }, [rawParams, filterParams, setParams]);

  // 3. Handlers
  const handlePageChange = useCallback(
    (page: number) => setParams({ page }),
    [setParams],
  );

  const handleSearch = useCallback(
    (keyword: string) => {
      const trimmed = keyword.trim();
      setParams({
        q: trimmed === "" ? undefined : trimmed,
        page: 1,
      });
    },
    [setParams],
  );

  const handleLimitChange = useCallback(
    (limit: number) => {
      setParams({ limit, page: 1 });
    },
    [setParams],
  );

  const clearFilters = useCallback(() => {
    setParams({ ...DEFAULT_ROOM_PARAMS });
  }, [setParams]);

  return {
    filterParams,
    setFilterParams: setParams,
    handlePageChange,
    handleSearch,
    handleLimitChange,
    clearFilters,
  };
};
