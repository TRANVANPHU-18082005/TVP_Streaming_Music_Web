import { useMemo, useCallback } from "react";
import { useQueryParams } from "@/hooks/useQueryParams";
import { ArtistFilterParams } from "../types";

// Default Values
const DEFAULT_PARAMS: ArtistFilterParams = {
  page: 1,
  limit: 10,
  keyword: "",
  sort: "newest",
  nationality: undefined,
  isVerified: undefined,
  isActive: undefined,
  genreId: undefined,
};

export const useArtistParams = (initialLimit = 10) => {
  // 1. Gọi Generic Hook
  const { params: rawParams, setParams } = useQueryParams({
    ...DEFAULT_PARAMS,
    limit: initialLimit,
  });

  // 2. Parse & Validate
  const filterParams = useMemo((): ArtistFilterParams => {
    return {
      ...rawParams,
      // Parse boolean từ URL string ("true"/"false")
      isVerified:
        rawParams.isVerified === true
          ? true
          : rawParams.isVerified === false
            ? false
            : undefined,

      isActive:
        rawParams.isActive === true
          ? true
          : rawParams.isActive === false
            ? false
            : undefined,
    };
  }, [rawParams]);

  // 3. Handlers
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

  // Generic Filter Change Handler
  const handleFilterChange = useCallback(
    <K extends keyof ArtistFilterParams>(
      key: K,
      value: ArtistFilterParams[K] | null,
    ) => {
      setParams({ [key]: value, page: 1 });
    },
    [setParams],
  );

  const clearFilters = useCallback(() => {
    setParams({
      ...DEFAULT_PARAMS,
      limit: filterParams.limit,
    });
  }, [setParams, filterParams.limit]);

  return {
    filterParams,
    handlePageChange,
    handleSearch,
    handleFilterChange,
    clearFilters,
  };
};
