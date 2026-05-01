// features/track/schemas/track.schema.ts
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

const ACCEPTED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/flac",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
];
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

export const TRACK_SORT_OPTIONS = [
  "newest",
  "oldest",
  "popular",
  "name",
] as const;
export const TRACK_STATUS_OPTIONS = [
  "pending",
  "processing",
  "ready",
  "failed",
  "all",
] as const;
export const LYRIC_TYPES = ["none", "plain", "synced", "karaoke"] as const;

const optionalText = (maxLen: number, msg: string) =>
  z
    .string()
    .trim()
    .max(maxLen, msg)
    .optional()
    .nullable()
    .transform((val) => (val === "" ? undefined : val) ?? undefined);

const relationId = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((val) =>
    val === "" || val === "null" || val === "undefined" ? null : val,
  );

// ─────────────────────────────────────────────────────────────────────────────
// 2. FILE SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
const audioFileSchema = z
  .instanceof(File)
  .refine((f) => f.size <= MAX_AUDIO_SIZE, "File nhạc tối đa 100MB")
  .refine(
    (f) => ACCEPTED_AUDIO_TYPES.includes(f.type),
    "Định dạng âm thanh không hỗ trợ",
  );

const imageFileSchema = z
  .instanceof(File)
  .refine((f) => f.size <= MAX_IMAGE_SIZE, "Ảnh cover tối đa 5MB")
  .refine(
    (f) => ACCEPTED_IMAGE_TYPES.includes(f.type),
    "Chỉ nhận JPG, PNG, WEBP",
  );

// ─────────────────────────────────────────────────────────────────────────────
// 3. SHARED BASE SCHEMA
// ─────────────────────────────────────────────────────────────────────────────
const trackBaseSchema = z.object({
  title: z
    .string({ required_error: "Vui lòng nhập tên bài hát" })
    .trim()
    .min(1, "Không được để trống")
    .max(200),
  description: optionalText(2000, "Mô tả tối đa 2000 ký tự"),
  lyricType: z.enum(LYRIC_TYPES).default("none"),
  plainLyrics: optionalText(15000, "Lời bài hát quá dài"),

  artistId: z.string().trim().min(1, "Vui lòng chọn Nghệ sĩ chính"),
  featuringArtistIds: z.array(z.string().trim()).default([]),
  albumId: relationId,
  genreIds: z.array(z.string().trim()).min(1, "Chọn ít nhất 1 thể loại"),
  moodVideoId: relationId,

  tags: z
    .array(z.string().trim().max(30))
    .min(1, "Thêm ít nhất 1 tag cảm xúc (buồn, chill...)")
    .default([]),

  releaseDate: z.string().default(() => new Date().toISOString()),
  isExplicit: z.boolean().default(false),
  isPublic: z.boolean().default(true),
  trackNumber: z.coerce.number().int().min(1).default(1),
  diskNumber: z.coerce.number().int().min(1).default(1),

  copyright: optionalText(500, "Thông tin bản quyền quá dài"),
  isrc: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v === "" ? undefined : v))
    .refine(
      (v) => !v || /^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(v),
      "Mã ISRC không hợp lệ",
    ),
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. CREATE / EDIT / PARAMS
// ─────────────────────────────────────────────────────────────────────────────

export const trackCreateSchema = trackBaseSchema.extend({
  audio: audioFileSchema, // Bắt buộc khi tạo
  coverImage: imageFileSchema.optional(),
});

export const trackEditSchema = trackBaseSchema.extend({
  // Khi sửa: Audio có thể là URL cũ (string) hoặc File mới
  audio: z.union([audioFileSchema, z.string().url(), z.null()]).optional(),
  coverImage: z.union([imageFileSchema, z.string().url(), z.null()]).optional(),
});

export const trackParamsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(10),
  sort: z.enum(TRACK_SORT_OPTIONS).catch("newest"),
  status: z.enum(TRACK_STATUS_OPTIONS).optional().catch(undefined),
  keyword: z.string().trim().optional().catch(undefined),
  artistId: z.string().trim().optional().catch(undefined),
  albumId: z.string().trim().optional().catch(undefined),
  genreId: z.string().trim().optional().catch(undefined),
});
// features/track/schemas/track.schema.ts (Phần tiếp theo)

/**
 * SCHEMA: Cập nhật hàng loạt (Bulk Edit)
 * Dùng khi Admin chọn nhiều bài hát và muốn đổi chung Thể loại, Album hoặc Tag.
 */
export const bulkTrackSchema = z.object({
  // 1. Phân loại & Tags (Cho phép gửi mảng mới để ghi đè)
  genreIds: z
    .array(z.string().trim())
    .min(1, "Chọn ít nhất 1 thể loại")
    .max(10, "Tối đa 10 thể loại")
    .optional(),

  tags: z.array(z.string().trim().max(30)).max(20, "Tối đa 20 tags").optional(),

  // 2. Metadata chung
  releaseDate: z
    .string()
    .pipe(z.coerce.date())
    .transform((d) => d.toISOString().split("T")[0])
    .optional(),

  isPublic: z.boolean().optional(),
  isExplicit: z.boolean().optional(),

  // 3. Relationships (Quan trọng: Dùng relationId để có thể gỡ bài khỏi Album bằng cách gửi null)
  albumId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) =>
      val === "" || val === "null" || val === "undefined" ? null : val,
    ),

  moodVideoId: relationId.optional(),

  artistId: z.string().trim().optional(), // Đổi chủ sở hữu hàng loạt (ít dùng nhưng nên có)

  featuringArtistIds: z
    .array(z.string().trim())
    .max(20, "Tối đa 20 nghệ sĩ hợp tác")
    .optional(),

  // 4. Media chung (Ví dụ thay ảnh bìa cho tất cả các bài trong 1 đĩa đơn)
  coverImage: z
    .union([
      z
        .instanceof(File)
        .refine((f) => f.size <= 5 * 1024 * 1024, "Ảnh tối đa 5MB"),
      z.string().url("Link ảnh không hợp lệ"),
      z.null(),
    ])
    .optional(),
});

export type BulkTrackFormValues = z.infer<typeof bulkTrackSchema>;
export type TrackCreateFormValues = z.infer<typeof trackCreateSchema>;
export type TrackEditFormValues = z.infer<typeof trackEditSchema>;
export type TrackFilterParams = z.infer<typeof trackParamsSchema>;
