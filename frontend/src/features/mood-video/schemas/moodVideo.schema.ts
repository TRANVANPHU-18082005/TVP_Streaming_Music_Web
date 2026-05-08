import { z } from "zod";

const MAX_VIDEO_SIZE = 20 * 1024 * 1024; // 20MB
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export const moodVideoSchema = z.object({
  title: z.string().trim().min(3, "Tiêu đề tối thiểu 3 ký tự").max(100),

  tags: z
    .array(z.string().trim().min(1))
    .min(1, "Vui lòng nhập ít nhất 1 tag (vd: chill, sad)")
    .default([]),

  isActive: z.boolean().default(true),

  video: z
    .any()
    .optional()
    .nullable()
    .refine((file) => {
      if (!file || typeof file === "string") return true;
      return file instanceof File;
    }, "Video phải là file hoặc đường dẫn hợp lệ")
    .refine((file) => {
      if (file instanceof File) return file.size <= MAX_VIDEO_SIZE;
      return true;
    }, "Kích thước video tối đa 20MB")
    .refine((file) => {
      if (file instanceof File) return ACCEPTED_VIDEO_TYPES.includes(file.type);
      return true;
    }, "Chỉ chấp nhận định dạng .mp4, .mov, .webm"),
});

export type MoodVideoFormValues = z.infer<typeof moodVideoSchema>;
