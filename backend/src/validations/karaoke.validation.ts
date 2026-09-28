// validations/karaoke.validation.ts

import { z } from "zod";
import {
  objectIdSchema,
  optionalObjectIdSchema,
  emptyToUndefined,
  booleanSchema,
  tagsSchema,
} from "./common.validate";
import { APP_CONFIG } from "../config/constants";

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

const karaokeStatusEnum = z.enum([
  "uploaded",
  "pending_review",
  "approved",
  "rejected",
]);

const karaokeSortEnum = z.enum([
  "newest",
  "oldest",
  "popular",
  "most_liked",
]);

// ─────────────────────────────────────────────────────────────────────────────
// 1. UPLOAD RECORDING (User gửi audio lên cloud)
// ─────────────────────────────────────────────────────────────────────────────

export const uploadRecordingSchema = z.object({
  body: z
    .object({
      title: z
        .string()
        .trim()
        .min(1, "Tiêu đề là bắt buộc")
        .max(200, "Tiêu đề không được vượt quá 200 ký tự"),
      youtubeVideoId: z
        .string()
        .trim()
        .min(1, "YouTube Video ID là bắt buộc")
        .max(20, "YouTube Video ID không hợp lệ"),
      youtubeTitle: z
        .string()
        .trim()
        .min(1, "Tên video YouTube là bắt buộc")
        .max(300, "Tên video YouTube quá dài"),
      youtubeThumbnail: z.string().trim().url().optional(),
      description: z.string().max(1000, "Mô tả không được vượt quá 1000 ký tự").optional(),
      tags: tagsSchema.optional(),
      audioDuration: z.coerce.number().min(1, "Thời lượng phải lớn hơn 0"),
    })
    .strict(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. UPDATE RECORDING (User chỉnh sửa metadata — chỉ khi status = uploaded)
// ─────────────────────────────────────────────────────────────────────────────

export const updateRecordingSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z
    .object({
      title: z.string().trim().min(1).max(200).optional(),
      description: z.string().max(1000).optional(),
      tags: tagsSchema.optional(),
    })
    .strict()
    .refine(
      (data) => Object.values(data).some((v) => v !== undefined),
      "Phải cung cấp ít nhất một trường để cập nhật",
    ),
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. SUBMIT FOR REVIEW (User gửi yêu cầu duyệt)
// ─────────────────────────────────────────────────────────────────────────────

export const submitForReviewSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. DELETE RECORDING
// ─────────────────────────────────────────────────────────────────────────────

export const deleteRecordingSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET RECORDINGS (Filter, paging)
// ─────────────────────────────────────────────────────────────────────────────

export const getRecordingsSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).max(APP_CONFIG.MAX_PAGES).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
      keyword: z.preprocess(
        emptyToUndefined,
        z.string().trim().min(1).max(100).optional(),
      ),
      userId: optionalObjectIdSchema,
      status: z.preprocess(emptyToUndefined, karaokeStatusEnum.optional()),
      sort: karaokeSortEnum.default("newest"),
    })
    .strict(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. GET RECORDING DETAIL
// ─────────────────────────────────────────────────────────────────────────────

export const getRecordingDetailSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. ADMIN: REVIEW RECORDING (Approve / Reject)
// ─────────────────────────────────────────────────────────────────────────────

export const adminReviewSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z
    .object({
      action: z.enum(["approve", "reject"]),
      rejectionReason: z.string().max(500).optional(),
      reviewNote: z.string().max(500).optional(),
    })
    .strict()
    .refine(
      (data) => {
        // Nếu reject thì bắt buộc phải có lý do
        if (data.action === "reject" && !data.rejectionReason?.trim()) {
          return false;
        }
        return true;
      },
      { message: "Vui lòng cung cấp lý do từ chối", path: ["rejectionReason"] },
    ),
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. ADMIN: GET PENDING RECORDINGS
// ─────────────────────────────────────────────────────────────────────────────

export const adminGetRecordingsSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).max(APP_CONFIG.MAX_PAGES).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
      status: z.preprocess(emptyToUndefined, karaokeStatusEnum.optional()),
      keyword: z.preprocess(
        emptyToUndefined,
        z.string().trim().min(1).max(100).optional(),
      ),
      sort: karaokeSortEnum.default("newest"),
    })
    .strict(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. ADMIN: GRANT/UPDATE KARAOKE PERMISSION
// ─────────────────────────────────────────────────────────────────────────────

export const grantPermissionSchema = z.object({
  params: z.object({ userId: objectIdSchema }),
  body: z
    .object({
      uploadEnabled: booleanSchema,
      uploadLimit: z.coerce.number().int().min(-1).max(10000).default(5),
      maxDuration: z.coerce.number().int().min(0).max(7200).default(600),   // Max 2h
      maxFileSize: z.coerce.number().int().min(0).default(50 * 1024 * 1024), // Default 50MB
      note: z.string().max(500).optional(),
    })
    .strict(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. ADMIN: REVOKE KARAOKE PERMISSION
// ─────────────────────────────────────────────────────────────────────────────

export const revokePermissionSchema = z.object({
  params: z.object({ userId: objectIdSchema }),
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. ADMIN: GET ALL PERMISSIONS (danh sách user đã cấp quyền)
// ─────────────────────────────────────────────────────────────────────────────

export const getPermissionsSchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).max(APP_CONFIG.MAX_PAGES).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
      uploadEnabled: booleanSchema.optional(),
      keyword: z.preprocess(
        emptyToUndefined,
        z.string().trim().min(1).max(100).optional(),
      ),
    })
    .strict(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. USER: CHECK MY PERMISSION
// ─────────────────────────────────────────────────────────────────────────────

// Không cần schema — chỉ dùng protect middleware

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type UploadRecordingInput = z.infer<typeof uploadRecordingSchema>["body"];
export type UpdateRecordingInput = z.infer<typeof updateRecordingSchema>["body"];
export type AdminReviewInput = z.infer<typeof adminReviewSchema>["body"];
export type GrantPermissionInput = z.infer<typeof grantPermissionSchema>["body"];
export type RecordingFilterInput = z.infer<typeof getRecordingsSchema>["query"];
export type AdminRecordingFilterInput = z.infer<typeof adminGetRecordingsSchema>["query"];
export type PermissionFilterInput = z.infer<typeof getPermissionsSchema>["query"];
