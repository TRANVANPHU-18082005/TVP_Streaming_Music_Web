import { z } from "zod";
import {
  booleanSchema,
  genreIdsSchema,
  hexColorSchema,
  nullableObjectIdSchema,
  optionalObjectIdSchema,
  objectIdSchema,
  socialLinkSchema,
  tagsSchema,
  formDataArrayHelper, // Gọi Helper vạn năng
} from "./common.validate";

// --- 1. CREATE ARTIST SCHEMA ---
export const createArtistSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, "Tên nghệ sĩ là bắt buộc").max(100),
    bio: z.string().trim().max(2000).optional(),

    nationality: z.string().trim().max(10).optional().default("VN"),
    aliases: tagsSchema.optional(), // Không cần .default([]) vì helper đã lo
    themeColor: hexColorSchema.optional().default("#ffffff"),

    genreIds: genreIdsSchema.optional(),
    userId: nullableObjectIdSchema,

    // Tận dụng booleanSchema đã fix, gán mặc định false
    isVerified: booleanSchema.default(false),

    facebook: socialLinkSchema,
    instagram: socialLinkSchema,
    twitter: socialLinkSchema,
    website: socialLinkSchema,
    spotify: socialLinkSchema,
    youtube: socialLinkSchema,
  }),
});

// --- 2. UPDATE ARTIST SCHEMA ---
export const updateArtistSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    bio: z.string().max(2000).optional(),

    nationality: z.string().trim().max(10).optional(),
    aliases: tagsSchema.optional(),
    themeColor: hexColorSchema.optional(),
    userId: nullableObjectIdSchema,

    genreIds: genreIdsSchema.optional(),

    facebook: socialLinkSchema,
    instagram: socialLinkSchema,
    twitter: socialLinkSchema,
    website: socialLinkSchema,
    spotify: socialLinkSchema,
    youtube: socialLinkSchema,

    // Edit không được có .default(), phải dùng .optional()
    isVerified: booleanSchema.optional(),

    // Dùng helper mới để xử lý mảng url
    keptImages: formDataArrayHelper(z.string()).optional(),
  }),
});

export const getArtistsSchema = z.object({
  query: z
    .object({
      // 1. Phân trang: Giới hạn limit để tránh càn quét data
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(12),

      // 2. Search: Giới hạn độ dài để bảo vệ Regex engine (Chống ReDoS)
      keyword: z.preprocess(
        (val) => (val === "" ? undefined : val),
        z.string().trim().max(100, "Keyword too long").optional(),
      ),

      // 3. Filters: Dùng preprocess để xử lý Boolean từ Query String
      nationality: z.preprocess(
        (val) => (val === "" ? undefined : val),
        z.string().trim().max(50).optional(),
      ),

      isActive: z.preprocess(
        (val) => (val === "true" ? true : val === "false" ? false : undefined),
        z.boolean().optional(),
      ),

      isVerified: z.preprocess(
        (val) => (val === "true" ? true : val === "false" ? false : undefined),
        z.boolean().optional(),
      ),

      // 4. IDs: Validate định dạng ObjectId (24 ký tự Hex)
      genreId: optionalObjectIdSchema,

      // 5. Sorting: Chỉ cho phép các tiêu chí đã Index
      sort: z
        .enum(["popular", "newest", "name", "monthlyListeners"])
        .default("popular"),
    })
    .strict(), // 🔥 CHIÊU CUỐI: Chặn mọi tham số "lạ" không nằm trong danh sách
});
export const getArtistTracksSchema = getArtistsSchema.extend({
  query: getArtistsSchema.shape.query.omit({
    genreId: true,
  }),
});
// --- TYPES ---
export type CreateArtistInput = z.infer<typeof createArtistSchema>["body"];
export type UpdateArtistInput = z.infer<typeof updateArtistSchema>["body"];
export type ArtistFilterInput = z.infer<typeof getArtistsSchema>["query"];
