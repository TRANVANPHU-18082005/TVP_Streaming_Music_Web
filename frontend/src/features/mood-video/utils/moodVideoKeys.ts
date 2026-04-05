import { MoodVideoFilterParams } from "../types";

export const moodVideoKeys = {
  all: ["mood-videos"] as const,
  // Key cho danh sách (có kèm filter để cache riêng từng trang/từng từ khóa)
  lists: () => [...moodVideoKeys.all, "list"] as const,
  list: (filter: MoodVideoFilterParams) =>
    [...moodVideoKeys.lists(), { filter }] as const,

  // Key cho chi tiết (dùng khi xem info hoặc đếm bài hát đang dùng)
  details: () => [...moodVideoKeys.all, "detail"] as const,
  detail: (id: string) => [...moodVideoKeys.details(), id] as const,
};
