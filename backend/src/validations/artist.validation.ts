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

// --- 3. GET ARTISTS SCHEMA (Filter) ---
export const getArtistsSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).default(12),
    keyword: z.string().trim().optional(),
    nationality: z.string().trim().optional(),

    // An toàn tuyệt đối với boolean và ID rỗng từ Query String
    isActive: booleanSchema.optional(),
    isVerified: booleanSchema.optional(),
    genreId: optionalObjectIdSchema,

    sort: z
      .enum(["popular", "newest", "name", "monthlyListeners"])
      .default("popular"),
  }),
});

// --- TYPES ---
export type CreateArtistInput = z.infer<typeof createArtistSchema>["body"];
export type UpdateArtistInput = z.infer<typeof updateArtistSchema>["body"];
export type ArtistFilterInput = z.infer<typeof getArtistsSchema>["query"];
