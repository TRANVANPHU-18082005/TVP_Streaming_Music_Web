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
    title: z.string().trim().min(1, "Tiêu đề là bắt buộc").max(150),
    description: z.string().max(2000).optional(),

    artistId: objectIdSchema,
    featuringArtistIds: featuringArtistsSchema.optional(), // Đã là array helper
    albumId: nullableObjectIdSchema,
    genreIds: genreIdsSchema,

    trackNumber: z.coerce.number().min(1).default(1),
    diskNumber: z.coerce.number().min(1).default(1),

    // Fix lỗi Invalid Date khi rỗng
    releaseDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),

    isExplicit: booleanSchema.default(false),

    copyright: z.string().trim().max(200).optional(),
    isrc: z.string().trim().max(20).optional(),
    lyrics: z.string().optional(),
    tags: tagsSchema.optional(),

    duration: z.coerce.number().min(0).default(0),
    isPublic: booleanSchema.default(true), // Bắt buộc hoặc có default
  }),
});

// --- 2. UPDATE TRACK SCHEMA ---
export const updateTrackSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    title: z.string().trim().min(1).max(150).optional(),
    description: z.string().max(2000).optional(),
    isPublic: booleanSchema.optional(),

    albumId: nullableObjectIdSchema,
    genreIds: genreIdsSchema.optional(),
    featuringArtistIds: featuringArtistsSchema.optional(),
    tags: tagsSchema.optional(),

    trackNumber: z.coerce.number().min(1).optional(),
    diskNumber: z.coerce.number().min(1).optional(),
    releaseDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),

    isExplicit: booleanSchema.optional(),
    copyright: z.string().trim().max(200).optional(),
    isrc: z.string().trim().max(20).optional(),
    lyrics: z.string().optional(),
    duration: z.coerce.number().min(0).optional(),
  }),
});

// --- 3. CHANGE STATUS SCHEMA ---
export const changeStatusSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    status: z.enum(["pending", "ready", "failed", "processing"]),
  }),
});

// --- 4. BULK UPDATE SCHEMA ---
export const bulkUpdateTracksSchema = z.object({
  body: z.object({
    trackIds: formDataArrayHelper(objectIdSchema)
      .refine((ids) => ids.length >= 1, {
        message: "Vui lòng chọn ít nhất 1 bài hát",
      })
      .refine((ids) => ids.length <= 100, {
        message: "Giới hạn chỉnh sửa tối đa 100 bài",
      }),

    updates: z
      .object({
        albumId: nullableObjectIdSchema.optional(),
        genreIds: genreIdsSchema.optional(),
        tags: tagsSchema.optional(),
        isPublic: booleanSchema.optional(),
        status: z.enum(["pending", "ready", "failed", "processing"]).optional(),
      })
      .refine(
        (data) => Object.values(data).some((value) => value !== undefined),
        { message: "Phải chọn ít nhất một thông tin để cập nhật" },
      ),
  }),
});

// --- 5. GET TRACKS SCHEMA (Filter) ---
export const getTracksSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10),
    keyword: z.preprocess(emptyToUndefined, z.string().trim().optional()),

    artistId: optionalObjectIdSchema,
    albumId: optionalObjectIdSchema,
    genreId: optionalObjectIdSchema,

    status: z.enum(["pending", "ready", "failed", "processing"]).optional(),
    sort: z.enum(["newest", "oldest", "popular", "name"]).default("newest"),
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
