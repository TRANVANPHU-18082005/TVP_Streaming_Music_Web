import { z } from "zod";
import {
  booleanSchema,
  emptyToUndefined,
  objectIdSchema,
  tagsSchema, // Giả định đã xử lý JSON.parse hoặc split(',') bên trong
} from "./common.validate";

// --- 1. CREATE MOOD VIDEO SCHEMA ---
export const createMoodVideoSchema = z.object({
  body: z.object({
    title: z
      .string()
      .trim()
      .min(3, "Tiêu đề tâm trạng tối thiểu 3 ký tự")
      .max(100),

    // Xử lý tags: Chuyển chuỗi từ FormData thành mảng
    tags: tagsSchema.optional(),

    // isActive thường gửi từ checkbox/switch của FormData (chuỗi "true"/"false")
    isActive: booleanSchema.default(true),
  }),
});

// --- 2. UPDATE MOOD VIDEO SCHEMA ---
export const updateMoodVideoSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    title: z.string().trim().min(3).max(100).optional(),
    tags: tagsSchema.optional(),
    isActive: booleanSchema.optional(),
  }),
});

// --- 3. GET MOOD VIDEOS SCHEMA (Filter) ---
export const getMoodVideosSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(12),

    // Tìm kiếm theo tên hoặc tag
    keyword: z.preprocess(emptyToUndefined, z.string().trim().optional()),

    // Lọc theo trạng thái hoạt động
    isActive: booleanSchema.optional(),

    sort: z.enum(["newest", "oldest", "name", "popular"]).default("newest"),
  }),
});
export type CreateMoodVideoInput = z.infer<
  typeof createMoodVideoSchema
>["body"];
export type UpdateMoodVideoInput = z.infer<
  typeof updateMoodVideoSchema
>["body"];
export type MoodVideoFilterInput = z.infer<typeof getMoodVideosSchema>["query"];
