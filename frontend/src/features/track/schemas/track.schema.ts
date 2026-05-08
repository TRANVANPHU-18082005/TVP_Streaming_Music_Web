// features/track/schemas/track.schema.ts
import { z } from "zod";
import {
  audioFileSchema,
  booleanSchema,
  emptyToUndefined,
  featuringArtistsSchema,
  formDataArrayHelper,
  genreIdsSchema,
  imageFileSchema,
  nullableObjectIdSchema,
  objectIdSchema,
  optionalObjectIdSchema,
  optionalString,
  tagsSchema,
} from "@/utils/base-validate";
import { APP_CONFIG } from "@/config/constants";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
export const TRACK_SORT_OPTIONS = [
  "newest",
  "oldest",
  "popular",
  "name",
  "trending",
] as const;

export const TRACK_STATUS_OPTIONS = [
  "pending",
  "processing",
  "ready",
  "failed",
] as const;

export const LYRIC_TYPES = ["none", "plain", "synced", "karaoke"] as const;

export type TrackSortOption = (typeof TRACK_SORT_OPTIONS)[number];
export type TrackStatus = (typeof TRACK_STATUS_OPTIONS)[number];
export type LyricType = (typeof LYRIC_TYPES)[number];

const trackSortSchema = z.enum(TRACK_SORT_OPTIONS);
const trackStatusSchema = z.enum(TRACK_STATUS_OPTIONS);
const lyricTypeSchema = z.enum(LYRIC_TYPES);

// ─────────────────────────────────────────────────────────────────────────────
// SHARED BASE SCHEMA
// ─────────────────────────────────────────────────────────────────────────────
const trackBaseSchema = z.object({
  // ── 1. THÔNG TIN CHÍNH ────────────────────────────────────────────────────
  title: z
    .string()
    .trim()
    .min(1, "Tiêu đề là bắt buộc")
    .max(200, "Tiêu đề không được vượt quá 200 ký tự"),

  description: optionalString(200, "Mô tả không được vượt quá 200 ký tự"),

  // ── 2. LIÊN KẾT (RELATIONS) ───────────────────────────────────────────────
  artistId: objectIdSchema, // Bắt buộc

  featuringArtistIds: featuringArtistsSchema.default([]),

  albumId: nullableObjectIdSchema, // Có thể null

  genreIds: genreIdsSchema, // Bắt buộc, ít nhất 1 thể loại

  // ── 3. CANVAS MOOD VIDEO ──────────────────────────────────────────────────
  moodVideoId: nullableObjectIdSchema,

  // ── 4. TRACK INFO ─────────────────────────────────────────────────────────
  trackNumber: z.coerce.number().int().min(1).default(1),

  diskNumber: z.coerce.number().int().min(1).default(1),

  releaseDate: z
    .preprocess(
      emptyToUndefined,
      z.coerce.date().transform((d) => d.toISOString()),
    )
    .optional(),

  isExplicit: booleanSchema.default(false),

  isPublic: booleanSchema.default(true),

  copyright: optionalString(500, "Bản quyền không được vượt quá 500 ký tự"),

  isrc: z
    .preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .max(30, "Mã ISRC không được vượt quá 30 ký tự")
        .refine(
          (v) => !v || /^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(v),
          "Mã ISRC không hợp lệ (VD: USRC17607839)",
        )
        .optional(),
    )
    .optional(),

  // ── 5. TAGS CẢM XÚC ───────────────────────────────────────────────────────
  tags: tagsSchema, // Bắt buộc, ít nhất 1 tag

  // ── 6. LYRICS ─────────────────────────────────────────────────────────────
  lyricType: lyricTypeSchema.default("none"),

  plainLyrics: z
    .string()
    .max(10000, "Lời bài hát không được vượt quá 10,000 ký tự")
    .optional(),

  // ── 7. DURATION ───────────────────────────────────────────────────────────
  duration: z.coerce.number().int().min(0).default(0),
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATE SCHEMA
// ─────────────────────────────────────────────────────────────────────────────
export const trackCreateSchema = trackBaseSchema
  .extend({
    audio: audioFileSchema, // Bắt buộc khi tạo
    coverImage: imageFileSchema.optional(),
  })
  .superRefine((data, ctx) => {
    // Business rule: ngày phát hành không được ở tương lai khi công khai ngay
    if (data.isPublic && data.releaseDate) {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (new Date(data.releaseDate) > today) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["releaseDate"],
          message:
            "Bài hát công khai không thể có ngày phát hành trong tương lai",
        });
      }
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// EDIT SCHEMA — partial fields, audio/image có thể là URL cũ hoặc File mới
// ─────────────────────────────────────────────────────────────────────────────
export const trackEditSchema = trackBaseSchema
  .omit({ duration: true }) // Duration không update trực tiếp từ FE
  .extend({
    audio: z
      .union([
        audioFileSchema,
        z.string().url("Đường dẫn nhạc không hợp lệ"),
        z.null(),
      ])
      .optional(),
    coverImage: z
      .union([
        z.string().url("Đường dẫn ảnh không hợp lệ"),
        imageFileSchema,
        z.null(),
      ])
      .optional(),
  })
  .partial()
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Phải có ít nhất một trường để cập nhật",
  });

