// features/genre/schemas/genre.schema.ts
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/svg+xml",
] as const;
export const GENRE_SORT_OPTIONS = [
  "newest",
  "oldest",
  "popular",
  "name",
] as const;
export const GENRE_STATUS_OPTIONS = ["active", "inactive"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// 2. REUSABLE PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────
const optionalString = (maxLen: number, maxMsg: string) =>
  z
    .string()
    .trim()
    .max(maxLen, maxMsg)
    .optional()
    .nullable()
    .transform((val) => (val === "" ? undefined : val) ?? undefined);

const imageFileSchema = z
  .instanceof(File)
  .refine((f) => f.size <= MAX_FILE_SIZE, "Kích thước ảnh tối đa 2MB")
  .refine(
    (f) => ACCEPTED_IMAGE_TYPES.includes(f.type as any),
    "Chỉ nhận .jpg, .jpeg, .png, .webp hoặc .svg",
  );

// ─────────────────────────────────────────────────────────────────────────────
// 3. SHARED BASE SCHEMA
// ─────────────────────────────────────────────────────────────────────────────
const genreBaseSchema = z.object({
  name: z
    .string({ required_error: "Vui lòng nhập tên thể loại" })
    .trim()
    .min(2, "Tên tối thiểu 2 ký tự")
    .max(50, "Tên tối đa 50 ký tự"),
  description: optionalString(200, "Mô tả tối đa 200 ký tự"),
  color: z
    .string()
    .trim()
    .regex(/^#([0-9A-F]{3}){1,2}$/i, "Mã màu HEX không hợp lệ")
    .default("#1db954"),
  gradient: optionalString(500, "Gradient quá dài"),
  parentId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) =>
      val === "" || val === "null" || val === "undefined" ? null : val,
    ),
  priority: z.coerce
    .number()
    .int()
    .min(0, "Tối thiểu là 0")
    .max(100, "Tối đa là 100")
    .default(0),
  isTrending: z.boolean().default(false),
  isActive: z.boolean().default(true), // Trường status thực tế trong DB
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. CREATE / EDIT / PARAMS SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const genreCreateSchema = genreBaseSchema.extend({
  image: imageFileSchema.optional(),
});

export const genreEditSchema = genreBaseSchema.extend({
  image: z
    .union([z.string().url("Link ảnh không hợp lệ"), imageFileSchema, z.null()])
    .optional(),
});

/** Params cho URL - Có tính năng Self-healing (Tự sửa lỗi) */
export const genreParamsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(20),
  sort: z.enum(GENRE_SORT_OPTIONS).catch("name"),
  keyword: z.string().trim().optional().catch(undefined),
  isTrending: z
    .preprocess(
      (val) => (val === "true" ? true : val === "false" ? false : undefined),
      z.boolean().optional(),
    )
    .catch(undefined),
  parentId: z.string().trim().optional().catch(undefined),
  status: z.enum(GENRE_STATUS_OPTIONS).optional().catch(undefined), // Dùng cho Filter UI
});

// TYPES
export type GenreCreateFormValues = z.infer<typeof genreCreateSchema>;
export type GenreEditFormValues = z.infer<typeof genreEditSchema>;
export type GenreFilterParams = z.infer<typeof genreParamsSchema>;
