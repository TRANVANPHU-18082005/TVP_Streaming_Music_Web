import { z } from "zod";
import {
  booleanSchema,
  hexColorSchema,
  objectIdSchema,
  nullableObjectIdSchema,
  optionalObjectIdSchema,
  emptyToUndefined,
} from "./common.validate";
import { APP_CONFIG } from "../config/constants";

// 1. CREATE GENRE
export const createGenreSchema = z.object({
  body: z
    .object({
      name: z
        .string({ message: "Tên thể loại là bắt buộc" })
        .trim()
        .min(2, { message: "Tên thể loại phải có ít nhất 2 ký tự" })
        .max(50, { message: "Tên thể loại tối đa 50 ký tự" }),
      description: z
        .string({ message: "Mô tả là bắt buộc" })
        .trim()
        .max(500, { message: "Mô tả tối đa 500 ký tự" })
        .optional(),
      parentId: nullableObjectIdSchema,
      color: hexColorSchema.optional(),
      gradient: z.string().optional(),
      priority: z.coerce.number().default(0),
      isTrending: booleanSchema.default(false),
    })
    .strict(), // Chặn field lạ không nằm trong whitelist
});

// 2. UPDATE GENRE
export const updateGenreSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(2, { message: "Tên thể loại phải có ít nhất 2 ký tự" })
        .max(50, { message: "Tên thể loại tối đa 50 ký tự" })
        .optional(),
      description: z
        .string()
        .trim()
        .max(500, { message: "Mô tả tối đa 500 ký tự" })
        .optional(),
      // Allow empty string or null to explicitly clear the parent on update
      parentId: z.union([objectIdSchema, z.literal(""), z.null()]).optional(),
      color: hexColorSchema.optional(),
      gradient: z.string().optional(),
      priority: z.coerce.number().optional(),
      isTrending: booleanSchema.optional(),
    })
    .strict(), // Chặn field lạ không nằm trong whitelist
});
// 3. DELETE GENRE
export const deleteGenreSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});
// 4. TOGGLE GENRE STATUS
export const toggleGenreStatusSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});
// 5. GET LIST BY USER (Filter)
export const getGenresByUserSchema = z.object({
  query: z
    .object({
      // 1. Phân trang: Hỗ trợ cả số và từ khóa "all"
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
      parentId: z.preprocess(
        emptyToUndefined,
        z.union([optionalObjectIdSchema, z.literal("root")]).optional(),
      ),

      isTrending: z.preprocess(
        (val) => (val === "true" ? true : val === "false" ? false : undefined),
        z.boolean().optional(),
      ),

      // 4. Sort: Theo độ ưu tiên (priority) hoặc độ phổ biến
      sort: z
        .enum(["popular", "priority", "newest", "oldest", "name"])
        .default("priority"),
    })
    .strict(), // 🔥 Chặn đứng các tham số lạ
});
// 6. GET LIST BY ADMIN (Có thêm filter isActive, isDeleted)
export const getGenresByAdminSchema = getGenresByUserSchema.extend({
  query: getGenresByUserSchema.shape.query.extend({
    isActive: z.preprocess((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined; // Nếu không phải true/false thì trả về undefined để Zod báo lỗi
    }, z.boolean().optional()),
    isDeleted: z.preprocess((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined; // Nếu không phải true/false thì trả về undefined để Zod báo lỗi
    }, z.boolean().optional()),
  }),
});
// 7. GET GENRE TRACKS (Dùng chung filter với User, nhưng bỏ parentId vì không cần thiết)
export const getGenreTracksSchema = getGenresByUserSchema.extend({
  query: getGenresByUserSchema.shape.query.omit({
    parentId: true,
    sort: true, // Không cần sort khi lấy tracks của genre
    isTrending: true, // Không cần filter trending khi lấy tracks của genre
    keyword: true, // Không cần filter keyword khi lấy tracks của genre
  }),
});
// 8. GET GENRE DETAIL (Dùng chung schema với User, không có filter nào cả)
export const getGenreDetailSchema = z.object({
  params: z.object({ slug: z.string().trim().min(2).max(100) }),
});
export type CreateGenreInput = z.infer<typeof createGenreSchema>["body"];
export type UpdateGenreInput = z.infer<typeof updateGenreSchema>["body"];
export type GenreUserFilterInput = z.infer<
  typeof getGenresByUserSchema
>["query"];
export type GenreAdminFilterInput = z.infer<
  typeof getGenresByAdminSchema
>["query"];
