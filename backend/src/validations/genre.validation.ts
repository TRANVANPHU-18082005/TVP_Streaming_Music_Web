import { z } from "zod";
import {
  booleanSchema,
  hexColorSchema,
  objectIdSchema,
  nullableObjectIdSchema,
  emptyToUndefined,
  optionalObjectIdSchema,
} from "./common.validate";

// 1. CREATE GENRE
export const createGenreSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(50),
    description: z.string().trim().max(500).optional(),

    parentId: nullableObjectIdSchema, // Trả về ObjectId hoặc null an toàn

    color: hexColorSchema.optional().default("#6366f1"),
    gradient: z.string().optional(),

    priority: z.coerce.number().default(0),
    isTrending: booleanSchema.default(false),
  }),
});

// 2. UPDATE GENRE
export const updateGenreSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    name: z.string().trim().min(2).max(50).optional(),
    description: z.string().trim().max(500).optional(),

    parentId: nullableObjectIdSchema, // Dùng chung chuẩn

    color: hexColorSchema.optional(),
    gradient: z.string().optional(),

    priority: z.coerce.number().optional(),
    isTrending: booleanSchema.optional(),
    isActive: booleanSchema.optional(),
  }),
});

// 3. GET LIST (Filter)
// features/genre/schemas/genre.schema.ts

export const getGenresSchema = z.object({
  query: z
    .object({
      // 1. Phân trang: Hỗ trợ cả số và từ khóa "all"
      page: z.coerce.number().int().min(1).default(1),
      limit: z
        .preprocess(
          (val) => (val === "all" ? "all" : val),
          z.union([z.coerce.number().int().min(1).max(100), z.literal("all")]),
        )
        .default(20),

      // 2. Search & Filter: Chống ReDoS bằng giới hạn độ dài
      keyword: z.preprocess(
        (val) => (val === "" ? undefined : val),
        z.string().trim().max(100).optional(),
      ),

      status: z.enum(["active", "inactive", "all"]).default("all"),

      // 3. Tree Logic: Hỗ trợ lọc theo cha hoặc lọc các gốc (root)
      parentId: z.preprocess(
        (val) => (val === "" || val === "undefined" ? undefined : val),
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
export const getGenreTracksSchema = getGenresSchema.extend({
  query: getGenresSchema.shape.query.omit({
    parentId: true,
  }),
});
export type CreateGenreInput = z.infer<typeof createGenreSchema>["body"];
export type UpdateGenreInput = z.infer<typeof updateGenreSchema>["body"];
export type GenreFilterInput = z.infer<typeof getGenresSchema>["query"];
