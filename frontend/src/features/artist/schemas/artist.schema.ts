import {
  hexColorSchema,
  imageFileSchema,
  optionalObjectIdSchema,
  optionalString,
  socialLinkSchema,
  emptyToUndefined,
} from "@/utils/base-validate";
import { z } from "zod";
import { APP_CONFIG } from "@/config/constants";

export const ARTIST_SORT_OPTIONS = [
  "popular",
  "newest",
  "oldest",
  "name",
  "monthlyListeners",
] as const;
export const ARTIST_SORT_TYPES = {
  popular: "Phổ biến",
  newest: "Mới nhất",
  oldest: "Cũ nhất",
  name: "A – Z",
  monthlyListeners: "Người nghe hàng tháng",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SHARED BASE SCHEMA — mirror backend createArtistSchema
// ─────────────────────────────────────────────────────────────────────────────
const artistBaseSchema = z.object({
  // ── 1. THÔNG TIN CHÍNH ────────────────────────────────────────────────────
  name: z
    .string()
    .trim()
    .min(1, "Tên nghệ sĩ không được để trống")
    .max(100, "Tên nghệ sĩ tối đa 100 ký tự"),

  bio: optionalString(200, "Tiểu sử tối đa 200 ký tự"),

  nationality: z.string().trim().max(10).optional().catch("VN"),

  aliases: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Tên gọi khác không được để trống")
        .max(50, "Tên gọi khác tối đa 50 ký tự"),
    )
    .max(10, "Chỉ được nhập tối đa 10 tên gọi khác")
    .default([]),

  // ── 2. GIAO DIỆN ──────────────────────────────────────────────────────────
  themeColor: hexColorSchema.default("#1db954"),

  // ── 3. LIÊN KẾT ───────────────────────────────────────────────────────────
  userId: optionalObjectIdSchema,

  isVerified: z.boolean().default(false),

  // ── 4. SOCIAL LINKS (flat fields, match backend) ──────────────────────────
  facebook: socialLinkSchema,
  instagram: socialLinkSchema,
  twitter: socialLinkSchema,
  website: socialLinkSchema,
  spotify: socialLinkSchema,
  youtube: socialLinkSchema,

  // ── 5. GALLERY IMAGES (optional, frontend UI only) ───────────────────────
  images: z.array(z.union([imageFileSchema, z.string().url()])).default([]),
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATE SCHEMA — avatar/coverImage optional
// ─────────────────────────────────────────────────────────────────────────────
export const artistCreateSchema = artistBaseSchema.extend({
  avatar: imageFileSchema.optional(),
  coverImage: imageFileSchema.optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// EDIT SCHEMA — avatar/coverImage can be URL (existing) or File (new) or null
// ─────────────────────────────────────────────────────────────────────────────
export const artistEditSchema = artistBaseSchema
  .extend({
    avatar: z
      .union([
        z.string().url("Đường dẫn avatar không hợp lệ"),
        imageFileSchema,
        z.null(),
      ])
      .optional(),
    coverImage: z
      .union([
        z.string().url("Đường dẫn cover không hợp lệ"),
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
// FILTER PARAMS SCHEMA — match backend getArtistsByUserSchema & getArtistsByAdminSchema
// ─────────────────────────────────────────────────────────────────────────────
export const artistParamsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),

  limit: z.coerce.number().int().min(1).max(100).catch(APP_CONFIG.GRID_LIMIT),

  keyword: z
    .preprocess(emptyToUndefined, z.string().trim().min(1).max(100).optional())
    .catch(undefined),

  nationality: z
    .preprocess(
      (val) => (val === "" ? undefined : val),
      z.string().trim().max(50).optional(),
    )
    .catch(undefined),

  sort: z.enum(ARTIST_SORT_OPTIONS).catch("popular"),
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN FILTER PARAMS — extend user params with isActive & isVerified
// ─────────────────────────────────────────────────────────────────────────────
export const artistAdminParamsSchema = artistParamsSchema.extend({
  isActive: z
    .preprocess(
      (val) => (val === "true" ? true : val === "false" ? false : undefined),
      z.boolean().optional(),
    )
    .catch(undefined),

  isVerified: z
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
export const artistTracksParamsSchema = artistParamsSchema.omit({
  keyword: true,
  sort: true,
  nationality: true,
});
// ─────────────────────────────────────────────────────────────────────────────
// TYPE EXPORTS — match backend types
// ─────────────────────────────────────────────────────────────────────────────
export type ArtistCreateFormValues = z.infer<typeof artistCreateSchema>;
export type ArtistEditFormValues = z.infer<typeof artistEditSchema>;
export type ArtistFormValues = ArtistCreateFormValues | ArtistEditFormValues;
export type ArtistFilterParams = Partial<z.infer<typeof artistParamsSchema>>;
export type ArtistAdminFilterParams = Partial<
  z.infer<typeof artistAdminParamsSchema>
>;
export type ArtistTracksFilterParams = Partial<
  z.infer<typeof artistTracksParamsSchema>
>;
