import { z } from "zod";
import {
  booleanSchema,
  collaboratorsSchema,
  emptyToUndefined,
  objectIdSchema,
  optionalObjectIdSchema,
  tagsSchema,
  hexColorSchema,
  formDataArrayHelper, // Helper cho mảng track
} from "./common.validate";
import { APP_CONFIG } from "../config/constants";

// --- ENUMS ---
const playlistTypeValues = ["playlist", "album", "radio", "mix"] as const;
const visibilityValues = ["public", "private", "unlisted"] as const;
const playlistSortEnum = z.enum([
  "newest",
  "oldest",
  "popular",
  "name",
  "trending",
  "duration",
]);

const playlistTypeSchema = z.enum(playlistTypeValues);
const visibilitySchema = z.enum(visibilityValues);

// --- 1.A CREATE PLAYLIST ---
export const createPlaylistSchema = z.object({
  body: z.object({
    title: z
      .string()
      .trim()
      .min(1, "Tiêu đề không được để trống")
      .max(100, "Tiêu đề không được vượt quá 100 ký tự"),
    description: z
      .string()
      .max(200, "Mô tả không được vượt quá 200 ký tự")
      .optional(),
    publishAt: z.preprocess(
      emptyToUndefined,
      z.string().datetime({ message: "Ngày giờ không hợp lệ" }).optional(),
    ),
    // Tracks ban đầu (Dùng helper để nhận Array từ FormData)
    tracks: formDataArrayHelper(objectIdSchema).optional(),

    tags: tagsSchema.optional(),
    collaborators: collaboratorsSchema.optional(),

    type: playlistTypeSchema.default("playlist"),
    visibility: visibilitySchema.default("public"),
    userId: optionalObjectIdSchema, // Admin có thể tạo playlist cho user khác
    themeColor: hexColorSchema.optional(),

    isSystem: booleanSchema.default(false), // Dùng default an toàn ở đây
  }),
});
// --- 1.B CREATE QUICK PLAYLIST ---
export const createQuickPlaylistSchema = z.object({
  body: z.object({
    title: z
      .string()
      .trim()
      .min(1, "Tiêu đề không được để trống")
      .max(100, "Tiêu đề không được vượt quá 100 ký tự"),
    tracks: formDataArrayHelper(objectIdSchema).optional(),
    visibility: visibilitySchema.default("public"),
  }),
});

// --- 2.A UPDATE QUICK PLAYLIST (METADATA) ---
export const updateQuickPlaylistSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    title: z
      .string()
      .trim()
      .min(1, "Tiêu đề không được để trống")
      .max(100, "Tiêu đề không được vượt quá 100 ký tự")
      .optional(),
  }),
  visibility: visibilitySchema.default("public"),
});
// --- 2.B UPDATE PLAYLIST (METADATA) ---
export const updatePlaylistSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    title: z
      .string()
      .trim()
      .min(1, "Tiêu đề không được để trống")
      .max(100, "Tiêu đề không được vượt quá 100 ký tự")
      .optional(),
    description: z
      .string()
      .max(200, "Mô tả không được vượt quá 200 ký tự")
      .optional(),
    tags: tagsSchema.optional(),
    userId: optionalObjectIdSchema, // Admin có thể chuyển ownership
    publishAt: z.preprocess(emptyToUndefined, z.string().datetime().optional()),

    type: playlistTypeSchema.optional(),
    visibility: visibilitySchema.optional(),
    themeColor: hexColorSchema.optional(),
    isSystem: booleanSchema.optional(),
    collaborators: collaboratorsSchema.optional(),
  }),
});
// --- 3. Delete Playlist ---
export const deletePlaylistSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});
// --- 4. ADD TRACKS ---
export const addTracksToPlaylistSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    trackIds: formDataArrayHelper(objectIdSchema).pipe(
      z
        .array(objectIdSchema)
        .min(1, "Vui lòng chọn ít nhất 1 bài hát")
        .max(100, "Không thể thêm quá 100 bài cùng lúc"),
    ),
  }),
});
// --- 5. REMOVE TRACKS ---
export const removeTracksFromPlaylistSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    trackIds: formDataArrayHelper(objectIdSchema).pipe(
      z.array(objectIdSchema).min(1, "Vui lòng chọn ít nhất 1 bài hát để xóa"),
    ),
  }),
});
// --- 6. REORDER TRACKS (Dùng same schema như addTracks, chỉ khác endpoint) ---
export const reorderPlaylistTracksSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    trackIds: formDataArrayHelper(objectIdSchema).pipe(
      z
        .array(objectIdSchema)
        .min(1, "Vui lòng cung cấp thứ tự ít nhất 1 bài hát")
        .max(1000, "Không thể reorder quá 1000 bài cùng lúc"),
    ),
  }),
});
// --- 7. Toggle Playlist Visibility ---
export const togglePlaylistVisibilitySchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    visibility: visibilitySchema,
  }),
});
// --- 8. get MylPlaylists ---
export const getMyPlaylistsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(APP_CONFIG.GRID_LIMIT, "Limit too high")
      .default(APP_CONFIG.GRID_LIMIT),
  }),
});
// --- 9. get Playlist Detail ---
export const getPlaylistsByUserSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).max(APP_CONFIG.MAX_PAGES).default(1),
      limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(APP_CONFIG.MAX_PAGES)
        .default(APP_CONFIG.GRID_LIMIT),

      keyword: z.preprocess(
        emptyToUndefined,
        z.string().trim().min(1).max(100).optional(),
      ),
      sort: playlistSortEnum.default("popular"),
      // Tag search: Hỗ trợ lọc theo tag đơn lẻ
      tag: z.preprocess(
        emptyToUndefined,
        z.string().trim().min(1).max(30, "Tag too long").optional(),
      ),

      type: z.preprocess(
        emptyToUndefined,
        z.enum(["playlist", "radio", "mix", "album"]).optional(),
      ),
    })
    .strict(), // 🔥 CHIÊU CUỐI: Chặn đứng các tham số lạ (SQL Injection / Parameter Tampering)
});
// --- 10. get Playlist Detail (Admin) - Có thêm filter để xem private/draft của tất cả user ---
export const getPlaylistsByAdminSchema = getPlaylistsByUserSchema.extend({
  query: getPlaylistsByUserSchema.shape.query.extend({
    visibility: z.preprocess(
      emptyToUndefined,
      z.enum(["public", "private", "unlisted"]).optional(),
    ),
    // Sử dụng helper queryBoolean đã định nghĩa ở trên
    isSystem: z.preprocess((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }, z.boolean().optional()),
    isDeleted: z.preprocess((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    }, z.boolean().optional()),
    userId: optionalObjectIdSchema, // userId nằm TRONG query để lọc ?userId=...
  }),
});
// --- 11. get Playlist Tracks (Dùng same schema như getPlaylists, chỉ khác endpoint) ---
export const getPlaylistTracksSchema = getPlaylistsByUserSchema.extend({
  query: getPlaylistsByUserSchema.shape.query.omit({
    keyword: true,
    tag: true,
    type: true,
  }),
});
// --- 12. get Playlist Detail by ID (Public) ---
export const getPlaylistDetailSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});

// --- EXPORT TYPES ---
export type CreatePlaylistInput = z.infer<typeof createPlaylistSchema>["body"];
export type UpdatePlaylistInput = z.infer<typeof updatePlaylistSchema>["body"];
export type PlaylistUserFilterInput = z.infer<
  typeof getPlaylistsByUserSchema
>["query"];
export type PlaylistAdminFilterInput = z.infer<
  typeof getPlaylistsByAdminSchema
>["query"];
