// src/validations/search.schema.ts
import { z } from "zod";

export const searchSchema = z.object({
  query: z.object({
    q: z
      .string()
      .trim()
      .min(1, "Từ khóa tìm kiếm không được để trống")
      .max(100, "Từ khóa quá dài")
      .regex(/^[\p{L}\p{N}\s\-&]+$/u, "Từ khóa không hợp lệ")
      .refine((val) => /[\p{L}\p{N}]/u.test(val), {
        message: "Từ khóa phải chứa chữ hoặc số",
      }),
    limit: z.coerce.number().min(1).max(20).default(5),
  }),
});
export type SearchQueryInput = z.infer<typeof searchSchema>["query"];
