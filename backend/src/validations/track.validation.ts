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
import { APP_CONFIG } from "../config/constants";

// Enums used across queries and payloads
const lyricTypeEnum = z.enum(["none", "plain", "synced", "karaoke"]);
const trackStatusEnum = z.enum(["pending", "ready", "failed", "processing"]);
const trackSortEnum = z.enum([
  "newest",
  "oldest",
  "popular",
  "name",
  "trending",
]);

// --- 1. CREATE TRACK SCHEMA ---
export const createTrackSchema = z.object({
  body: z
    .object({
      title: z
        .string()
        .trim()
        .min(1, "Tiêu đề là bắt buộc")
        .max(200, "Tiêu đề không được vượt quá 200 ký tự"),
      description: z
        .string()
        .max(200, "Mô tả không được vượt quá 200 ký tự")
        .optional(),

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
      lyricType: lyricTypeEnum.default("none"),
      plainLyrics: z.string().optional(), // Chỉ dùng khi lyricType là "plain"
      // Duration sẽ được Worker tính lại, nhưng FE gửi lên để hiển thị tạm thời
      duration: z.coerce.number().min(0).default(0),
    })
    .strict(),
});

// --- 2. UPDATE TRACK SCHEMA ---
export const updateTrackSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z
    .object({
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
      lyricType: lyricTypeEnum.optional(),
      plainLyrics: z.string().optional(),
      duration: z.coerce.number().min(0).optional(),
    })
    .strict()
    .refine(
      (data) => Object.values(data).some((v) => v !== undefined),
      "Phải cung cấp ít nhất một trường để cập nhật",
    ),
});

// --- 3. CHANGE STATUS SCHEMA ---
export const changeStatusSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z
    .object({
      status: trackStatusEnum,
      errorReason: z.string().optional(), // Lưu lý do nếu failed
    })
    .strict(),
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
        status: trackStatusEnum.optional(),
      })
      .refine(
        (data) => Object.values(data).some((val) => val !== undefined),
        "Phải chọn ít nhất một thông tin để cập nhật",
      ),
  }),
});

// --- BULK RETRY SCHEMA (Admin) ---
export const bulkRetryTracksSchema = z.object({
  body: z.object({
    trackIds: formDataArrayHelper(objectIdSchema).refine(
      (ids) => ids.length >= 1,
      "Vui lòng chọn ít nhất 1 bài hát",
    ),
  }),
});

// --- 5. GET TRACKS SCHEMA (Filter nâng cao) ---
export const getTracksSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).max(APP_CONFIG.MAX_PAGES).default(1),
      limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(APP_CONFIG.TRACKS_LIMIT, "Limit quá lớn")
        .default(APP_CONFIG.VIRTUAL_SCROLL_LIMIT),
      keyword: z.preprocess(
        emptyToUndefined,
        z.string().trim().min(1).max(100).optional(),
      ),

      artistId: optionalObjectIdSchema,
      albumId: optionalObjectIdSchema,
      genreId: optionalObjectIdSchema,
      moodVideoId: optionalObjectIdSchema, // Lọc theo Canvas
      isPublic: booleanSchema.optional(),
      isDeleted: booleanSchema.optional(),
      lyricType: z.preprocess(emptyToUndefined, lyricTypeEnum.optional()),
      status: z.preprocess(emptyToUndefined, trackStatusEnum.optional()),
      sort: trackSortEnum.default("newest"),
    })
    .strict(),
});
// --- 6. DELETE TRACK SCHEMA ---
export const deleteTrackSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});
// --- 7. GET TRACK DETAIL SCHEMA ---
export const getTrackDetailSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});
// --- 8. PROCESS TRACK SCHEMA ---
export const processTrackSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});
// --- 9. PROCESS TRACK BULK SCHEMA ---
export const processTrackBulkSchema = z.object({
  body: z.object({
    trackIds: formDataArrayHelper(objectIdSchema).refine(
      (ids) => ids.length >= 1,
      "Vui lòng chọn ít nhất 1 bài hát",
    ),
  }),
});

// --- EXPORT TYPES ---
export type CreateTrackInput = z.infer<typeof createTrackSchema>["body"];
export type UpdateTrackInput = z.infer<typeof updateTrackSchema>["body"];
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>["body"];
export type BulkUpdateTrackInput = z.infer<
  typeof bulkUpdateTracksSchema
>["body"];
export type BulkRetryInput = z.infer<typeof bulkRetryTracksSchema>["body"];
export type ProcessTrackInput = z.infer<typeof processTrackSchema>["params"];
export type ProcessTrackBulkInput = z.infer<
  typeof processTrackBulkSchema
>["body"];
export type TrackFilterInput = z.infer<typeof getTracksSchema>["query"];

// --- 10. GET TOP TRACKS (Hot Today / Favourite) ---
export const getTopTracksSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).max(APP_CONFIG.MAX_PAGES).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export type TopTrackFilterInput = z.infer<typeof getTopTracksSchema>["query"];
