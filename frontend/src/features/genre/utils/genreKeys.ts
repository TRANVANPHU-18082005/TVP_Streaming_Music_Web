import { GenreFilterParams } from "../schemas/genre.schema";

export const genreKeys = {
  all: ["genres"] as const,

  // Danh sách có phân trang & lọc
  lists: () => [...genreKeys.all, "list"] as const,
  list: (filter: GenreFilterParams) =>
    [...genreKeys.lists(), { filter }] as const,

  // Chi tiết
  details: () => [...genreKeys.all, "detail"] as const,
  detail: (slug: string) => [...genreKeys.details(), slug] as const,

  // Cấu trúc cây (Hierarchy)
  tree: () => [...genreKeys.all, "tree"] as const,

  // Dropdown select (thường là list rút gọn)
  select: () => [...genreKeys.all, "select"] as const,

  tracks: () => [...genreKeys.all, "tracks"] as const,
  trackList: (idOrSlug: string, params: { page?: number; limit?: number }) =>
    [...genreKeys.tracks(), idOrSlug, { params }] as const,
};
