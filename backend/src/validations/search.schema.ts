import { z } from "zod";

export const searchSchema = z.object({
  query: z.object({
    // Trim khoảng trắng 2 đầu, bắt buộc phải có ít nhất 1 ký tự
    q: z.string().trim().min(1, "Vui lòng nhập từ khóa tìm kiếm"),

    // 🔥 Xóa preprocess thủ công. z.coerce tự ép kiểu, nếu fail nó quăng lỗi validation
    // chứ không sập server, Frontend sẽ nhận mã 400 rõ ràng.
    limit: z.coerce.number().min(1).max(50).default(10),
  }),
});

export type SearchQueryInput = z.infer<typeof searchSchema>["query"];
