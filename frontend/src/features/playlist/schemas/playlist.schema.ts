import { APP_CONFIG } from "@/config/constants";
import {
  booleanSchema,
  collaboratorsSchema,
  emptyToUndefined,
  formDataArrayHelper,
  hexColorSchema,
  objectIdSchema,
  optionalObjectIdSchema,
  tagsSchema,
} from "@/utils/base-validate";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
export const PLAYLIST_TYPES = ["playlist", "album", "radio", "mix"] as const;
export const PLAYLIST_VISIBILITY = ["public", "private", "unlisted"] as const;
export const PLAYLIST_SORT_OPTIONS = [
  "newest",
  "oldest",
  "popular",
  "name",
  "trending",
  "duration",
] as const;
export const PLAYLIST_ADMIN_SORT_OPTIONS = [
  "newest",
  "popular",
  "duration",
  "name",
  "oldest",
  "trending",
] as const;

export type PlaylistType = (typeof PLAYLIST_TYPES)[number];
export type PlaylistVisibility = (typeof PLAYLIST_VISIBILITY)[number];
export type PlaylistSortOption = (typeof PLAYLIST_SORT_OPTIONS)[number];
export type PlaylistAdminSortOption =
  (typeof PLAYLIST_ADMIN_SORT_OPTIONS)[number];

const playlistTypeSchema = z.enum(PLAYLIST_TYPES);
const visibilitySchema = z.enum(PLAYLIST_VISIBILITY);
const playlistSortSchema = z.enum(PLAYLIST_SORT_OPTIONS);
const playlistAdminSortSchema = z.enum(PLAYLIST_ADMIN_SORT_OPTIONS);

// ─────────────────────────────────────────────────────────────────────────────
// SHARED BASE SCHEMA
// ─────────────────────────────────────────────────────────────────────────────
const playlistBaseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Tên playlist không được để trống")
    .max(100, "Tên playlist tối đa 100 ký tự"),

  description: z
    .string()
    .trim()
    .max(200, "Mô tả không được vượt quá 200 ký tự")
    .optional(),

  publishAt: z.preprocess(
    emptyToUndefined,
    z.coerce
      .date()
      .optional()
      .refine((date) => !date || date > new Date(Date.now() - 5000), {
        message: "Ngày phát hành không được ở quá khứ",
      }),
  ),

  tracks: formDataArrayHelper(objectIdSchema).optional(),
  tags: tagsSchema.default([]),
  collaborators: collaboratorsSchema.default([]),

  type: playlistTypeSchema.default("playlist"),
  visibility: visibilitySchema.default("public"),
  userId: optionalObjectIdSchema,
  themeColor: hexColorSchema.optional(),
  isSystem: booleanSchema.default(false),
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATE / EDIT SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const playlistCreateSchema = playlistBaseSchema.extend({
  coverImage: z
    .instanceof(File)
    .refine((f) => f.size <= 5 * 1024 * 1024, "Kích thước ảnh tối đa 5MB")
    .refine(
      (f) =>
        ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(f.type),
      "Chỉ nhận định dạng .jpg, .jpeg, .png, .webp",
    )
    .optional(),
});

export const playlistQuickCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Tiêu đề không được để trống")
    .max(100, "Tiêu đề tối đa 100 ký tự"),
  tracks: formDataArrayHelper(objectIdSchema).optional(),
  visibility: visibilitySchema.default("public"),
});

export const playlistEditSchema = playlistBaseSchema
  .omit({ tracks: true })
  .extend({
    coverImage: z
      .union([
        z.string().url("Đường dẫn ảnh không hợp lệ"),
        z
          .instanceof(File)
          .refine((f) => f.size <= 5 * 1024 * 1024, "Kích thước ảnh tối đa 5MB")
          .refine(
            (f) =>
              ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(
                f.type,
              ),
            "Chỉ nhận định dạng .jpg, .jpeg, .png, .webp",
          ),
        z.null(),
      ])
      .optional(),
  })
  .partial()
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Phải có ít nhất một trường để cập nhật",
  });

// ─────────────────────────────────────────────────────────────────────────────
// URL PARAMS SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const playlistParamsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(APP_CONFIG.GRID_LIMIT),

  keyword: z
    .preprocess(
      (val) => (val === "" ? undefined : val),
      z.string().trim().optional(),
    )
    .catch(undefined),
  sort: playlistSortSchema.catch("popular"),
  tag: z
    .preprocess(
      emptyToUndefined,
      z.string().trim().min(1).max(30, "Tag quá dài").optional(),
    )
    .catch(undefined),
  type: z
    .preprocess(emptyToUndefined, playlistTypeSchema.optional())
    .catch(undefined),
});

export const playlistAdminParamsSchema = playlistParamsSchema.extend({
  visibility: z
    .preprocess(emptyToUndefined, visibilitySchema.optional())
    .catch(undefined),
  isSystem: z
    .preprocess(
      (val) => (val === "true" ? true : val === "false" ? false : undefined),
      z.boolean().optional(),
    )
    .catch(undefined),
  userId: optionalObjectIdSchema,
  sort: playlistAdminSortSchema.catch("newest"),
  isDeleted: z
    .preprocess(
      (val) => (val === "true" ? true : val === "false" ? false : undefined),
      z.boolean().optional(),
    )
    .catch(undefined),
});

export const playlistTracksParamsSchema = playlistParamsSchema.omit({
  keyword: true,
  tag: true,
  type: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
export const playlistItemSchema = z.object({
  _id: z.string(),
  title: z.string(),
  coverImage: z.string().url().nullable().optional(),
  type: playlistTypeSchema,
  visibility: visibilitySchema,
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
  collaborators: z.array(z.any()),
  trackIds: z.array(z.string()).default([]),
});

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
export type PlaylistCreateFormValues = z.infer<typeof playlistCreateSchema>;
export type PlaylistEditFormValues = z.infer<typeof playlistEditSchema>;
export type PlaylistQuickCreateFormValues = z.infer<
  typeof playlistQuickCreateSchema
>;
export type PlaylistFilterParams = Partial<
  z.infer<typeof playlistParamsSchema>
>;
export type PlaylistAdminFilterParams = Partial<
  z.infer<typeof playlistAdminParamsSchema>
>;
export type PlaylistTracksFilterParams = Partial<
  z.infer<typeof playlistTracksParamsSchema>
>;
export type PlaylistItem = z.infer<typeof playlistItemSchema>;
export type PlaylistDetail = z.infer<typeof playlistDetailSchema>;
export type PlaylistFormValues =
  | PlaylistCreateFormValues
  | PlaylistEditFormValues;
