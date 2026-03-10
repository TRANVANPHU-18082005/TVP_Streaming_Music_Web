import { z } from "zod";
import { objectIdSchema, optionalObjectIdSchema } from "./common.validate";

// 1. TOGGLE FOLLOW SCHEMA
export const toggleFollowSchema = z.object({
  body: z.object({
    followingId: objectIdSchema, // Validate chuẩn ObjectId
  }),
});

// 2. CHECK FOLLOW STATUS SCHEMA
export const checkFollowSchema = z.object({
  params: z.object({
    followingId: objectIdSchema,
  }),
});

// 3. GET FOLLOW LIST SCHEMA
export const getFollowListSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),

    // Dùng helper chuẩn để tránh crash khi gửi lên ?userId= (chuỗi rỗng)
    userId: optionalObjectIdSchema,
  }),
});

// --- TYPES ---
export type ToggleFollowInput = z.infer<typeof toggleFollowSchema>["body"];
export type GetFollowListInput = z.infer<typeof getFollowListSchema>["query"];
