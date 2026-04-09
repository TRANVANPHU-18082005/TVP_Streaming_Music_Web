// features/genre/hooks/useGenreParams.ts
import { useMemo, useCallback, useEffect } from "react";
import { useQueryParams } from "@/hooks/useQueryParams";
import {
  genreParamsSchema,
  type GenreFilterParams,
} from "../schemas/genre.schema";

const DEFAULT_PARAMS: GenreFilterParams = {
  page: 1,
  limit: 20,
  keyword: undefined,
  sort: "name",
  parentId: undefined,
  isTrending: undefined,
  status: undefined,
};

export const useGenreParams = (initialLimit = 20) => {
  // 1. Lấy dữ liệu thô từ URL
  const { params: rawParams, setParams } = useQueryParams({
    ...DEFAULT_PARAMS,
    limit: initialLimit,
  });

  // 2. Màng lọc Zod: Đảm bảo dữ liệu sạch và đúng kiểu dữ liệu
  const filterParams = useMemo(() => {
    return genreParamsSchema.parse(rawParams);
  }, [rawParams]);

  // 3. ĐỒNG BỘ URL (Self-healing): Sửa lại URL nếu user nhập sai format
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
    <K extends keyof GenreFilterParams>(
      key: K,
      value: GenreFilterParams[K] | null | undefined,
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
