// features/genre/schemas/genre.schema.ts
import { APP_CONFIG } from "@/config/constants";
import {
  hexColorSchema,
  imageFileSchema,
  nullableObjectIdSchema,
  optionalString,
} from "@/utils/base-validate";
import { z } from "zod";
export const GENRE_SORT_OPTIONS = [
  "popular",
  "priority",
  "newest",
  "oldest",
  "name",
] as const;

export const GENRE_STATUS_OPTIONS = ["active", "inactive"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// 3. SHARED BASE SCHEMA
//    Mirrors createGenreSchema + updateGenreSchema body fields on the backend.
// ─────────────────────────────────────────────────────────────────────────────
const genreBaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Tên tối thiểu 2 ký tự")
    .max(50, "Tên tối đa 50 ký tự"),

  // Backend allows max 500 for description (not 200 as previously)
  description: optionalString(500, "Mô tả tối đa 500 ký tự"),

  color: hexColorSchema.default("#1db954"),

  gradient: optionalString(500, "Gradient quá dài"),

  // parentId: null = root, undefined = not provided, string = parent ObjectId
  parentId: z.preprocess((val) => {
    if (typeof val === "string") {
      const trimmed = val.trim();
      return trimmed === "" ||
        trimmed === "null" ||
        trimmed === "undefined" ||
        trimmed === "root"
        ? "root"
        : trimmed;
    }
    return val === null ? "root" : val;
  }, nullableObjectIdSchema.optional()),

  priority: z.coerce
    .number()
    .int()
    .min(0, "Tối thiểu là 0")
    .max(100, "Tối đa là 100")
    .default(0),

  isTrending: z.boolean().default(false),
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. CREATE SCHEMA
//    Maps → POST /genres  (body: CreateGenreInput)
// ─────────────────────────────────────────────────────────────────────────────
export const genreCreateSchema = genreBaseSchema.extend({
  /** Optional new file upload */
  image: imageFileSchema.optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. EDIT SCHEMA
//    Maps → PATCH /genres/:id  (body: UpdateGenreInput)
//    All fields optional; image may be existing URL, new File, or null (remove)
// ─────────────────────────────────────────────────────────────────────────────
export const genreEditSchema = genreBaseSchema
  .extend({
    image: z
      .union([
        z.string().url("Link ảnh không hợp lệ"),
        imageFileSchema,
        z.null(),
      ])
      .optional(),
  })
  .partial(); // every field becomes optional for PATCH semantics

// ─────────────────────────────────────────────────────────────────────────────
// 6. FILTER / QUERY PARAMS SCHEMA  (Self-healing with .catch())
//    Maps → GET /genres?...  (query: GenreUserFilterInput)
// ─────────────────────────────────────────────────────────────────────────────
export const genreParamsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),

  limit: z.coerce.number().int().min(1).max(100).catch(APP_CONFIG.GRID_LIMIT),

  sort: z.enum(GENRE_SORT_OPTIONS).catch("priority"),

  keyword: z
    .preprocess(
      (val) => (val === "" ? undefined : val),
      z.string().trim().max(100).optional(),
    )
    .catch(undefined),

  parentId: z
    .preprocess(
      (val) => (val === "" || val === "undefined" ? undefined : val),
      z
        .union([z.string().regex(/^[a-f\d]{24}$/i), z.literal("root")])
        .optional(),
    )
    .catch(undefined),

  isTrending: z
    .preprocess(
      (val) => (val === "true" ? true : val === "false" ? false : undefined),
      z.boolean().optional(),
    )
    .catch(undefined),
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. ADMIN FILTER PARAMS SCHEMA
//    Maps → GET /admin/genres?...  (query: GenreAdminFilterInput)
//    Extends user schema with isActive + isDeleted
// ─────────────────────────────────────────────────────────────────────────────
export const genreAdminParamsSchema = genreParamsSchema.extend({
  isActive: z
    .preprocess(
      (val) => (val === "true" ? true : val === "false" ? false : undefined),
      z.boolean().optional(),
    )
    .catch(undefined),

  isDeleted: z
    .preprocess(
      (val) => (val === "true" ? true : val === "false" ? false : undefined),
      z.boolean().optional(),
    )
    .catch(undefined),
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. GENRE TRACKS FILTER SCHEMA
//    Maps → GET /genres/:id/tracks?...
//    Same as user filter but parentId is not needed
// ─────────────────────────────────────────────────────────────────────────────
export const genreTracksParamsSchema = genreParamsSchema.omit({
  parentId: true,
  keyword: true,
  isTrending: true,
  sort: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. EXPORTED TYPES
// ─────────────────────────────────────────────────────────────────────────────
export type GenreCreateFormValues = z.infer<typeof genreCreateSchema>;
export type GenreEditFormValues = z.infer<typeof genreEditSchema>;
export type GenreFilterParams = Partial<z.infer<typeof genreParamsSchema>>;
export type GenreAdminFilterParams = Partial<
  z.infer<typeof genreAdminParamsSchema>
>;
export type GenreTracksFilterParams = Partial<
  z.infer<typeof genreTracksParamsSchema>
>;
