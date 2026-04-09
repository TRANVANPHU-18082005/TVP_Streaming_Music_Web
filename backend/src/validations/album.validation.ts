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
// --- 3. GET ALBUMS SCHEMA (Dành cho query parameters) ---
export const getAlbumsSchema = z.object({
  query: z
    .object({
      // 1. Phân trang: Giới hạn chặt chẽ để tránh càn quét Database
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(50).default(12),

      // 2. Keyword: Chặn đứng ReDoS (Regex Denial of Service) bằng .max()
      keyword: z.preprocess(
        emptyToUndefined,
        z.string().trim().min(1).max(100).optional(),
      ),

      // 3. IDs: Kiểm tra định dạng 24 ký tự Hex
      artistId: optionalObjectIdSchema,
      genreId: optionalObjectIdSchema,

      // 4. Privacy Control: Ép kiểu và mặc định là true (Bảo mật dữ liệu ẩn)
      isPublic: z.preprocess(
        (val) => (val === "true" ? true : val === "false" ? false : undefined),
        z.boolean().optional(), // ← bỏ .default(true)
      ),

      // 5. Năm: Chặn các con số phi lý (Năm 3000 chẳng hạn)
      year: z.preprocess(
        emptyToUndefined,
        z.coerce
          .number()
          .min(1900, "Too old")
          .max(new Date().getFullYear() + 2, "Too far in future")
          .optional(),
      ),

      // 6. Enums: Chỉ cho phép các giá trị hợp lệ
      type: z.enum(["album", "single", "ep", "compilation"]).optional(),

      // 7. Sort: Định nghĩa rõ ràng các tiêu chí sắp xếp
      sort: z
        .enum(["newest", "oldest", "popular", "name", "trending"])
        .default("newest"),
    })
    .strict(), // 🔥 CHIÊU CUỐI: Chặn mọi tham số "lạ" không nằm trong danh sách
});
// Cách dùng .omit để tái sử dụng mà không bị thừa
export const getAlbumTracksSchema = getAlbumsSchema.extend({
  query: getAlbumsSchema.shape.query.omit({
    artistId: true,
    genreId: true,
    year: true,
  }),
});
// --- TYPES ---
export type CreateAlbumInput = z.infer<typeof createAlbumSchema>["body"];
export type UpdateAlbumInput = z.infer<typeof updateAlbumSchema>["body"];
export type AlbumFilterInput = z.infer<typeof getAlbumsSchema>["query"];
export type AlbumTracksFilterInput = z.infer<
  typeof getAlbumTracksSchema
>["query"];
