// features/album/schemas/albumSchema.ts
import { z } from "zod";
import {
  hexColorSchema,
  imageFileSchema,
  optionalObjectIdSchema,
  optionalString,
  releaseDateSchema,
} from "@/utils/base-validate";
import { APP_CONFIG } from "@/config/constants";

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

const albumBaseSchema = z.object({
  // ── 1. THÔNG TIN CHÍNH ────────────────────────────────────────────────────
  title: z
    .string()
    .trim()
    .min(1, "Tên album không được để trống")
    .max(150, "Tên album tối đa 150 ký tự"),

  description: optionalString(200, "Mô tả không được vượt quá 200 ký tự"),

  type: z.enum(ALBUM_TYPES).default("album"),

  // ── 2. LIÊN KẾT (RELATIONS) ───────────────────────────────────────────────
  artist: optionalObjectIdSchema,

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
  themeColor: hexColorSchema.default("#1db954"),

  releaseDate: releaseDateSchema,
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
export const albumEditSchema = albumBaseSchema
  .extend({
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
  })
  .partial()
  .refine((body) => Object.values(body).some((v) => v !== undefined), {
    message: "Phải có ít nhất một trường để cập nhật",
  });

// ─────────────────────────────────────────────────────────────────────────────
// URL PARAMS SCHEMA — dùng .catch() thay .default() để silent fallback
// khi user tamper URL, không crash app
// ─────────────────────────────────────────────────────────────────────────────
export const albumParamsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),

  limit: z.coerce.number().int().min(1).max(100).catch(APP_CONFIG.GRID_LIMIT),

  keyword: z
    .preprocess(
      (val) => (val === "" ? undefined : val),
      z.string().trim().max(100).optional(),
    )
    .catch(undefined),

  sort: z.enum(ALBUM_SORT_OPTIONS).catch("newest"),
  type: z.enum(ALBUM_FILTER_TYPES).optional().catch(undefined),

  artistId: z.string().trim().optional().catch(undefined),

  year: z.coerce.number().int().min(1900).max(2100).optional().catch(undefined),
});
export const albumAdminParamsSchema = albumParamsSchema.extend({
  isPublic: z
    .preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .catch(undefined),
  isDeleted: z
    .preprocess(
      (val) => (val === "true" ? true : val === "false" ? false : undefined),
      z.boolean().optional(),
    )
    .catch(undefined),
});
export const albumTracksParamsSchema = albumParamsSchema.omit({
  keyword: true,
  artistId: true,
  year: true,
  type: true,
  sort: true,
});

export type AlbumCreateFormValues = z.infer<typeof albumCreateSchema>;
export type AlbumEditFormValues = z.infer<typeof albumEditSchema>;
export type AlbumFormValues = AlbumCreateFormValues | AlbumEditFormValues;
export type AlbumFilterParams = Partial<z.infer<typeof albumParamsSchema>>;
export type AlbumAdminFilterParams = Partial<
  z.infer<typeof albumAdminParamsSchema>
>;
export type AlbumTracksFilterParams = Partial<
  z.infer<typeof albumTracksParamsSchema>
>;
