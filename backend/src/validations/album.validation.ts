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

// ─────────────────────────────────────────────────────────────────────────────
// SHARED PRIMITIVES (album-specific)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UPC / EAN-13 barcode.
 * Chuẩn quốc tế: 12 chữ số (UPC-A) hoặc 13 chữ số (EAN-13).
 * Trước đây chỉ `.max(50)` — không bắt format, nhận "abc" vào DB.
 */
const upcSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .regex(/^\d{12,13}$/, "UPC phải là 12 hoặc 13 chữ số (UPC-A / EAN-13)")
    .optional(),
);

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

/**
 * FIX: artist → optionalObjectIdSchema thay vì objectIdSchema.
 * Lý do: Artist user không gửi artist (service tự lấy từ currentUser.artistProfile).
 *        Admin mới cần gửi — service tự enforce bằng if (role === "admin") check.
 *        Validate chỉ đảm bảo: NẾU gửi lên thì phải là MongoId hợp lệ.
 */
export const createAlbumSchema = z.object({
  body: z
    .object({
      title: z
        .string({ message: "Tên album là bắt buộc" })
        .trim()
        .min(1, "Tên album không được để trống")
        .max(150, "Tên album tối đa 150 ký tự"),

      description: z.string().trim().max(2000).optional(),
      // FIX: optional — service tự validate dựa trên role
      artist: optionalObjectIdSchema,
      releaseDate: releaseDateSchema,
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
        .min(1, "Tên album không được để trống")
        .max(150)
        .optional(),

      description: z.string().trim().max(2000).optional(),

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
// 3. GET ALBUMS LIST
// ─────────────────────────────────────────────────────────────────────────────

const albumListQueryBase = z
  .object({
    // Phân trang — giới hạn chặt để tránh DB scan
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(12),

    // Keyword — chặn ReDoS với .max(100)
    keyword: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).max(100).optional(),
    ),

    // IDs
    artistId: optionalObjectIdSchema,
    genreId: optionalObjectIdSchema,

    // Privacy
    isPublic: z.preprocess(
      (val) => (val === "true" ? true : val === "false" ? false : undefined),
      z.boolean().optional(),
    ),

    // Năm — chặn giá trị phi lý
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

    // FIX: bỏ "trending" — service không xử lý case này, sort sẽ fallback "newest" lặng lẽ
    sort: albumSortEnum.default("newest"),
  })
  .strict(); // Chặn query param lạ (SQLi attempt qua query string)

export const getAlbumsSchema = z.object({
  query: albumListQueryBase,
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET ALBUM TRACKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FIX: Không extend getAlbumsSchema (gây sai type inference).
 * Dùng albumListQueryBase.omit() → type sạch, không kéo theo shape của getAlbumsSchema.
 */
export const getAlbumTracksSchema = z.object({
  params: z.object({
    albumId: objectIdSchema,
  }),
  query: albumListQueryBase
    .omit({
      artistId: true,
      genreId: true,
      year: true,
      type: true, // tracks trong album đã cùng type → filter vô nghĩa
      sort: true, // tracks luôn sort theo trackNumber — không cho override
    })
    // Override limit: tracks/page thường lấy nhiều hơn list album
    .extend({
      limit: z.coerce.number().min(1).max(100).default(20),
    })
    .strict(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET ALBUM DETAIL
// ─────────────────────────────────────────────────────────────────────────────

export const getAlbumDetailSchema = z.object({
  params: z.object({
    // Chấp nhận cả slug (chữ-hoa-thường-gạch-ngang) lẫn MongoId 24 hex
    slugOrId: z
      .string()
      .min(1)
      .max(200)
      .regex(
        /^[a-zA-Z0-9-]{1,200}$|^[0-9a-fA-F]{24}$/,
        "slugOrId phải là slug hợp lệ hoặc MongoId 24 ký tự",
      ),
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. DELETE ALBUM
// ─────────────────────────────────────────────────────────────────────────────

export const deleteAlbumSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type CreateAlbumInput = z.infer<typeof createAlbumSchema>["body"];
export type UpdateAlbumInput = z.infer<typeof updateAlbumSchema>["body"];
export type AlbumFilterInput = z.infer<typeof getAlbumsSchema>["query"];
export type AlbumTracksFilterInput = z.infer<
  typeof getAlbumTracksSchema
>["query"];
export type GetAlbumDetailParams = z.infer<
  typeof getAlbumDetailSchema
>["params"];
export type DeleteAlbumParams = z.infer<typeof deleteAlbumSchema>["params"];
