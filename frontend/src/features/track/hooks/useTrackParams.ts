import { useMemo, useCallback, useEffect } from "react";
import { useQueryParams } from "@/hooks/useQueryParams";
import {
  trackParamsSchema,
  type TrackFilterParams,
} from "../schemas/track.schema";
import { APP_CONFIG } from "@/config/constants";

const DEFAULT_PARAMS: TrackFilterParams = {
  page: 1,
  limit: APP_CONFIG.PAGINATION_LIMIT,
  keyword: "",
  sort: "newest",
  status: undefined,
  genreId: undefined,
  albumId: undefined,
  artistId: undefined,
  isDeleted: undefined,
  isPublic: undefined,
  moodVideoId: undefined,
  lyricType: undefined,
};

export const useTrackParams = () => {
  const { params: rawParams, setParams } = useQueryParams({
    ...DEFAULT_PARAMS,
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
  const clearFilters = useCallback(() => {
    setParams({ ...DEFAULT_PARAMS });
  }, [setParams]);
  return {
    filterParams,
    handlePageChange,
    handleSearch,
    handleFilterChange,
    clearFilters,
  };
};
