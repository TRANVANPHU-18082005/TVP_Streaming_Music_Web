import { useQuery, keepPreviousData } from "@tanstack/react-query";
import moodVideoApi from "../api/moodVideoApi";
import { moodVideoKeys } from "../utils/moodVideoKeys";
import type { MoodVideoFilterParams } from "../types";

/**
 * Hook lấy danh sách Mood Video (Admin/Artist chọn Canvas)
 */
export const useMoodVideosQuery = (params: MoodVideoFilterParams) => {
  return useQuery({
    queryKey: moodVideoKeys.list(params),
    queryFn: () => moodVideoApi.getAll(params),

    // Giữ data trang cũ khi đang load trang mới (Tránh giật màn hình)
    placeholderData: keepPreviousData,

    // Cache 5 phút vì thư viện Video thường ít thay đổi liên tục
    staleTime: 5 * 60 * 1000,

    // Bóc tách dữ liệu chuẩn DTO
    select: (response) => ({
      videos: response.data.data,
      meta: response.data.meta,
      isEmpty: response.data.data.length === 0,
    }),
  });
};

/**
 * Hook lấy danh sách video đang "Hot" (được dùng nhiều nhất)
 */
export const usePopularMoodVideos = (limit = 5) => {
  const params: MoodVideoFilterParams = {
    limit,
    sort: "popular",
    isActive: true,
  };

  return useQuery({
    queryKey: moodVideoKeys.list(params),
    queryFn: () => moodVideoApi.getAll(params),
    staleTime: 10 * 60 * 1000,
    select: (response) => response.data.data,
  });
};
