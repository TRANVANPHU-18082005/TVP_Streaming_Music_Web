// src/validations/search.schema.ts
import { z } from "zod";

export const searchSchema = z.object({
  query: z.object({
    q: z
      .string()
      .trim()
      .min(1, "Từ khóa tìm kiếm không được để trống")
      .max(100, "Từ khóa quá dài"),
    limit: z.coerce.number().min(1).max(20).default(5),
  }),
});

export type SearchQueryInput = z.infer<typeof searchSchema>["query"];
