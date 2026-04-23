import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { searchApi } from "../api/searchApi";
import { useDebounce } from "@/hooks/useDebounce";

/**
 * 1. HOOK FULL SEARCH
 * Dùng khi user nhấn Enter hoặc xem kết quả chi tiết.
 * Debounce 400ms để tránh spam API nặng.
 */
export const useSearch = (query: string) => {
  const debouncedQuery = useDebounce(query, 400);

  return useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => searchApi.search({ q: debouncedQuery, limit: 10 }),
    enabled: true, // Chạy cả khi rỗng để trả về EMPTY_SEARCH_DATA giúp xóa UI cũ
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: false,
  });
};

/**
 * 2. HOOK SEARCH SUGGESTIONS (Autocomplete)
 * Dùng để hiện dropdown gợi ý nhanh khi đang gõ.
 * Debounce 200ms (Nhanh gấp đôi Full Search) để phản hồi tức thì.
 */
export const useSearchSuggestions = (query: string) => {
  const debouncedQuery = useDebounce(query, 200);

  return useQuery({
    queryKey: ["search-suggestions", debouncedQuery],
    queryFn: () => searchApi.suggest({ q: debouncedQuery, limit: 6 }),
    // Chỉ kích hoạt khi user gõ từ 2 ký tự trở lên để tối ưu network
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 1 * 60 * 1000, // Suggestion nên tươi mới (1 phút)
    gcTime: 5 * 60 * 1000,
  });
};

/**
 * 3. HOOK TRENDING SEARCHES
 * Tự động gọi khi vào trang Search để hiện danh sách "Đang thịnh hành".
 */
export const useTrendingSearches = (top: number = 10) => {
  return useQuery({
    queryKey: ["search-trending", top],
    queryFn: () => searchApi.getTrending({ top }),
    staleTime: 5 * 60 * 1000, // Xu hướng không thay đổi quá nhanh (5 phút)
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false, // Tránh refetch liên tục khi user chuyển tab
  });
};
