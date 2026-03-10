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
      z.array(objectIdSchema).max(
        500,
        "Playlist giới hạn tối đa 500 bài hát",
      ),
    ),
  }),
});

// --- 4. GET LIST (FILTER) ---
export const getPlaylistsSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(10),

    keyword: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    tags: z.preprocess(emptyToUndefined, z.string().trim().optional()),

    userId: optionalObjectIdSchema,
    type: z.preprocess(emptyToUndefined, playlistTypeSchema.optional()),
    visibility: z.preprocess(emptyToUndefined, visibilitySchema.optional()),

    isSystem: booleanSchema.optional(),

    sort: z
      .enum(["newest", "popular", "followers", "name", "oldest"])
      .default("newest"),
  }),
});

// --- 5. TRACK MANAGEMENT ---
export const addTracksToPlaylistSchema = z.object({
  params: z.object({ playlistId: objectIdSchema }),
  body: z.object({
    trackIds: formDataArrayHelper(objectIdSchema).pipe(
      z.array(objectIdSchema)
        .min(1, "Vui lòng chọn ít nhất 1 bài hát")
        .max(100, "Không thể thêm quá 100 bài cùng lúc"),
    ),
  }),
});

export const removeTracksToPlaylistSchema = z.object({
  params: z.object({ playlistId: objectIdSchema }),
  body: z.object({
    trackIds: formDataArrayHelper(objectIdSchema).pipe(
      z.array(objectIdSchema).min(
        1,
        "Vui lòng chọn ít nhất 1 bài hát để xóa",
      ),
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
