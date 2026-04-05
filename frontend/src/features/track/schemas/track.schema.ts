// ==========================================
// MAIN SCHEMAS
// ==========================================

/**
 * SCHEMA: Tạo / Cập nhật 1 bài hát
 */
import { z } from "zod";

// ==========================================
// CONSTANTS & RULES
// ==========================================
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

// ==========================================
// REUSABLE SCHEMAS
// ==========================================
// 3. Schema cho Tags & Thể loại
const tagsSchema = z
  .array(z.string().trim().max(30, "Mỗi tag tối đa 30 ký tự"))
  .max(20, "Chỉ được thêm tối đa 20 tags")
  .default([]);

const genreIdsSchema = z
  .array(z.string().trim())
  .min(1, "Vui lòng chọn ít nhất 1 thể loại")
  .max(10, "Chỉ chọn tối đa 10 thể loại");

// 4. Schema cho Image
const imageSchema = z
  .union([
    z
      .instanceof(File)
      .refine((file) => file.size <= MAX_IMAGE_SIZE, "Ảnh cover tối đa 5MB")
      .refine(
        (file) => ACCEPTED_IMAGE_TYPES.includes(file.type),
        "Định dạng ảnh không hỗ trợ (Chỉ nhận JPG, PNG, WEBP)",
      ),
    z.string().url("Đường dẫn ảnh không hợp lệ"),
    z.null(),
  ])
  .optional()
  .nullable();

const relationIdSchema = z
  .string()
  .trim()
  .transform((val) =>
    val === "" || val === "null" || val === "undefined" ? null : val,
  )
  .nullable()
  .optional();

const optionalTextSchema = (maxLength: number, errorMsg: string) =>
  z
    .string()
    .trim()
    .max(maxLength, errorMsg)
    .optional()
    .nullable()
    .transform((val) => (val === "" ? undefined : val));

// ==========================================
// MAIN TRACK SCHEMA
// ==========================================

export const trackSchema = z.object({
  // --- 1. BASIC INFO ---
  title: z
    .string({ required_error: "Vui lòng nhập tên bài hát" })
    .trim()
    .min(1, "Tên bài hát không được để trống")
    .max(200, "Tên bài hát tối đa 200 ký tự"),

  description: optionalTextSchema(2000, "Mô tả tối đa 2000 ký tự"),

  // --- 2. UPGRADE: LYRIC MANAGEMENT ---
  // Cho phép Admin chọn loại Lyric: none (ko lời), plain (thô), synced (lời khớp dòng)
  lyricType: z.enum(["none", "plain", "synced", "karaoke"]).default("none"),

  // Lời bài hát thô (Dùng để hiển thị hoặc để Worker parse nếu chọn synced/plain)
  plainLyrics: optionalTextSchema(15000, "Lời bài hát quá dài"),

  // --- 3. RELATIONSHIPS ---
  artistId: z.string().trim().min(1, "Vui lòng chọn Nghệ sĩ chính"),

  featuringArtistIds: z.array(z.string().trim()).default([]),

  albumId: relationIdSchema,

  genreIds: z.array(z.string().trim()).min(1, "Chọn ít nhất 1 thể loại"),

  // --- 4. UPGRADE: VISUAL CANVAS (MOOD VIDEO) ---
  // ID của video canvas cụ thể. Nếu để null, Worker sẽ tự khớp theo tags.
  moodVideoId: relationIdSchema,

  // --- 5. METADATA & TAGS ---
  // Tags rất quan trọng để Worker v2.0 tự động gán Canvas
  tags: z
    .array(z.string().trim().max(30))
    .min(
      1,
      "Thêm ít nhất 1 tag cảm xúc (ví dụ: buồn, lofi, chill) để hệ thống tự khớp Canvas",
    )
    .default([]),

  releaseDate: z.string().default(() => new Date().toISOString()),
  isExplicit: z.boolean().default(false),
  isPublic: z.boolean().default(true),

  trackNumber: z.coerce.number().int().min(1).default(1),
  diskNumber: z.coerce.number().int().min(1).default(1),

  // --- 6. ADVANCED ---
  copyright: optionalTextSchema(500, "Thông tin bản quyền quá dài"),
  isrc: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val === "" ? undefined : val))
    .refine(
      (val) => val === undefined || /^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(val),
      "Mã ISRC không hợp lệ",
    ),

  // --- 7. FILES ---
  // audio: Bắt buộc khi tạo mới, optional khi update
  audio: z
    .union([z.instanceof(File), z.string(), z.null()])
    .optional()
    .refine((file) => {
      if (file instanceof File) return file.size <= MAX_AUDIO_SIZE;
      return true;
    }, "File nhạc tối đa 100MB")
    .refine((file) => {
      if (file instanceof File) return ACCEPTED_AUDIO_TYPES.includes(file.type);
      return true;
    }, "Định dạng âm thanh không hỗ trợ"),

  coverImage: z
    .union([
      z
        .instanceof(File)
        .refine((f) => f.size <= MAX_IMAGE_SIZE, "Ảnh tối đa 5MB"),
      z.string().url(),
      z.null(),
    ])
    .optional()
    .nullable(),
});

/**
 * SCHEMA: Cập nhật hàng loạt (Bulk Edit)
 */
export const bulkTrackSchema = z.object({
  // Đều là optional, nếu Client không gửi -> Giữ nguyên trong DB
  genreIds: genreIdsSchema.optional(),

  tags: tagsSchema.optional(),

  releaseDate: z.string().datetime("Ngày phát hành không hợp lệ").optional(),

  isPublic: z.boolean().optional(),
  isExplicit: z.boolean().optional(),

  // Cần dùng relationIdSchema để hỗ trợ hành động: Gửi null/"" để gỡ bài khỏi Album
  albumId: relationIdSchema,

  featuringArtistIds: z
    .array(z.string().trim())
    .max(20, "Tối đa 20 nghệ sĩ hợp tác")
    .optional(),

  coverImage: imageSchema,
});

export type BulkTrackFormValues = z.infer<typeof bulkTrackSchema>;
export type TrackFormValues = z.infer<typeof trackSchema>;
