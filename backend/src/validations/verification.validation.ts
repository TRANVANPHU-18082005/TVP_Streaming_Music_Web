import { z } from "zod";
import {
  objectIdSchema,
  optionalObjectIdSchema,
  formDataArrayHelper,
} from "./common.validate";

// --- USER SUBMIT ---
export const submitVerificationSchema = z.object({
  body: z.object({
    artistName: z.string().trim().min(1, "Tên nghệ danh là bắt buộc").max(100),

    artistId: optionalObjectIdSchema, // Dùng helper chuẩn để xử lý chuỗi rỗng

    realName: z.string().trim().min(1, "Họ tên thật là bắt buộc").max(100),

    // 🔥 Dùng Helper xử lý Array từ FormData và validate từng URL bên trong
    socialLinks: formDataArrayHelper(
      z.string().trim().url("Link MXH không hợp lệ"),
    ).array().min(1, "Cần cung cấp ít nhất 1 link MXH hợp lệ"),

    emailWork: z.string().trim().email("Email không hợp lệ").toLowerCase(),
    // File upload (idCardImages) sẽ do Multer lo
  }),
});

// --- ADMIN REVIEW ---
export const reviewVerificationSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z
    .object({
      status: z.enum(["approved", "rejected"]),
      rejectReason: z.string().trim().optional(),
    })
    .refine((data) => !(data.status === "rejected" && !data.rejectReason), {
      message: "Vui lòng nhập lý do từ chối",
      path: ["rejectReason"],
    }),
});

export type SubmitVerificationInput = z.infer<
  typeof submitVerificationSchema
>["body"];
export type ReviewVerificationInput = z.infer<
  typeof reviewVerificationSchema
>["body"];
