import { useMemo, useCallback, useEffect } from "react";
import { useQueryParams } from "@/hooks/useQueryParams";
import {
  AlbumFilterParamsSchemas,
  albumParamsSchema,
} from "../schemas/album.schema";

const DEFAULT_ALBUM_PARAMS: AlbumFilterParamsSchemas = {
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
  // 1. Lấy dữ liệu thô từ URL
  const { params: rawParams, setParams } = useQueryParams({
    ...DEFAULT_ALBUM_PARAMS,
    limit: initialLimit,
  });

  // 2. Màng lọc Zod: Luôn trả về data "sạch" cho UI sử dụng
  const filterParams = useMemo(() => {
    // Dùng safeParse hoặc parse tùy vào cách bạn config catch/default trong schema
    return albumParamsSchema.parse(rawParams);
  }, [rawParams]);

  // 3. 🔥 ĐỒNG BỘ URL (Self-healing): Nắn lại thanh địa chỉ nếu User nhập sai
  useEffect(() => {
    // So sánh dữ liệu thô trên URL và dữ liệu sạch sau khi qua Zod
    const isDirty = JSON.stringify(rawParams) !== JSON.stringify(filterParams);

    if (isDirty) {
      // Ghi đè URL bằng data sạch, dùng replace: true để không làm hỏng nút Back của trình duyệt
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
    <K extends keyof AlbumFilterParamsSchemas>(
      key: K,
      value: AlbumFilterParamsSchemas[K] | null | undefined,
    ) => {
      // Nếu giá trị là rỗng, set undefined để xóa key đó khỏi URL cho sạch
      const cleanValue = value === "" ? undefined : value;
      setParams({ [key]: cleanValue, page: 1 });
    },
    [setParams],
  );

  const clearFilters = useCallback(() => {
    setParams({ ...DEFAULT_ALBUM_PARAMS, limit: initialLimit });
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
