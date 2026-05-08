// features/genre/hooks/useGenreParams.ts
import { useMemo, useCallback, useEffect } from "react";
import { useQueryParams } from "@/hooks/useQueryParams";
import {
  GenreAdminFilterParams,
  genreAdminParamsSchema,
} from "../schemas/genre.schema";
import { APP_CONFIG } from "@/config/constants";

const DEFAULT_PARAMS: GenreAdminFilterParams = {
  page: 1,
  limit: APP_CONFIG.GRID_LIMIT,
  keyword: "",
  sort: "popular",
  parentId: undefined,
  isTrending: undefined,
  isActive: undefined,
  isDeleted: undefined,
};

export const useGenreParams = () => {
  // 1. Lấy dữ liệu thô từ URL

  const { params: rawParams, setParams } =
    useQueryParams<GenreAdminFilterParams>({
      ...DEFAULT_PARAMS,
    });

  // 2. Màng lọc Zod: Đảm bảo dữ liệu sạch và đúng kiểu dữ liệu
  const filterParams = useMemo(() => {
    return genreAdminParamsSchema.parse(rawParams);
  }, [rawParams]);
  console.log(DEFAULT_PARAMS, rawParams, filterParams);
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
    <K extends keyof GenreAdminFilterParams>(
      key: K,
      value: GenreAdminFilterParams[K] | null | undefined,
    ) => {
      const cleanValue = value === "" ? undefined : value;
      setParams({ [key]: cleanValue, page: 1 });
    },
    [setParams],
  );

  const clearFilters = useCallback(() => {
    setParams({ ...DEFAULT_PARAMS });
  }, [setParams]);

  return {
    filterParams,
    setFilterParams: setParams,
    handlePageChange,
    handleSearch,
    handleFilterChange,
    clearFilters,
  };
};