// ─────────────────────────────────────────────────────────────────────────────
// URL PARAMS SCHEMA — User view
// ─────────────────────────────────────────────────────────────────────────────
export const trackParamsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),

  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(APP_CONFIG.VIRTUALIZER_LIMIT || 50)
    .catch(APP_CONFIG.VIRTUALIZER_LIMIT || 50),

  keyword: z
    .preprocess(
      (val) => (val === "" ? undefined : val),
      z.string().trim().max(100).optional(),
    )
    .catch(undefined),

  sort: trackSortSchema.catch("newest"),

  artistId: optionalObjectIdSchema,
  albumId: optionalObjectIdSchema,
  genreId: optionalObjectIdSchema,
  moodVideoId: optionalObjectIdSchema,

  isPublic: booleanSchema.optional(),
  isDeleted: booleanSchema.optional(),
  lyricType: z
    .preprocess(emptyToUndefined, lyricTypeSchema.optional())
    .catch(undefined),
  status: z
    .preprocess(emptyToUndefined, trackStatusSchema.optional())
    .catch(undefined),
});

// ─────────────────────────────────────────────────────────────────────────────
// BULK UPDATE SCHEMA — Cập nhật hàng loạt (matching backend bulkUpdateTracksSchema)
// ─────────────────────────────────────────────────────────────────────────────
export const bulkTrackUpdateSchema = z.object({
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
      isExplicit: booleanSchema.optional(),
      moodVideoId: nullableObjectIdSchema.optional(),
      status: trackStatusSchema.optional(),
      copyright: optionalString(
        500,
        "Bản quyền không được vượt quá 500 ký tự",
      ).optional(),
      isrc: z
        .preprocess(
          emptyToUndefined,
          z
            .string()
            .trim()
            .max(30, "Mã ISRC không được vượt quá 30 ký tự")
            .refine(
              (v) => !v || /^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(v),
              "Mã ISRC không hợp lệ (VD: USRC17607839)",
            )
            .optional(),
        )
        .optional(),
    })
    .refine(
      (data) => Object.values(data).some((val) => val !== undefined),
      "Phải chọn ít nhất một thông tin để cập nhật",
    ),
});

export const bulkTrackUpdateFormSchema = bulkTrackUpdateSchema.shape.updates;

// ─────────────────────────────────────────────────────────────────────────────
// BULK RETRY SCHEMA — Retry processing failed tracks
// ─────────────────────────────────────────────────────────────────────────────
export const bulkTrackRetrySchema = z.object({
  trackIds: formDataArrayHelper(objectIdSchema).refine(
    (ids) => ids.length >= 1,
    "Vui lòng chọn ít nhất 1 bài hát",
  ),
});

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE STATUS SCHEMA — Update track processing status (Admin only)
// ─────────────────────────────────────────────────────────────────────────────
export const trackChangeStatusSchema = z.object({
  status: trackStatusSchema,
  errorReason: optionalString(500, "Lý do lỗi không được vượt quá 500 ký tự"),
});

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const trackItemSchema = z.object({
  _id: z.string(),
  title: z.string(),
  artistId: z.string(),
  albumId: z.string().nullable().optional(),
  status: trackStatusSchema,
  duration: z.number(),
  updatedAt: z.string(),
});

export const trackDetailSchema = trackItemSchema.extend({
  description: z.string().nullable().optional(),
  genreIds: z.array(z.string()),
  featuringArtistIds: z.array(z.string()).default([]),
  moodVideoId: z.string().nullable().optional(),
  trackNumber: z.number(),
  diskNumber: z.number(),
  releaseDate: z.string().optional(),
  isExplicit: z.boolean(),
  isPublic: z.boolean(),
  copyright: z.string().nullable().optional(),
  isrc: z.string().nullable().optional(),
  tags: z.array(z.string()),
});

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
export type TrackCreateFormValues = z.infer<typeof trackCreateSchema>;
export type TrackEditFormValues = z.infer<typeof trackEditSchema>;
export type TrackFormValues = TrackCreateFormValues | TrackEditFormValues;
export type TrackFilterParams = Partial<z.infer<typeof trackParamsSchema>>;

export type BulkTrackUpdateFormValues = z.infer<
  typeof bulkTrackUpdateFormSchema
>;
export type BulkTrackFormValues = BulkTrackUpdateFormValues;
export type BulkTrackRetryFormValues = z.infer<typeof bulkTrackRetrySchema>;
export type TrackChangeStatusFormValues = z.infer<
  typeof trackChangeStatusSchema
>;
export type TrackItem = z.infer<typeof trackItemSchema>;
export type TrackDetail = z.infer<typeof trackDetailSchema>;
