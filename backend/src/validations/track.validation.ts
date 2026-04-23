import { z } from "zod";
import {
  booleanSchema,
  genreIdsSchema,
  nullableObjectIdSchema,
  objectIdSchema,
  optionalObjectIdSchema,
  tagsSchema,
  emptyToUndefined,
  formDataArrayHelper,
  featuringArtistsSchema,
} from "./common.validate";

// --- 1. CREATE TRACK SCHEMA ---
export const createTrackSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, "Tiêu đề là bắt buộc").max(200),
    description: z.string().max(2000).optional(),

    artistId: objectIdSchema,
    featuringArtistIds: featuringArtistsSchema.optional(),
    albumId: nullableObjectIdSchema,
    genreIds: genreIdsSchema,

    // === UPGRADE v2.0: VISUAL CANVAS ===
    moodVideoId: nullableObjectIdSchema.optional(),

    trackNumber: z.coerce.number().min(1).default(1),
    diskNumber: z.coerce.number().min(1).default(1),

    releaseDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    isExplicit: booleanSchema.default(false),
    isPublic: booleanSchema.default(true),

    copyright: z.string().trim().max(500).optional(),
    isrc: z.string().trim().max(30).optional(),

    // Tags cực kỳ quan trọng cho Worker Matching
    tags: tagsSchema,

    // Duration sẽ được Worker tính lại, nhưng FE gửi lên để hiển thị tạm thời
    duration: z.coerce.number().min(0).default(0),
  }),
});

// --- 2. UPDATE TRACK SCHEMA ---
export const updateTrackSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    isPublic: booleanSchema.optional(),
    artistId: objectIdSchema.optional(),

    albumId: nullableObjectIdSchema.optional(),
    genreIds: genreIdsSchema.optional(),
    featuringArtistIds: featuringArtistsSchema.optional(),

    // Nâng cấp update Canvas & Lyrics
    moodVideoId: nullableObjectIdSchema.optional(),
    tags: tagsSchema.optional(),
    trackNumber: z.coerce.number().min(1).optional(),
    diskNumber: z.coerce.number().min(1).optional(),
    releaseDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),

    isExplicit: booleanSchema.optional(),
    copyright: z.string().trim().max(500).optional(),
    isrc: z.string().trim().max(30).optional(),
    duration: z.coerce.number().min(0).optional(),
  }),
});

// --- 3. CHANGE STATUS SCHEMA ---
export const changeStatusSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    status: z.enum(["pending", "ready", "failed", "processing"]),
    errorReason: z.string().optional(), // Lưu lý do nếu failed
  }),
});

// --- 4. BULK UPDATE SCHEMA ---
export const bulkUpdateTracksSchema = z.object({
  body: z.object({
    trackIds: formDataArrayHelper(objectIdSchema).refine(
      (ids) => ids.length >= 1,
      "Vui lòng chọn ít nhất 1 bài hát",
    ),

    updates: z
      .object({
        albumId: nullableObjectIdSchema.optional(),
        genreIds: genreIdsSchema.optional(),
        tags: tagsSchema.optional(),
        isPublic: booleanSchema.optional(),
        moodVideoId: nullableObjectIdSchema.optional(), // Cập nhật Canvas hàng loạt
        status: z.enum(["pending", "ready", "failed", "processing"]).optional(),
      })
      .refine(
        (data) => Object.values(data).some((val) => val !== undefined),
        "Phải chọn ít nhất một thông tin để cập nhật",
      ),
  }),
});

// --- 5. GET TRACKS SCHEMA (Filter nâng cao) ---
export const getTracksSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10),
    keyword: z.preprocess(emptyToUndefined, z.string().trim().optional()),

    artistId: optionalObjectIdSchema,
    albumId: optionalObjectIdSchema,
    genreId: optionalObjectIdSchema,
    moodVideoId: optionalObjectIdSchema, // Lọc theo Canvas

    lyricType: z.enum(["none", "plain", "synced", "karaoke"]).optional(),
    status: z.enum(["pending", "ready", "failed", "processing"]).optional(),
    sort: z
      .enum(["newest", "oldest", "popular", "name", "trending"])
      .default("newest"),
  }),
});

// --- EXPORT TYPES ---
export type CreateTrackInput = z.infer<typeof createTrackSchema>["body"];
export type UpdateTrackInput = z.infer<typeof updateTrackSchema>["body"];
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>["body"];
export type BulkUpdateTrackInput = z.infer<
  typeof bulkUpdateTracksSchema
>["body"];
export type TrackFilterInput = z.infer<typeof getTracksSchema>["query"];
