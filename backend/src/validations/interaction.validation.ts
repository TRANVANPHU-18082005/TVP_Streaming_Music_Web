// src/validations/interaction.validation.ts
import { z } from "zod";
import { objectIdSchema } from "./common.validate";
const interactionTypeValues = ["like", "follow"] as const;
const interactionTypeSchema = z.enum(interactionTypeValues);
export const interactionValidation = {
  // --- 1. TOGGLE LIKE TRACK ---
  // POST /interactions/like/track/:trackId
  toggleLike: z.object({
    params: z.object({
      trackId: objectIdSchema.describe("ID bài hát không hợp lệ"),
    }),
  }),

  // --- 2. TOGGLE FOLLOW ARTIST ---
  // POST /interactions/follow/artist/:artistId
  toggleFollow: z.object({
    params: z.object({
      artistId: objectIdSchema.describe("ID nghệ sĩ không hợp lệ"),
    }),
  }),

  // --- 3. BATCH CHECK ---
  // POST /interactions/check-batch
  batchCheck: z.object({
    body: z.object({
      // ids: Phải là mảng các ObjectId
      ids: z
        .array(objectIdSchema)
        .min(1, "Danh sách ID không được để trống")
        .max(100, "Không thể kiểm tra quá 100 mục cùng lúc"),

      // type: Chỉ chấp nhận 'like' hoặc 'follow'
      type: interactionTypeSchema.default("like"),
    }),
  }),
};

// --- TYPES EXPORT ---
export type ToggleLikeParams = z.infer<
  typeof interactionValidation.toggleLike
>["params"];
export type ToggleFollowParams = z.infer<
  typeof interactionValidation.toggleFollow
>["params"];
export type BatchCheckInput = z.infer<
  typeof interactionValidation.batchCheck
>["body"];
