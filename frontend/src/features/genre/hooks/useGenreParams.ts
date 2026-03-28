import { useMemo, useCallback } from "react";
import { useQueryParams } from "@/hooks/useQueryParams";
import { GenreFilterParams } from "../types";

const DEFAULT_PARAMS: GenreFilterParams = {
  page: 1,
  limit: 20, // Genre thường hiển thị nhiều hơn
  keyword: "",
  sort: "name", // Mặc định sort theo tên
  parentId: undefined,
  isTrending: undefined,
  status: undefined, // Mặc định chỉ lấy thể loại active
};

export const useGenreParams = (initialLimit = 20) => {
  const { params: rawParams, setParams } = useQueryParams({
    ...DEFAULT_PARAMS,
    limit: initialLimit,
  });

  const filterParams = useMemo(
    (): GenreFilterParams => ({ ...rawParams }),
    [rawParams],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setParams({ page });
    },
    [setParams],
  );

  const handleSearch = useCallback(
    (keyword: string) => {
      setParams({ keyword, page: 1 });
    },
    [setParams],
  );

  const handleFilterChange = useCallback(
    <K extends keyof GenreFilterParams>(
      key: K,
      value: GenreFilterParams[K] | null,
    ) => {
      setParams({ [key]: value, page: 1 });
    },
    [setParams],
  );

  const clearFilters = useCallback(() => {
    setParams({ ...DEFAULT_PARAMS, limit: filterParams.limit });
  }, [setParams, filterParams.limit]);

  return {
    filterParams,
    handlePageChange,
    handleSearch,
    handleFilterChange,
    clearFilters,
  };
};
