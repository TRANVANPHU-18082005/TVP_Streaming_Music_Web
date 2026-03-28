import { z } from "zod";

// --- CONSTANTS ---
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

export const profileSchema = z.object({
  // 1. THÔNG TIN CƠ BẢN
  name: z
    .string({ required_error: "Vui lòng nhập tên hiển thị" })
    .trim()
    .min(2, "Tên phải có ít nhất 2 ký tự")
    .max(50, "Tên không được vượt quá 50 ký tự"),

  bio: z
    .string()
    .trim()
    .max(200, "Tiểu sử không được vượt quá 200 ký tự")
    .optional()
    .nullable()
    // Tự động chuyển chuỗi rỗng thành undefined để hợp lệ với DB
    .transform((val) => (val === "" ? undefined : val)),

  // 2. AVATAR (Hỗ trợ cả File upload và URL string khi hiển thị/edit)
  avatar: z
    .any()
    .optional()
    .nullable()
    .refine((file) => {
      // Chấp nhận: rỗng, null, string (URL cũ), hoặc đối tượng File (ảnh mới)
      if (!file || typeof file === "string") return true;
      return file instanceof File;
    }, "Ảnh đại diện phải là file hoặc đường dẫn hợp lệ")
    .refine((file) => {
      if (file instanceof File) return file.size <= MAX_FILE_SIZE;
      return true;
    }, "Kích thước ảnh tối đa là 5MB")
    .refine((file) => {
      if (file instanceof File) return ACCEPTED_IMAGE_TYPES.includes(file.type);
      return true;
    }, "Chỉ chấp nhận định dạng .jpg, .jpeg, .png, .webp"),

  // 3. THÔNG TIN KHÁC (Nếu Phú muốn mở rộng sau này)
  location: z
    .string()
    .trim()
    .max(100, "Địa danh không quá 100 ký tự")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? undefined : val)),

  website: z
    .string()
    .trim()
    .url("Đường dẫn website không hợp lệ")
    .optional()
    .nullable()
    .transform((val) => (val === "" ? undefined : val)),
});

// Loại bỏ các trường lồng nhau để dùng trực tiếp cho React Hook Form
export type ProfileFormValues = z.infer<typeof profileSchema>;
