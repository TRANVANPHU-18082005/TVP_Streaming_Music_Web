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
  formDataArrayHelper,
  emptyToUndefined, // Gọi Helper vạn năng
} from "./common.validate";
import { APP_CONFIG } from "../config/constants";

// --- 1. CREATE ARTIST SCHEMA ---
export const createArtistSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1, "Tên nghệ sĩ là bắt buộc").max(100),
      bio: z.string().trim().max(200, "Mô tả quá dài").optional(),
      nationality: z.string().trim().max(10).optional().default("VN"),
      aliases: tagsSchema.optional(),
      themeColor: hexColorSchema.optional().default("#ffffff"),
      userId: nullableObjectIdSchema,
      isVerified: booleanSchema.default(false),
      facebook: socialLinkSchema,
      instagram: socialLinkSchema,
      twitter: socialLinkSchema,
      website: socialLinkSchema,
      spotify: socialLinkSchema,
      youtube: socialLinkSchema,
    })
    .strict(), // Chặn field lạ không nằm trong whitelist
});

// --- 2. UPDATE ARTIST SCHEMA ---
export const updateArtistSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    bio: z.string().trim().max(200, "Mô tả quá dài").optional(),

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
// --- 3. GET ARTISTS SCHEMA BY USER (Dùng chung cho GET ARTISTS & GET ARTIST TRACKS) ---
export const getArtistsByUserSchema = z.object({
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

      nationality: z.preprocess(
        (val) => (val === "" ? undefined : val),
        z.string().trim().max(50).optional(),
      ),

      sort: z
        .enum(["popular", "newest", "oldest", "name", "monthlyListeners"])
        .default("popular"),
    })
    .strict(),
});
// --- 4. GET ARTISTS SCHEMA BY ADMIN (Có thêm filter isActive, isVerified, isDeleted) ---
export const getArtistsByAdminSchema = getArtistsByUserSchema.extend({
  query: getArtistsByUserSchema.shape.query.extend({
    isActive: z.preprocess(
      (val) => (val === "true" ? true : val === "false" ? false : undefined),
      z.boolean().optional(),
    ),
    isVerified: z.preprocess(
      (val) => (val === "true" ? true : val === "false" ? false : undefined),
      z.boolean().optional(),
    ),
    isDeleted: z.preprocess(
      (val) => (val === "true" ? true : val === "false" ? false : undefined),
      z.boolean().optional(),
    ),
  }),
});
// --- 5. GET ARTIST TRACKS SCHEMA (Dùng chung với GET ARTISTS BY USER, chỉ bỏ filter genreId) ---
export const getArtistTracksSchema = getArtistsByUserSchema.extend({
  query: getArtistsByUserSchema.shape.query.omit({
    sort: true, // Artist Tracks không cần sort theo name hay monthlyListeners
    nationality: true, // Artist Tracks không cần filter theo quốc gia
    keyword: true, // Artist Tracks không cần search theo keyword (chỉ search theo album/track name)
  }),
});
// --- 6. GET ARTIST DETAIL SCHEMA ---
export const getArtistDetailSchema = z.object({
  params: z.object({ slug: z.string().trim().min(2).max(100) }),
});
// --- 7. DELETE ARTIST SCHEMA ---
export const deleteArtistSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});

// --- 8. TOGGLE ARTIST STATUS SCHEMA ---
export const toggleArtistStatusSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});
// --- TYPES ---
export type CreateArtistInput = z.infer<typeof createArtistSchema>["body"];
export type UpdateArtistInput = z.infer<typeof updateArtistSchema>["body"];
export type ArtistUserFilterInput = z.infer<
  typeof getArtistsByUserSchema
>["query"];
export type ArtistAdminFilterInput = z.infer<
  typeof getArtistsByAdminSchema
>["query"];
