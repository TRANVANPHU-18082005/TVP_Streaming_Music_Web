// features/playlist/schemas/playlistSchema.ts
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & TYPES
// ─────────────────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const PLAYLIST_VISIBILITY = ["public", "private", "unlisted"] as const;
export const PLAYLIST_TYPES = ["playlist", "radio", "mix"] as const;
export const PLAYLIST_SORT_OPTIONS = [
  "newest",
  "oldest",
  "popular",
  "name",
] as const;

export type PlaylistVisibility = (typeof PLAYLIST_VISIBILITY)[number];
export type PlaylistType = (typeof PLAYLIST_TYPES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

const optionalString = (maxLen: number, maxMsg: string) =>
  z
    .string()
    .trim()
    .max(maxLen, maxMsg)
    .optional()
    .nullable()
    .transform((val) => (val === "" ? undefined : val) ?? undefined);

const imageFileSchema = z
  .instanceof(File)
  .refine((f) => f.size <= MAX_FILE_SIZE, "Kích thước ảnh tối đa 5MB")
  .refine(
    (f) => ACCEPTED_IMAGE_TYPES.includes(f.type as any),
    "Chỉ nhận định dạng .jpg, .jpeg, .png, .webp",
  );

// ─────────────────────────────────────────────────────────────────────────────
// SHARED BASE SCHEMA
// ─────────────────────────────────────────────────────────────────────────────
const playlistBaseSchema = z.object({
  title: z
    .string({ required_error: "Vui lòng nhập tên Playlist" })
    .trim()
    .min(1, "Tên Playlist không được để trống")
    .max(100, "Tên Playlist tối đa 100 ký tự"),

  description: optionalString(2000, "Mô tả tối đa 2000 ký tự"),

  themeColor: z
    .string()
    .trim()
    .regex(/^#([0-9A-F]{3}){1,2}$/i, "Mã màu HEX không hợp lệ (VD: #1DB954)")
    .default("#1db954"),

  visibility: z.enum(PLAYLIST_VISIBILITY).default("public"),
  type: z.enum(PLAYLIST_TYPES).default("playlist"),

  tags: z
    .array(z.string().trim().min(1).max(30))
    .max(20, "Tối đa 20 thẻ tags")
    .default([]),

  collaborators: z.array(z.string().trim()).max(50).default([]),
  isSystem: z.boolean().default(false),
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATE / EDIT SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const playlistCreateSchema = playlistBaseSchema.extend({
  coverImage: imageFileSchema.optional(), // Có thể để trống lúc tạo, dùng ảnh mặc định
});

export const playlistEditSchema = playlistBaseSchema.extend({
  coverImage: z
    .union([
      z.string().url("Đường dẫn ảnh không hợp lệ"),
      imageFileSchema,
      z.null(),
    ])
    .optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// URL PARAMS SCHEMA (Chống Tampering bằng .catch)
// ─────────────────────────────────────────────────────────────────────────────
export const playlistParamsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(12),
  keyword: z.string().trim().optional().catch(undefined),
  sort: z.enum(PLAYLIST_SORT_OPTIONS).catch("newest"),
  type: z.enum(PLAYLIST_TYPES).optional().catch(undefined),
  visibility: z.enum(PLAYLIST_VISIBILITY).optional().catch(undefined),
  isSystem: z
    .preprocess(
      (val) => (val === "true" ? true : val === "false" ? false : undefined),
      z.boolean().optional(),
    )
    .catch(undefined),
});

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE SCHEMAS (Validate dữ liệu từ Backend trả về)
// ─────────────────────────────────────────────────────────────────────────────
export const playlistItemSchema = z.object({
  _id: z.string(),
  title: z.string(),
  coverImage: z.string().url().nullable().optional(),
  type: z.enum(PLAYLIST_TYPES),
  visibility: z.enum(PLAYLIST_VISIBILITY),
  owner: z.object({
    _id: z.string(),
    name: z.string(),
  }),
  trackCount: z.coerce.number().default(0),
  updatedAt: z.string(),
});

export const playlistDetailSchema = playlistItemSchema.extend({
  description: z.string().nullable().optional(),
  themeColor: z.string(),
  tags: z.array(z.string()),
  collaborators: z.array(z.any()), // Có thể extend chi tiết User object nếu cần
  // Chứa danh sách IDs để hỗ trợ Virtual Scroll
  trackIds: z.array(z.string()).default([]),
});

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
export type PlaylistCreateFormValues = z.infer<typeof playlistCreateSchema>;
export type PlaylistEditFormValues = z.infer<typeof playlistEditSchema>;
export type PlaylistFilterParams = z.infer<typeof playlistParamsSchema>;
export type PlaylistItem = z.infer<typeof playlistItemSchema>;
export type PlaylistDetail = z.infer<typeof playlistDetailSchema>;
