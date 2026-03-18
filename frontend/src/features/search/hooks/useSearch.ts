// src/features/search/hooks/useSearch.ts
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { searchApi } from "../api/searchApi";
import { useDebounce } from "@/hooks/useDebounce";

export const useSearch = (query: string) => {
  const debouncedQuery = useDebounce(query, 400);

  return useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => searchApi.search({ q: debouncedQuery, limit: 10 }),

    // 🚀 Đổi thành true để khi user xóa hết chữ, queryFn chạy và trả về EMPTY_SEARCH_DATA
    // UI sẽ tự động xóa sạch kết quả cũ.
    enabled: true,

    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: false,
  });
};
