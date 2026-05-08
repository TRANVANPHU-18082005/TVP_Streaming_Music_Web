import { useMemo, useCallback, useEffect } from "react";
import { useQueryParams } from "@/hooks/useQueryParams";
import {
  AlbumAdminFilterParams,
  albumAdminParamsSchema,
} from "../schemas/album.schema";
import { APP_CONFIG } from "@/config/constants";

const DEFAULT_ALBUM_PARAMS: AlbumAdminFilterParams = {
  page: 1,
  limit: APP_CONFIG.GRID_LIMIT,
  keyword: "",
  sort: "newest",
  type: undefined,
  isPublic: undefined,
  artistId: undefined,
  year: undefined,
  isDeleted: undefined,
};

export const useAlbumParams = () => {
  // 1. Lấy dữ liệu thô từ URL
  const { params: rawParams, setParams } =
    useQueryParams<AlbumAdminFilterParams>({
      ...DEFAULT_ALBUM_PARAMS,
    });

  // 2. Màng lọc Zod: Luôn trả về data "sạch" cho UI sử dụng
  const filterParams = useMemo(() => {
    // Dùng safeParse hoặc parse tùy vào cách bạn config catch/default trong schema
    return albumAdminParamsSchema.parse(rawParams);
  }, [rawParams]);

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

  // Trong useAlbumParams
  const handleSearch = useCallback(
    (keyword: string) => {
      const trimmed = keyword.trim();
      // Nếu rỗng thì gửi undefined để useQueryParams delete key khỏi URL
      setParams({
        keyword: trimmed === "" ? undefined : trimmed,
        page: 1,
      });
    },
    [setParams],
  );

  const handleFilterChange = useCallback(
    <K extends keyof AlbumAdminFilterParams>(
      key: K,
      value: AlbumAdminFilterParams[K] | null | undefined,
    ) => {
      // Nếu giá trị là rỗng, set undefined để xóa key đó khỏi URL cho sạch
      const cleanValue = value === "" ? undefined : value;
      setParams({ [key]: cleanValue, page: 1 });
    },
    [setParams],
  );

  const clearFilters = useCallback(() => {
    setParams({ ...DEFAULT_ALBUM_PARAMS });
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
