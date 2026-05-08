import { useMemo, useCallback, useEffect } from "react";
import { useQueryParams } from "@/hooks/useQueryParams";
import {
  ArtistAdminFilterParams,
  artistAdminParamsSchema,
} from "../schemas/artist.schema";
import { APP_CONFIG } from "@/config/constants";

const DEFAULT_PARAMS: ArtistAdminFilterParams = {
  page: 1,
  limit: APP_CONFIG.GRID_LIMIT,
  keyword: "",
  sort: "popular",
  nationality: undefined,
  isVerified: undefined,
  isActive: undefined,
  isDeleted: undefined,
};

export const useArtistParams = () => {
  // 1. Lấy raw params từ URL
  const { params: rawParams, setParams } = useQueryParams({
    ...DEFAULT_PARAMS,
  });

  // 2. Validate params with admin schema (includes isVerified, isActive)
  const filterParams = useMemo(() => {
    return artistAdminParamsSchema.parse(rawParams);
  }, [rawParams]);

  // 3. ĐỒNG BỘ URL (Self-healing): Nắn lại URL nếu user nhập bậy
  useEffect(() => {
    const isDirty = JSON.stringify(rawParams) !== JSON.stringify(filterParams);
    if (isDirty) {
      setParams({ ...filterParams }, { replace: true });
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
    <K extends keyof ArtistAdminFilterParams>(
      key: K,
      value: ArtistAdminFilterParams[K] | null | undefined,
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
