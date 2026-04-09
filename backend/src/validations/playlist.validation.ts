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

// --- ENUMS ---
const playlistTypeValues = ["playlist", "album", "radio", "mix"] as const;
const visibilityValues = ["public", "private", "unlisted"] as const;

const playlistTypeSchema = z.enum(playlistTypeValues);
const visibilitySchema = z.enum(visibilityValues);

// --- 1. CREATE PLAYLIST ---
export const createPlaylistSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, "Tiêu đề không được để trống").max(100),
    description: z.string().max(2000).optional(),

    // ⏰ Hẹn giờ Public
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

    themeColor: hexColorSchema.optional(),

    isSystem: booleanSchema.default(false), // Dùng default an toàn ở đây
  }),
});

// --- 2. UPDATE PLAYLIST (METADATA) ---
export const updatePlaylistSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    title: z.string().trim().min(1).max(100).optional(),
    description: z.string().max(2000).optional(),
    tags: tagsSchema.optional(),

    publishAt: z.preprocess(emptyToUndefined, z.string().datetime().optional()),

    type: playlistTypeSchema.optional(),
    visibility: visibilitySchema.optional(),
    themeColor: hexColorSchema.optional(),
    isSystem: booleanSchema.optional(),
    collaborators: collaboratorsSchema.optional(),
  }),
});

// --- 3. REORDER TRACKS ---
export const updatePlaylistTracksSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    trackIds: formDataArrayHelper(objectIdSchema).pipe(
      z.array(objectIdSchema).max(500, "Playlist giới hạn tối đa 500 bài hát"),
    ),
  }),
});

// --- 4. GET LIST PLAYLISTS (Advanced Validation) ---
export const getPlaylistsSchema = z.object({
  query: z
    .object({
      // 1. Phân trang: Kiểm soát chặt chẽ limit để tránh Overload RAM khi serialize
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(50, "Limit too high")
        .default(12),

      // 2. Keyword & Tags: Chống ReDoS bằng cách giới hạn độ dài chuỗi tối đa
      // Người dùng bình thường không bao giờ search 1 keyword dài hơn 100 ký tự
      keyword: z.preprocess(
        emptyToUndefined,
        z.string().trim().min(1).max(100, "Keyword too long").optional(),
      ),

      // Tag search: Hỗ trợ lọc theo tag đơn lẻ
      tag: z.preprocess(
        emptyToUndefined,
        z.string().trim().min(1).max(30, "Tag too long").optional(),
      ),

      // 3. IDs: Sử dụng Schema ObjectId dùng chung để đảm bảo Hex 24 ký tự
      userId: optionalObjectIdSchema,

      // 4. Enums & Types: Chỉ chấp nhận các giá trị nghiệp vụ hợp lệ
      // Tránh việc user gửi type="hacker" gây lỗi logic ở Service
      type: z.preprocess(
        emptyToUndefined,
        z.enum(["playlist", "radio", "mix", "album"]).optional(),
      ),

      // Privacy Control: Enum thay vì Boolean để hỗ trợ Unlisted/Private
      visibility: z.preprocess(
        emptyToUndefined,
        z.enum(["public", "private", "unlisted"]).optional(),
      ),

      // 5. System Flag: Sử dụng preprocess để ép kiểu từ String URL sang Boolean
      isSystem: z.preprocess((val) => {
        if (val === "true" || val === true) return true;
        if (val === "false" || val === false) return false;
        return undefined;
      }, z.boolean().optional()),

      // 6. Sorting: Các tiêu chí sắp xếp đã được index trong MongoDB
      sort: z
        .enum(["newest", "popular", "followers", "name", "oldest", "trending"])
        .default("newest"),
    })
    .strict(), // 🔥 CHIÊU CUỐI: Chặn đứng các tham số lạ (SQL Injection / Parameter Tampering)
});
export const getPlaylistTracksSchema = getPlaylistsSchema.extend({
  query: getPlaylistsSchema.shape.query.omit({
    userId: true,
  }),
});
// --- 5. TRACK MANAGEMENT ---
export const addTracksToPlaylistSchema = z.object({
  params: z.object({ playlistId: objectIdSchema }),
  body: z.object({
    trackIds: formDataArrayHelper(objectIdSchema).pipe(
      z
        .array(objectIdSchema)
        .min(1, "Vui lòng chọn ít nhất 1 bài hát")
        .max(100, "Không thể thêm quá 100 bài cùng lúc"),
    ),
  }),
});

export const removeTracksToPlaylistSchema = z.object({
  params: z.object({ playlistId: objectIdSchema }),
  body: z.object({
    trackIds: formDataArrayHelper(objectIdSchema).pipe(
      z.array(objectIdSchema).min(1, "Vui lòng chọn ít nhất 1 bài hát để xóa"),
    ),
  }),
});

export const removeTrackSchema = z.object({
  params: z.object({
    playlistId: objectIdSchema,
    trackId: objectIdSchema,
  }),
});

// --- EXPORT TYPES ---
export type CreatePlaylistInput = z.infer<typeof createPlaylistSchema>["body"];
export type UpdatePlaylistInput = z.infer<typeof updatePlaylistSchema>["body"];
export type UpdatePlaylistTracksInput = z.infer<
  typeof updatePlaylistTracksSchema
>["body"];
export type PlaylistFilterInput = z.infer<typeof getPlaylistsSchema>["query"];
