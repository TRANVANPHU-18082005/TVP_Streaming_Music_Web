// features/album/schemas/albumSchema.ts
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const ALBUM_TYPES = ["album", "single", "ep", "compilation"] as const;
export const ALBUM_SORT_OPTIONS = [
  "newest",
  "oldest",
  "popular",
  "name",
] as const;
export const ALBUM_FILTER_TYPES = [...ALBUM_TYPES, "all"] as const;

export type AlbumType = (typeof ALBUM_TYPES)[number];
export type AlbumSortOption = (typeof ALBUM_SORT_OPTIONS)[number];
export type AlbumFilterType = (typeof ALBUM_FILTER_TYPES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE PRIMITIVES — tái sử dụng để tránh duplicate logic
// ─────────────────────────────────────────────────────────────────────────────

/** Chuỗi optional: trim, coerce "" → undefined */
const optionalString = (maxLen: number, maxMsg: string) =>
  z
    .string()
    .trim()
    .max(maxLen, maxMsg)
    .optional()
    .nullable()
    .transform((val) => (val === "" ? undefined : val) ?? undefined);

/** Validate File ảnh (chỉ dùng khi biết chắc là File instance) */
const imageFileSchema = z
  .instanceof(File)
  .refine((f) => f.size <= MAX_FILE_SIZE, "Kích thước ảnh tối đa là 5MB")
  .refine(
    (f) =>
      ACCEPTED_IMAGE_TYPES.includes(
        f.type as (typeof ACCEPTED_IMAGE_TYPES)[number],
      ),
    "Chỉ chấp nhận các định dạng .jpg, .jpeg, .png, .webp",
  );

// ─────────────────────────────────────────────────────────────────────────────
// SHARED BASE — các field giống nhau giữa Create & Edit
// ─────────────────────────────────────────────────────────────────────────────
const albumBaseSchema = z.object({
  // ── 1. THÔNG TIN CHÍNH ────────────────────────────────────────────────────
  title: z
    .string({ required_error: "Vui lòng nhập tên album" })
    .trim()
    .min(1, "Tên album không được để trống")
    .max(100, "Tên album không được vượt quá 100 ký tự"),

  description: optionalString(2000, "Mô tả không được vượt quá 2000 ký tự"),

  type: z
    .enum(ALBUM_TYPES, { invalid_type_error: "Loại đĩa không hợp lệ" })
    .default("album"),

  // ── 2. LIÊN KẾT (RELATIONS) ───────────────────────────────────────────────
  artist: z
    .string({ required_error: "Vui lòng chọn nghệ sĩ" })
    .trim()
    .min(1, "Vui lòng chọn nghệ sĩ"),

  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Tag không được để trống")
        .max(30, "Mỗi tag tối đa 30 ký tự"),
    )
    .max(10, "Chỉ được nhập tối đa 10 tags")
    .default([]),

  // ── 3. GIAO DIỆN ──────────────────────────────────────────────────────────
  themeColor: z
    .string()
    .trim()
    .regex(/^#([0-9A-F]{3}){1,2}$/i, "Mã màu HEX không hợp lệ (VD: #1db954)")
    .default("#1db954"),

  releaseDate: z
    .string({ required_error: "Vui lòng chọn ngày phát hành" })
    .trim()
    .min(1, "Vui lòng chọn ngày phát hành")
    .pipe(z.coerce.date({ invalid_type_error: "Định dạng ngày không hợp lệ" }))
    .transform((d) => d.toISOString().split("T")[0]),
  // ── 5. CÀI ĐẶT ────────────────────────────────────────────────────────────
  isPublic: z.boolean().default(false),
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATE SCHEMA — coverImage bắt buộc phải là File
// ─────────────────────────────────────────────────────────────────────────────
export const albumCreateSchema = albumBaseSchema
  .extend({
    coverImage: imageFileSchema.optional(), // optional khi tạo mới (có thể bỏ qua)
  })
  .superRefine((data, ctx) => {
    // Business rule: releaseDate không được ở tương lai khi publish ngay
    if (data.isPublic) {
      const today = new Date();
      today.setHours(23, 59, 59, 999); // end of today
      if (data.releaseDate && new Date(data.releaseDate) > today) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["releaseDate"],
          message:
            "Album công khai không thể có ngày phát hành trong tương lai",
        });
      }
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// EDIT SCHEMA — coverImage có thể là URL string (ảnh cũ) hoặc File mới
// ─────────────────────────────────────────────────────────────────────────────
export const albumEditSchema = albumBaseSchema.extend({
  /**
   * Edit mode: server trả về URL string, user có thể upload File mới.
   * - string  → URL ảnh cũ, giữ nguyên
   * - File    → ảnh mới, validate size + type
   * - null / undefined → xoá ảnh (nếu nghiệp vụ cho phép)
   */
  coverImage: z
    .union([
      z.string().url("Đường dẫn ảnh bìa không hợp lệ"),
      imageFileSchema,
      z.null(),
    ])
    .optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// URL PARAMS SCHEMA — dùng .catch() thay .default() để silent fallback
// khi user tamper URL, không crash app
// ─────────────────────────────────────────────────────────────────────────────
export const albumParamsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(10),

  keyword: z
    .preprocess(
      (val) => (val === "" ? undefined : val),
      z.string().trim().max(100).optional(),
    )
    .catch(undefined),

  sort: z.enum(ALBUM_SORT_OPTIONS).catch("newest"),
  type: z.enum(ALBUM_FILTER_TYPES).optional().catch(undefined),

  // 🔥 FIX BOOLEAN: Không dùng coerce trực tiếp
  isPublic: z
    .preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .catch(undefined),

  artistId: z.string().trim().optional().catch(undefined),
  genreId: z.string().trim().optional().catch(undefined),
  year: z.coerce.number().int().min(1900).max(2100).optional().catch(undefined),
});

// ─────────────────────────────────────────────────────────────────────────────
// API RESPONSE SCHEMAS — validate shape từ server, tránh runtime crash
// dùng safeParse() để degrade gracefully thay vì throw
// ─────────────────────────────────────────────────────────────────────────────
export const albumItemSchema = z.object({
  _id: z.string(),
  title: z.string(),
  type: z.enum(ALBUM_TYPES),
  coverImage: z.string().url().nullable().optional(),
  themeColor: z.string().optional(),
  releaseDate: z.string(),
  isPublic: z.boolean(),
  playCount: z.coerce.number().nonnegative().default(0),
  likeCount: z.coerce.number().nonnegative().default(0),
  artist: z.object({
    _id: z.string(),
    name: z.string(),
    avatar: z.string().url().nullable().optional(),
  }),
  genres: z.array(z.object({ _id: z.string(), name: z.string() })).default([]),
});

export const albumDetailSchema = albumItemSchema.extend({
  description: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  copyright: z.string().nullable().optional(),
  upc: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  tracks: z
    .array(
      z.object({
        _id: z.string(),
        title: z.string(),
        duration: z.coerce.number().nonnegative().default(0),
        audioUrl: z.string().url().optional(),
      }),
    )
    .default([]),
});

export const albumListResponseSchema = z.object({
  albums: z.array(albumItemSchema),
  meta: z.object({
    page: z.coerce.number(),
    pageSize: z.coerce.number(),
    totalItems: z.coerce.number(),
    totalPages: z.coerce.number(),
  }),
});

// Infer types từ response schemas
export type AlbumItem = z.infer<typeof albumItemSchema>;
export type AlbumDetail = z.infer<typeof albumDetailSchema>;
export type AlbumListResponse = z.infer<typeof albumListResponseSchema>;
export type AlbumCreateFormValues = z.infer<typeof albumCreateSchema>;
export type AlbumEditFormValues = z.infer<typeof albumEditSchema>;
export type AlbumFormValues = AlbumCreateFormValues | AlbumEditFormValues;
export type AlbumFilterParamsSchemas = z.infer<typeof albumParamsSchema>;
