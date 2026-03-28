import { useMemo, useCallback } from "react";
import { useQueryParams } from "@/hooks/useQueryParams"; // Import Generic Hook
import { AlbumFilterParams } from "../types";

const ALLOWED_SORTS = ["newest", "oldest", "popular", "name"] as const;
const ALLOWED_TYPES = ["album", "single", "ep", "compilation", "all"] as const;

// Default values
const DEFAULT_ALBUM_PARAMS: AlbumFilterParams = {
  page: 1,
  limit: 10,
  keyword: "",
  sort: "newest",
  type: undefined,
  isPublic: undefined,
  artistId: undefined,
  genreId: undefined,
  year: undefined,
};

export const useAlbumParams = (initialLimit = 10) => {
  // 1. Gọi Generic Hook
  const { params: rawParams, setParams } = useQueryParams({
    ...DEFAULT_ALBUM_PARAMS,
    limit: initialLimit,
  });

  // 2. Validate & Override (Logic đặc thù của Album)
  // Generic hook chỉ parse cơ bản, ở đây ta validate kỹ hơn (Enum check)
  const filterParams = useMemo((): AlbumFilterParams => {
    return {
      ...rawParams,
      // Validate Sort
      sort: ALLOWED_SORTS.includes(rawParams.sort as any)
        ? rawParams.sort
        : "newest",
      // Validate Type
      type: ALLOWED_TYPES.includes(rawParams.type as any)
        ? rawParams.type
        : undefined,
    };
  }, [rawParams]);

  // 3. Custom Handlers (Giữ nguyên như cũ)
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
    <K extends keyof AlbumFilterParams>(
      key: K,
      value: AlbumFilterParams[K] | null,
    ) => {
      setParams({ [key]: value, page: 1 });
    },
    [setParams],
  );

  const clearFilters = useCallback(() => {
    // Reset về default nhưng giữ limit
    setParams({
      ...DEFAULT_ALBUM_PARAMS,
      limit: filterParams.limit,
    });
  }, [setParams, filterParams.limit]);

  return {
    filterParams,
    setFilterParams: setParams, // Expose raw setter nếu cần
    handlePageChange,
    handleSearch,
    handleFilterChange,
    clearFilters,
  };
};
