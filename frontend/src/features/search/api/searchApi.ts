import api from "@/lib/axios";
import {
  SearchInput,
  SuggestInput,
  TrendingInput,
} from "@/features/search/schemas/search.schema";
import {
  SearchResponse,
  SearchData,
  SuggestResponse,
  TrendingResponse,
  SuggestItem,
} from "../types";
import { handleError } from "@/utils/handleError";

const EMPTY_SEARCH_DATA: SearchData = {
  topResult: null,
  tracks: [],
  artists: [],
  albums: [],
  playlists: [],
  genres: [],
};

export const searchApi = {
  /**
   * 1. FULL SEARCH
   * Axios return: { data: { status, data: SearchData } }
   */
  search: async (params: SearchInput): Promise<SearchData> => {
    if (!params.q?.trim()) return EMPTY_SEARCH_DATA;

    try {
      // Ở đây ta dùng SearchResponse để cast cho toàn bộ body trả về từ API
      const response = await api.get<SearchResponse>("/search", {
        params: {
          ...params,
          q: params.q.trim(),
        },
      });

      // Theo cấu trúc BaseSearchResponse, dữ liệu nằm trong response.data.data
      return response.data.data || EMPTY_SEARCH_DATA;
    } catch (error) {
      handleError(error, "Lỗi khi tìm kiếm tổng hợp");
      return EMPTY_SEARCH_DATA;
    }
  },

  /**
   * 2. SUGGEST (Autocomplete)
   * Axios return: { data: { status, data: SuggestItem[] } }
   */
  suggest: async (params: SuggestInput): Promise<SuggestItem[]> => {
    if (!params.q?.trim()) return [];

    try {
      const response = await api.get<SuggestResponse>("/search/suggest", {
        params: {
          q: params.q.trim(),
          limit: params.limit || 5,
        },
      });
      return response.data.data || [];
    } catch (error) {
      // Im lặng khi lỗi suggest để không gián đoạn trải nghiệm gõ
      return [];
    }
  },

  /**
   * 3. TRENDING
   * Axios return: { data: { status, data: string[] } }
   */
  getTrending: async (params?: TrendingInput): Promise<string[]> => {
    try {
      const response = await api.get<TrendingResponse>("/search/trending", {
        params: {
          top: params?.top || 10,
        },
      });
      return response.data.data || [];
    } catch (error) {
      console.error("[SearchApi] Trending error:", error);
      return [];
    }
  },
};
