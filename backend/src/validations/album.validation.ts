import { z } from "zod";
import {
  booleanSchema,
  emptyToUndefined,
  genreIdsSchema, // Giả định đã xử lý JSON.parse bên trong
  hexColorSchema,
  objectIdSchema,
  optionalObjectIdSchema,
  tagsSchema, // Giả định đã xử lý JSON.parse bên trong
} from "./common.validate";

// --- 1. CREATE ALBUM SCHEMA ---
export const createAlbumSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, "Tên album là bắt buộc").max(150),
    description: z.string().max(2000).optional(),

    // 🔥 SỬA: Bắt buộc phải có ID Nghệ sĩ khi tạo mới
    // Nếu FormData gửi lên rỗng "", preprocess sẽ chặn lại
    artist: z.preprocess(
      emptyToUndefined,
      objectIdSchema.describe("ID Nghệ sĩ không hợp lệ hoặc bị trống"),
    ),

    label: z.string().trim().max(100).optional(),
    upc: z.string().trim().max(50).optional(),
    copyright: z.string().trim().max(200).optional(),
    themeColor: hexColorSchema.optional().default("#1db954"),

    // 🔥 SỬA: Chống lỗi Invalid Date của JS khi ép kiểu
    releaseDate: z.preprocess(
      emptyToUndefined,
      z.coerce
        .date()
        .refine((date) => !isNaN(date.getTime()), {
          message: "Ngày phát hành không đúng định dạng",
        })
        .optional(),
    ),

    type: z.enum(["album", "single", "ep", "compilation"]).default("album"),

    genreIds: genreIdsSchema,
    tags: tagsSchema.optional(),

    isPublic: booleanSchema.default(false),
  }),
});

// --- 2. UPDATE ALBUM SCHEMA ---
export const updateAlbumSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    title: z.string().trim().min(1).max(150).optional(),
    description: z.string().max(2000).optional(),

    artist: optionalObjectIdSchema, // Edit thì có thể không gửi lên (giữ nguyên cũ)
    label: z.string().trim().max(100).optional(),
    upc: z.string().trim().max(50).optional(),
    copyright: z.string().trim().max(200).optional(),
    themeColor: hexColorSchema.optional(),

    releaseDate: z.preprocess(
      emptyToUndefined,
      z.coerce
        .date()
        .refine((date) => !isNaN(date.getTime()), {
          message: "Ngày phát hành không đúng định dạng",
        })
        .optional(),
    ),
    type: z.enum(["album", "single", "ep", "compilation"]).optional(),

    genreIds: genreIdsSchema.optional(),
    tags: tagsSchema.optional(),

    isPublic: booleanSchema.optional(),
  }),
});

// --- 3. GET ALBUMS SCHEMA (Filter) ---
export const getAlbumsSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    // 🔥 SỬA: Giới hạn tối đa 50 item 1 page để chống hacker ddos DB bằng cách gửi limit=999999
    limit: z.coerce.number().min(1).max(100).default(12),

    keyword: z.preprocess(emptyToUndefined, z.string().trim().optional()),

    artistId: optionalObjectIdSchema,
    genreId: optionalObjectIdSchema,
    isPublic: booleanSchema.optional(),

    // Year: Đã chuẩn
    year: z.preprocess(
      emptyToUndefined,
      z.coerce.number().min(1900).optional(),
    ),

    type: z.enum(["album", "single", "ep", "compilation"]).optional(),
    sort: z.enum(["newest", "oldest", "popular", "name"]).default("newest"),
  }),
});

// --- TYPES ---
export type CreateAlbumInput = z.infer<typeof createAlbumSchema>["body"];
export type UpdateAlbumInput = z.infer<typeof updateAlbumSchema>["body"];
export type AlbumFilterInput = z.infer<typeof getAlbumsSchema>["query"];
