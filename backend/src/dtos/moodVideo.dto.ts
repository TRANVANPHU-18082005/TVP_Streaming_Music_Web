import { z } from "zod";
import {
  createMoodVideoSchema,
  updateMoodVideoSchema,
  getMoodVideosSchema,
} from "../validations/moodVideo.validation";

// --- INPUT DTOs (Dùng cho Request) ---
export type CreateMoodVideoInput = z.infer<
  typeof createMoodVideoSchema
>["body"];
export type UpdateMoodVideoInput = z.infer<
  typeof updateMoodVideoSchema
>["body"];
export type MoodVideoFilterInput = z.infer<typeof getMoodVideosSchema>["query"];

// --- RESPONSE DTO (Dùng để trả về cho Frontend) ---
export interface MoodVideoResponseDTO {
  _id: string;
  title: string;
  slug: string;

  // URL video đã qua xử lý (bỏ tiếng, ép size)
  videoUrl: string;

  // URL ảnh đại diện trích xuất từ video
  thumbnailUrl: string;

  tags: string[];
  isActive: boolean;

  // Thống kê sử dụng
  usageCount: number;

  createdAt: Date;
  updatedAt: Date;
}
