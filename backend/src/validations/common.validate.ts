import { z } from "zod";

// ==========================================
// 1. BASE TYPES
// ==========================================
export const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ");

export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, "Mã màu Hex không hợp lệ");

export const socialLinkSchema = z
  .union([
    z.string().trim().url("Link không đúng định dạng URL"),
    z.literal(""),
  ])
  .optional();

// ==========================================
// 2. FORM DATA TRANSFORMERS (Lõi xử lý)
// ==========================================

export const emptyToUndefined = (val: unknown) => {
  if (val === "" || val === "null" || val === "undefined" || val === null) {
    return undefined;
  }
  return val;
};

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

export const optionalObjectIdSchema = z.preprocess(
  emptyToUndefined,
  objectIdSchema.optional(),
);

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

// 🏷️ Tags: Mảng String
export const tagsSchema = formDataArrayHelper(
  z.string().trim().min(1, "Tag không được để trống"),
);
