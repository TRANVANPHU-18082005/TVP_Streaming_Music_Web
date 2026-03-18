// src/features/search/api/searchApi.ts
import api from "@/lib/axios";
import { SearchInput } from "@/features/search/schemas/search.schema";
import { SearchResponse, SearchData } from "../types";
import { handleError } from "@/utils/handleError";

const EMPTY_SEARCH_DATA: SearchData = {
  topResult: null,
  tracks: [],
  artists: [],
  albums: [],
  playlists: [],
};

export const searchApi = {
  search: async (params: SearchInput): Promise<SearchData> => {
    // 🚀 Tối ưu: Nếu không có chữ nào, trả về rỗng ngay (Không tốn Network)
    if (!params.q?.trim()) {
      return EMPTY_SEARCH_DATA;
    }

    try {
      const { data } = await api.get<SearchResponse>("/search", {
        params: {
          ...params,
          q: params.q.trim(), // Luôn trim trước khi gửi lên server
        },
      });
      return data.data || EMPTY_SEARCH_DATA;
    } catch (error) {
      handleError(error, "Lỗi khi tìm kiếm"); // Log lỗi chi tiết
      // Nếu lỗi (404/500), trả về mảng rỗng thay vì ném lỗi làm chết UI
      return EMPTY_SEARCH_DATA;
    }
  },
};
