import { z } from "zod";

/**
 * 1. Schema cho Full Search (Trang kết quả tìm kiếm)
 */
export const searchInputSchema = z.object({
  q: z.string().trim(), // Cho phép chuỗi rỗng để UI xử lý trạng thái ban đầu
  limit: z.number().min(1).max(50).optional().default(10),
});

/**
 * 2. Schema cho Autocomplete Suggestion (Dropdown khi đang gõ)
 */
export const suggestInputSchema = z.object({
  q: z.string().trim().min(1, "Từ khóa gợi ý không được để trống"),
  limit: z.number().min(1).max(10).optional().default(5),
});

/**
 * 3. Schema cho Trending Keywords
 */
export const trendingInputSchema = z.object({
  top: z.number().min(1).max(20).optional().default(10),
});

// --- Export Types ---
export type SearchInput = z.infer<typeof searchInputSchema>;
export type SuggestInput = z.infer<typeof suggestInputSchema>;
export type TrendingInput = z.infer<typeof trendingInputSchema>;
