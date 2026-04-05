import { useMemo, useCallback } from "react";
import { useQueryParams } from "@/hooks/useQueryParams";
import { MoodVideoFilterParams } from "../types";

// Các giá trị hợp lệ được định nghĩa sẵn để Validate URL
const ALLOWED_SORTS = ["newest", "oldest", "popular", "name"] as const;

// Default values chuẩn cho MoodVideo
const DEFAULT_MOOD_PARAMS: MoodVideoFilterParams = {
  page: 1,
  limit: 12,
  keyword: "",
  sort: "newest",
  isActive: undefined,
};

export const useMoodVideoParams = (initialLimit = 12) => {
  // 1. Gọi Generic Hook để parse URL Search Params
  const { params: rawParams, setParams } =
    useQueryParams<MoodVideoFilterParams>({
      ...DEFAULT_MOOD_PARAMS,
      limit: initialLimit,
    });

  // 2. Validate & Override Logic (Bảo vệ hệ thống khỏi URL bẩn)
  const filterParams = useMemo((): MoodVideoFilterParams => {
    return {
      ...rawParams,
      // Kiểm tra nếu Sort trên URL không nằm trong danh sách cho phép thì fallback về newest
      sort: ALLOWED_SORTS.includes(rawParams.sort as any)
        ? rawParams.sort
        : "newest",

      // Chuyển đổi limit/page sang Number (nếu generic hook chưa làm)
      page: Number(rawParams.page) || 1,
      limit: Number(rawParams.limit) || initialLimit,
    };
  }, [rawParams, initialLimit]);

  // 3. Custom Handlers (Chuẩn hóa thao tác UI)

  // Chuyển trang
  const handlePageChange = useCallback(
    (page: number) => {
      setParams({ page });
    },
    [setParams],
  );

  // Tìm kiếm (luôn reset về trang 1)
  const handleSearch = useCallback(
    (keyword: string) => {
      setParams({ keyword, page: 1 });
    },
    [setParams],
  );

  // Thay đổi filter bất kỳ (isActive, sort...)
  const handleFilterChange = useCallback(
    <K extends keyof MoodVideoFilterParams>(
      key: K,
      value: MoodVideoFilterParams[K] | null,
    ) => {
      setParams({ [key]: value, page: 1 });
    },
    [setParams],
  );

  // Xóa sạch bộ lọc (Reset về mặc định nhưng giữ lại số lượng item/page)
  const clearFilters = useCallback(() => {
    setParams({
      ...DEFAULT_MOOD_PARAMS,
      limit: filterParams.limit,
    });
  }, [setParams, filterParams.limit]);

  return {
    filterParams,
    setFilterParams: setParams, // Expose để dùng cho các trường hợp đặc biệt
    handlePageChange,
    handleSearch,
    handleFilterChange,
    clearFilters,
  };
};
