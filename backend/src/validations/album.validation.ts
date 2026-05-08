// validations/album.validation.ts

import { z } from "zod";
import {
  booleanSchema,
  emptyToUndefined,
  genreIdsSchema,
  hexColorSchema,
  objectIdSchema,
  optionalObjectIdSchema,
  tagsSchema,
} from "./common.validate";
import { APP_CONFIG } from "../config/constants";
import { getGenresByUserSchema } from "./genre.validation";
import { is } from "zod/v4/locales";

/**
 * releaseDate dùng chung cho create & update.
 * Chặn Invalid Date của JS khi coerce string rỗng.
 */
const releaseDateSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Ngày phát hành không đúng định dạng (ISO 8601 hoặc YYYY-MM-DD)",
    })
    // Giữ dạng string — service sẽ new Date() — tránh timezone drift của z.coerce.date()
    .optional(),
);

/** Enum type album — dùng lại nhiều chỗ */
const albumTypeEnum = z.enum(["album", "single", "ep", "compilation"]);

/** Sort enum — FIX: bỏ "trending" (service không handle case này) */
const albumSortEnum = z.enum(["newest", "oldest", "popular", "name"]);

// ─────────────────────────────────────────────────────────────────────────────
// 1. CREATE ALBUM
// ─────────────────────────────────────────────────────────────────────────────

export const createAlbumSchema = z.object({
  body: z
    .object({
      title: z
        .string({ message: "Tên album là bắt buộc" })
        .trim()
        .min(1, { message: "Tên album không được để trống" })
        .max(150, { message: "Tên album tối đa 150 ký tự" }),

      description: z
        .string({ message: "Mô tả là bắt buộc" })
        .trim()
        .max(200, { message: "Mô tả tối đa 200 ký tự" })
        .optional(),
      // FIX: optional — service tự validate dựa trên role
      artist: optionalObjectIdSchema,
      releaseDate: releaseDateSchema,
      themeColor: hexColorSchema.optional(),
      type: albumTypeEnum.default("album"),
      tags: tagsSchema.optional(),
      isPublic: booleanSchema.default(false),
    })
    .strict(), // Chặn field lạ không nằm trong whitelist
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. UPDATE ALBUM
// ─────────────────────────────────────────────────────────────────────────────

export const updateAlbumSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z
    .object({
      title: z
        .string()
        .trim()
        .min(1, { message: "Tên album không được để trống" })
        .max(150, { message: "Tên album tối đa 150 ký tự" })
        .optional(),

      description: z
        .string({ message: "Mô tả là bắt buộc" })
        .trim()
        .max(200, { message: "Mô tả tối đa 200 ký tự" })
        .optional(),

      // Artist chỉ được thay đổi bởi Admin — validation chỉ check format
      artist: optionalObjectIdSchema,
      // Cho phép Admin override màu thủ công
      themeColor: hexColorSchema.optional(),

      releaseDate: releaseDateSchema,

      type: albumTypeEnum.optional(),

      tags: tagsSchema.optional(),

      isPublic: booleanSchema.optional(),
    })
    .strict()
    // Ít nhất 1 field phải có giá trị (tránh PATCH rỗng gây re-save vô nghĩa)
    .refine((body) => Object.values(body).some((v) => v !== undefined), {
      message: "Phải có ít nhất một trường để cập nhật",
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET ALBUMS LIST (BY User)
// ─────────────────────────────────────────────────────────────────────────────

export const getAlbumsByUserSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).max(APP_CONFIG.MAX_PAGES).default(1),
      limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(APP_CONFIG.MAX_PAGES)
        .default(APP_CONFIG.GRID_LIMIT),

      keyword: z.preprocess(
        emptyToUndefined,
        z.string().trim().min(1).max(100).optional(),
      ),

      artistId: optionalObjectIdSchema,
      year: z.preprocess(
        emptyToUndefined,
        z.coerce
          .number()
          .min(1900, "Năm phát hành quá cũ")
          .max(new Date().getFullYear() + 2, "Năm phát hành vượt quá giới hạn")
          .int("Năm phải là số nguyên")
          .optional(),
      ),
      type: albumTypeEnum.optional(),
      sort: albumSortEnum.default("popular"),
    })
    .strict(),
});
// ─────────────────────────────────────────────────────────────────────────────
// 4. GET ALBUMS LIST (BY ADMIN) - Có thêm filter để xem private/draft của tất cả user
// ─────────────────────────────────────────────────────────────────────────────

export const getAlbumByAdminSchema = getAlbumsByUserSchema.extend({
  query: getAlbumsByUserSchema.shape.query.extend({
    isPublic: z.preprocess(
      (val) => (val === "true" ? true : val === "false" ? false : undefined),
      z.boolean().optional(),
    ),
    isDeleted: z.preprocess(
      (val) => (val === "true" ? true : val === "false" ? false : undefined),
      z.boolean().optional(),
    ),
  }),
});
// ─────────────────────────────────────────────────────────────────────────────
// 5. GET ALBUM TRACKS
// ─────────────────────────────────────────────────────────────────────────────

export const getAlbumTracksSchema = getAlbumsByUserSchema.extend({
  query: getAlbumsByUserSchema.shape.query.omit({
    keyword: true,
    artistId: true,
    year: true,
    type: true,
    sort: true,
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. GET ALBUM DETAIL
// ─────────────────────────────────────────────────────────────────────────────

export const getAlbumDetailSchema = z.object({
  params: z.object({ slug: z.string().trim().min(2).max(100) }),
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. DELETE ALBUM
// ─────────────────────────────────────────────────────────────────────────────

export const deleteAlbumSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});
// 8. TOGGLE ALBUM PUBLIC/PRIVATE
export const toggleAlbumPublicSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});
// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type CreateAlbumInput = z.infer<typeof createAlbumSchema>["body"];
export type UpdateAlbumInput = z.infer<typeof updateAlbumSchema>["body"];
export type AlbumUserFilterInput = z.infer<
  typeof getAlbumsByUserSchema
>["query"];
export type AlbumAdminFilterInput = z.infer<
  typeof getAlbumByAdminSchema
>["query"];
