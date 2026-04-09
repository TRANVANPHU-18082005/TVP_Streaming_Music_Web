import { useMemo, useCallback, useEffect } from "react";
import { useQueryParams } from "@/hooks/useQueryParams";
import {
  artistParamsSchema,
  type ArtistFilterParams,
} from "../schemas/artist.schema";

const DEFAULT_PARAMS: ArtistFilterParams = {
  page: 1,
  limit: 10,
  keyword: undefined,
  sort: "newest",
  nationality: undefined,
  isVerified: undefined,
  isActive: undefined,
  genreId: undefined,
};

export const useArtistParams = (initialLimit = 10) => {
  // 1. Lấy raw params từ URL
  const { params: rawParams, setParams } = useQueryParams({
    ...DEFAULT_PARAMS,
    limit: initialLimit,
  });

  // 2. Màng lọc Zod: Tự động biến "true" -> true, ép kiểu số, fallback khi lỗi
  const filterParams = useMemo(() => {
    return artistParamsSchema.parse(rawParams);
  }, [rawParams]);

  // 3. ĐỒNG BỘ URL (Self-healing): Nắn lại URL nếu user nhập bậy
  useEffect(() => {
    const isDirty = JSON.stringify(rawParams) !== JSON.stringify(filterParams);
    if (isDirty) {
      setParams(filterParams, { replace: true });
    }
  }, [rawParams, filterParams, setParams]);

  // 4. Handlers
  const handlePageChange = useCallback(
    (page: number) => setParams({ page }),
    [setParams],
  );

  const handleSearch = useCallback(
    (keyword: string) => {
      const trimmed = keyword.trim();
      setParams({
        keyword: trimmed === "" ? undefined : trimmed,
        page: 1,
      });
    },
    [setParams],
  );

  const handleFilterChange = useCallback(
    <K extends keyof ArtistFilterParams>(
      key: K,
      value: ArtistFilterParams[K] | null | undefined,
    ) => {
      const cleanValue = value === "" ? undefined : value;
      setParams({ [key]: cleanValue, page: 1 });
    },
    [setParams],
  );

  const clearFilters = useCallback(() => {
    setParams({ ...DEFAULT_PARAMS, limit: initialLimit });
  }, [setParams, initialLimit]);

  return {
    filterParams,
    setFilterParams: setParams,
    handlePageChange,
    handleSearch,
    handleFilterChange,
    clearFilters,
  };
};
