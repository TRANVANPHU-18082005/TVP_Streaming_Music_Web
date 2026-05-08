// ─────────────────────────────────────────────────────────────────────────────
// 1. CONSTANTS — mirror backend enums/limits

import z from "zod";

// ─────────────────────────────────────────────────────────────────────────────
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100 MB

const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/svg+xml",
] as const;

const ACCEPTED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/flac",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// 2. REUSABLE PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

/** Hex color — matches backend hexColorSchema */
export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#([0-9A-F]{3}){1,2}$/i, "Mã màu HEX không hợp lệ");

/** Optional nullable string that coerces empty-string → undefined */
export const optionalString = (maxLen: number, maxMsg: string) =>
  z
    .string()
    .trim()
    .max(maxLen, maxMsg)
    .optional()
    .nullable()
    .transform((val) => (val === "" ? undefined : val) ?? undefined);

/** Optional nullable ObjectId-like string (24-char hex)
 * Preprocess empty-like values ("", "null", "undefined") to undefined
 * before applying the ObjectId regex so that clearing a select field
 * (which sends an empty string) does not fail validation.
 */

/** Image File with size/type guards */
export const imageFileSchema = z
  .instanceof(File)
  .refine((f) => f.size <= MAX_IMAGE_SIZE, "Kích thước ảnh tối đa 2MB")
  .refine(
    (f) =>
      ACCEPTED_IMAGE_TYPES.includes(
        f.type as (typeof ACCEPTED_IMAGE_TYPES)[number],
      ),
    "Chỉ nhận .jpg, .jpeg, .png, .webp hoặc .svg",
  );

/** Audio File with size/type guards */
export const audioFileSchema = z
  .instanceof(File)
  .refine((f) => f.size <= MAX_AUDIO_SIZE, "Kích thước nhạc tối đa 100MB")
  .refine(
    (f) =>
      ACCEPTED_AUDIO_TYPES.includes(
        f.type as (typeof ACCEPTED_AUDIO_TYPES)[number],
      ),
    "Chỉ nhận định dạng âm thanh: .mp3, .wav, .flac, .mp4, .m4a, .aac",
  );

export const emptyToUndefined = (val: unknown) => {
  if (typeof val === "string") {
    const trimmed = val.trim();
    return trimmed === "" || trimmed === "null" || trimmed === "undefined"
      ? undefined
      : trimmed;
  }
  return val === null ? undefined : val;
};

export const releaseDateSchema = z
  .preprocess(
    emptyToUndefined,
    z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message:
          "Ngày phát hành không đúng định dạng (ISO 8601 hoặc YYYY-MM-DD)",
      })
      .optional(),
  )
  .transform((val) =>
    val ? new Date(val as string).toISOString().split("T")[0] : undefined,
  );

/** Link MXH chuẩn hóa */
export const socialLinkSchema = z
  .string()
  .trim()
  .url("Định dạng link không hợp lệ")
  .or(z.literal(""))
  .optional()
  .nullable()
  .transform((val) => (val === "" ? undefined : val) ?? undefined);

/** Item trong Gallery: Có thể là File mới hoặc URL cũ */
export const galleryItemSchema = z.union([
  imageFileSchema,
  z.string().url("Link ảnh gallery không hợp lệ"),
]);

// ==========================================
// 1. BASE TYPES
// ==========================================
export const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ");

export const optionalObjectIdSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    const trimmed = val.trim();
    return trimmed === "" || trimmed === "null" || trimmed === "undefined"
      ? undefined
      : trimmed;
  }
  return val === null ? undefined : val;
}, objectIdSchema.optional().nullable());

// ==========================================
// 2. FORM DATA TRANSFORMERS (Lõi xử lý)
// ==========================================

/**
 * 🛠 Helper: Xử lý Boolean (ĐÃ FIX LỖI)
 * - Tôn trọng undefined để .optional() và .default() hoạt động
 * - Ném rác ("abc") xuống cho z.boolean() xử lý để quăng lỗi 400
 */
export const booleanSchema = z.preprocess((val) => {
  // Trả về undefined để Zod lo phần .optional() hoặc .default()
  if (val === "" || val === undefined || val === "null" || val === null) {
    return undefined;
  }
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const lower = val.toLowerCase().trim();
    if (lower === "true" || lower === "1") return true;
    if (lower === "false" || lower === "0") return false;
  }
  if (typeof val === "number") return val === 1;

  return val; // Trả về nguyên gốc để z.boolean() báo lỗi nếu data là rác
}, z.boolean()); // 👈 Bỏ .default(false) ở đây đi để tái sử dụng linh hoạt hơn

export const formDataArrayHelper = <T extends z.ZodTypeAny>(schema: T) => {
  return z.preprocess((val) => {
    if (val === "" || val === undefined || val === "null" || val === null)
      return [];

    if (Array.isArray(val)) return val;

    if (typeof val === "string") {
      const trimmed = val.trim();

      // Nếu là chuỗi dạng JSON Array
      if (trimmed.startsWith("[")) {
        try {
          return JSON.parse(trimmed);
        } catch {
          // 🔥 FIX: Trả về nguyên gốc để Zod tóm cổ và ném lỗi
          // "Expected array, received string" thay vì lấp liếm bằng []
          return val;
        }
      }

      // Nếu là chuỗi cách nhau bằng dấu phẩy
      if (trimmed.includes(",")) {
        return trimmed.split(",").map((i) => i.trim());
      }

      // Nếu chỉ có 1 phần tử dạng string
      return [trimmed];
    }

    return [val];
  }, z.array(schema));
};

// ==========================================
// 3. APPLY TRANSFORMERS TO SPECIFIC FIELDS
// ==========================================

export const nullableObjectIdSchema = z.preprocess(
  emptyToUndefined,
  objectIdSchema.nullable().optional(),
);

// 🎵 Tracks: Mảng ObjectId, max 100
export const trackIdsSchema = formDataArrayHelper(objectIdSchema).pipe(
  z.array(objectIdSchema).max(100, "Chỉ được thêm tối đa 100 bài hát một lần"),
);

// 🎸 Genres: Mảng ObjectId, yêu cầu ít nhất 1
export const genreIdsSchema = formDataArrayHelper(objectIdSchema).pipe(
  z.array(objectIdSchema).min(1, "Vui lòng chọn ít nhất 1 thể loại"),
);

// 🤝 Collaborators: Mảng ObjectId
export const collaboratorsSchema = formDataArrayHelper(objectIdSchema);
export const featuringArtistsSchema = formDataArrayHelper(objectIdSchema);

// 🏷️ Tags: Mảng String, min 1 tag required
export const tagsSchema = formDataArrayHelper(
  z
    .string()
    .trim()
    .min(1, "Tag không được để trống")
    .max(30, "Tag tối đa 30 ký tự"),
).pipe(z.array(z.string()).min(1, "Vui lòng chọn ít nhất 1 tag"));
