import { z } from "zod";
import { objectIdSchema, emptyToUndefined } from "./common.validate";

// --- CONSTANTS ---
const likedTargetTypeValues = ["track", "album", "playlist"] as const;

// -----------------------------------------------------------------------------
// 📊 1. GET LIKED CONTENT SCHEMA (Query Validation)
// -----------------------------------------------------------------------------
export const getLikedContentSchema = z.object({
  query: z
    .object({
      type: z
        .enum(likedTargetTypeValues)
        .describe("Loại nội dung yêu thích: track, album hoặc playlist"),

      page: z.preprocess(
        (val) => (val ? parseInt(val as string, 10) : 1),
        z.number().min(1).default(1),
      ),

      limit: z.preprocess(
        (val) => (val ? parseInt(val as string, 10) : 20),
        z.number().min(1).max(50).default(20),
      ),
    })
    .strict(),
});

// -----------------------------------------------------------------------------
// 📝 2. UPDATE PROFILE SCHEMA (Body Validation)
// -----------------------------------------------------------------------------
export const updateProfileSchema = z.object({
  body: z
    .object({
      name: z.preprocess(
        emptyToUndefined,
        z
          .string()
          .min(2, "Tên hiển thị phải có ít nhất 2 ký tự")
          .max(50, "Tên hiển thị không được vượt quá 50 ký tự")
          .optional(),
      ),

      bio: z.preprocess(
        emptyToUndefined,
        z.string().max(200, "Tiểu sử không được vượt quá 200 ký tự").optional(),
      ),

      avatar: z.preprocess(
        emptyToUndefined,
        z.string().url("Đường dẫn ảnh đại diện không hợp lệ").optional(),
      ),
    })
    .strict()
    // Đảm bảo body không được rỗng khi gửi request patch
    .refine((data) => Object.keys(data).length > 0, {
      message: "Phải cung cấp ít nhất một trường thông tin để cập nhật",
    }),
});

// -----------------------------------------------------------------------------
// 📈 3. GET ANALYTICS SCHEMA
// -----------------------------------------------------------------------------
export const getAnalyticsSchema = z.object({
  query: z
    .object({
      range: z.enum(["7d", "30d"]).default("7d"),
    })
    .strict(),
});

// -----------------------------------------------------------------------------
// 🔥 TYPES EXPORT
// -----------------------------------------------------------------------------
export type GetLikedContentInput = z.infer<
  typeof getLikedContentSchema
>["query"];
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>["body"];
export type GetAnalyticsInput = z.infer<typeof getAnalyticsSchema>["query"];
