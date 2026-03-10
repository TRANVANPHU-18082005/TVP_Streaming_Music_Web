import { z } from "zod";
import {
  booleanSchema,
  hexColorSchema,
  objectIdSchema,
  nullableObjectIdSchema,
  emptyToUndefined,
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
export const getGenresSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    // Hỗ trợ "all" limit cho dropdown tree
    limit: z.union([z.coerce.number().min(1), z.literal("all")]).default(20),

    keyword: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    status: z.enum(["active", "inactive"]).optional(),

    // Hỗ trợ ID chuẩn HOẶC chữ "root"
    parentId: z.preprocess(
      emptyToUndefined,
      z.union([objectIdSchema, z.literal("root")]).optional(),
    ),

    isTrending: booleanSchema.optional(),

    sort: z
      .enum(["popular", "priority", "newest", "oldest", "name"])
      .default("priority"),
  }),
});

export type CreateGenreInput = z.infer<typeof createGenreSchema>["body"];
export type UpdateGenreInput = z.infer<typeof updateGenreSchema>["body"];
export type GenreFilterInput = z.infer<typeof getGenresSchema>["query"];
