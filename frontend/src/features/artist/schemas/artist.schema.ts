import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONSTANTS & TYPES
// ─────────────────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const ARTIST_SORT_OPTIONS = [
  "newest",
  "oldest",
  "name",
  "popular",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// 2. REUSABLE PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

/** Chuỗi optional: trim, biến "" thành undefined để DB sạch */
const optionalString = (maxLen: number, maxMsg: string) =>
  z
    .string()
    .trim()
    .max(maxLen, maxMsg)
    .optional()
    .nullable()
    .transform((val) => (val === "" ? undefined : val) ?? undefined);

/** Link MXH chuẩn hóa */
const socialLinkSchema = z
  .string()
  .trim()
  .url("Định dạng link không hợp lệ")
  .or(z.literal(""))
  .optional()
  .nullable()
  .transform((val) => (val === "" ? undefined : val) ?? undefined);

/** Validate File ảnh đơn */
const imageFileSchema = z
  .instanceof(File)
  .refine((f) => f.size <= MAX_FILE_SIZE, "Kích thước ảnh tối đa 5MB")
  .refine(
    (f) => ACCEPTED_IMAGE_TYPES.includes(f.type as any),
    "Chỉ nhận định dạng .jpg, .jpeg, .png, .webp",
  );

/** Item trong Gallery: Có thể là File mới hoặc URL cũ */
const galleryItemSchema = z.union([
  imageFileSchema,
  z.string().url("Link ảnh gallery không hợp lệ"),
]);

// ─────────────────────────────────────────────────────────────────────────────
// 3. SHARED BASE SCHEMA
// ─────────────────────────────────────────────────────────────────────────────
const artistBaseSchema = z.object({
  name: z
    .string({ required_error: "Vui lòng nhập tên nghệ sĩ" })
    .trim()
    .min(2, "Tên nghệ sĩ tối thiểu 2 ký tự")
    .max(100, "Tên nghệ sĩ tối đa 100 ký tự"),

  aliases: z
    .array(z.string().trim().min(1).max(50))
    .max(10, "Tối đa 10 tên gọi khác")
    .default([]),

  nationality: z
    .string()
    .trim()
    .min(1, "Vui lòng chọn quốc tịch")
    .default("VN"),

  userId: optionalString(50, "UserId không hợp lệ"),

  bio: optionalString(3000, "Tiểu sử tối đa 3000 ký tự"),

  themeColor: z
    .string()
    .trim()
    .regex(/^#([0-9A-F]{3}){1,2}$/i, "Mã màu Hex không hợp lệ")
    .default("#ffffff"),

  isVerified: z.boolean().default(false),
  isActive: z.boolean().default(true),

  socialLinks: z
    .object({
      facebook: socialLinkSchema,
      instagram: socialLinkSchema,
      twitter: socialLinkSchema,
      website: socialLinkSchema,
      spotify: socialLinkSchema,
      youtube: socialLinkSchema,
    })
    .optional()
    .default({}),

  // Gallery ảnh nghệ sĩ
  images: z
    .array(galleryItemSchema)
    .max(10, "Tối đa 10 ảnh Gallery")
    .default([]),
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. CREATE / EDIT SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

export const artistCreateSchema = artistBaseSchema.extend({
  avatar: imageFileSchema.optional(),
  coverImage: imageFileSchema.optional(),
});

export const artistEditSchema = artistBaseSchema.extend({
  avatar: z
    .union([
      z.string().url("Link avatar không hợp lệ"),
      imageFileSchema,
      z.null(),
    ])
    .optional(),
  coverImage: z
    .union([
      z.string().url("Link cover không hợp lệ"),
      imageFileSchema,
      z.null(),
    ])
    .optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. PARAMS SCHEMA (Dùng cho trang danh sách nghệ sĩ)
// ─────────────────────────────────────────────────────────────────────────────
export const artistParamsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(12),
  keyword: z.string().trim().optional().catch(undefined),
  sort: z.enum(ARTIST_SORT_OPTIONS).catch("newest"),
  isVerified: z
    .preprocess(
      (val) => (val === "true" ? true : val === "false" ? false : undefined),
      z.boolean().optional(),
    )
    .catch(undefined),
  nationality: z.string().trim().optional().catch(undefined),
  genreId: z.string().trim().optional().catch(undefined),
  isActive: z
    .preprocess(
      (val) => (val === "true" ? true : val === "false" ? false : undefined),
      z.boolean().optional(),
    )
    .catch(undefined),
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. TYPES
// ─────────────────────────────────────────────────────────────────────────────
export type ArtistCreateFormValues = z.infer<typeof artistCreateSchema>;
export type ArtistEditFormValues = z.infer<typeof artistEditSchema>;
export type ArtistFilterParams = z.infer<typeof artistParamsSchema>;
