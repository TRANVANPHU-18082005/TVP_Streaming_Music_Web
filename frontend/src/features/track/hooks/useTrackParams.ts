import { useMemo, useCallback, useEffect } from "react";
import { useQueryParams } from "@/hooks/useQueryParams";
import {
  trackParamsSchema,
  type TrackFilterParams,
} from "../schemas/track.schema";

const DEFAULT_PARAMS: TrackFilterParams = {
  page: 1,
  limit: 10,
  keyword: undefined,
  sort: "newest",
  status: undefined,
  genreId: undefined,
  albumId: undefined,
  artistId: undefined,
};

export const useTrackParams = (initialLimit = 10) => {
  const { params: rawParams, setParams } = useQueryParams({
    ...DEFAULT_PARAMS,
    limit: initialLimit,
  });

  const filterParams = useMemo(
    () => trackParamsSchema.parse(rawParams),
    [rawParams],
  );

  useEffect(() => {
    const isDirty = JSON.stringify(rawParams) !== JSON.stringify(filterParams);
    if (isDirty) {
      setParams(filterParams, { replace: true });
    }
  }, [rawParams, filterParams, setParams]);

  const handlePageChange = useCallback(
    (page: number) => setParams({ page }),
    [setParams],
  );

  const handleSearch = useCallback(
    (keyword: string) => {
      const trimmed = keyword.trim();
      setParams({ keyword: trimmed === "" ? undefined : trimmed, page: 1 });
    },
    [setParams],
  );

  const handleFilterChange = useCallback(
    <K extends keyof TrackFilterParams>(
      key: K,
      value: TrackFilterParams[K] | null | undefined,
    ) => {
      setParams({ [key]: value === "" ? undefined : value, page: 1 });
    },
    [setParams],
  );

  return {
    filterParams,
    handlePageChange,
    handleSearch,
    handleFilterChange,
    clearFilters: () => setParams(DEFAULT_PARAMS),
  };
};
