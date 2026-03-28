import { z } from "zod";
import { objectIdSchema, emptyToUndefined } from "./common.validate";

// --- CONSTANTS ---
const targetTypeValues = ["track", "album", "playlist", "artist"] as const;
const interactionTypeValues = ["like", "follow"] as const;

// -----------------------------------------------------------------------------
// 🚀 1. TOGGLE LIKE SCHEMA
// -----------------------------------------------------------------------------
export const toggleLikeSchema = z.object({
  body: z
    .object({
      // Sử dụng preprocess để xử lý dữ liệu từ FormData (chuỗi rỗng "" -> undefined)
      targetId: z.preprocess(
        emptyToUndefined,
        objectIdSchema.describe("ID đối tượng không hợp lệ hoặc bị trống"),
      ),

      targetType: z
        .enum(targetTypeValues)
        .refine((val) => targetTypeValues.includes(val), {
          message: "Loại đối tượng phải là track, album hoặc playlist",
        }),
    })
    .strict(),
});

// -----------------------------------------------------------------------------
// 👥 2. TOGGLE FOLLOW SCHEMA
// -----------------------------------------------------------------------------
export const toggleFollowSchema = z.object({
  params: z.object({
    artistId: objectIdSchema.describe("ID nghệ sĩ không hợp lệ"),
  }),
});

// -----------------------------------------------------------------------------
// ⚡ 3. BATCH CHECK SCHEMA
// -----------------------------------------------------------------------------
export const batchCheckSchema = z.object({
  body: z
    .object({
      // Giới hạn 100 IDs để bảo vệ tài nguyên hệ thống
      ids: z
        .array(objectIdSchema)
        .min(1, "Danh sách ID không được để trống")
        .max(100, "Không thể kiểm tra quá 100 mục cùng lúc"),

      type: z
        .enum(interactionTypeValues)
        .refine((val) => interactionTypeValues.includes(val), {
          message: "Loại tương tác phải là like hoặc follow",
        }),

      targetType: z.preprocess(
        emptyToUndefined,
        z.enum(targetTypeValues).optional(),
      ),
    })
    .strict()
    .refine(
      (data) => {
        // Business Logic: Nếu type là 'like' thì bắt buộc phải có targetType
        if (data.type === "like") return !!data.targetType;
        return true;
      },
      {
        message: "targetType là bắt buộc khi kiểm tra trạng thái Like",
        path: ["targetType"],
      },
    ),
});

// -----------------------------------------------------------------------------
// 🔥 TYPES EXPORT (Dùng cho Services/Controllers)
// -----------------------------------------------------------------------------
export type ToggleLikeInput = z.infer<typeof toggleLikeSchema>["body"];
export type ToggleFollowInput = z.infer<typeof toggleFollowSchema>["params"];
export type BatchCheckInput = z.infer<typeof batchCheckSchema>["body"];
