import { Model, Types } from "mongoose";
import { nanoid } from "nanoid";
import slugify from "slugify";

export const generatePlaylistSlug = (title: string): string => {
  const base = slugify(title, { lower: true, locale: "vi", strict: true });
  // Thêm 6 ký tự ngẫu nhiên (đủ cho hàng tỷ bản ghi mà URL vẫn ngắn gọn)
  return `${base || "playlist"}-${nanoid(6)}`;
};
/**
 * 1. Tạo slug cơ bản
 * Đã fix: Trả về fallback nếu chuỗi gốc bị strip hết thành rỗng
 */
export const stringToSlug = (str: string): string => {
  const slug = slugify(str, {
    lower: true,
    locale: "vi",
    strict: true,
    trim: true,
  });

  // Nếu chuỗi toàn ký tự đặc biệt -> sinh random để không bị lỗi rỗng
  return slug || `untitled-${Math.random().toString(36).substring(2, 8)}`;
};

/**
 * 2. Tạo Slug Duy Nhất Tối Ưu (Fix Performance & Hỗ trợ Update)
 * Thay vì lặp N lần, ta dùng Regex tìm thằng to nhất và +1.
 */
export const generateUniqueSlug = async (
  model: Model<any>,
  fieldValue: string,
  excludeId?: string | Types.ObjectId, // Dùng khi Update (bỏ qua ID hiện tại)
  slugField: string = "slug",
): Promise<string> => {
  const baseSlug = stringToSlug(fieldValue);

  // Tạo query: Tìm chính nó hoặc bỏ qua chính nó (nếu đang Edit)
  const query: any = {
    [slugField]: new RegExp(`^${baseSlug}(-[0-9]+)?$`, "i"),
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  // Lấy TẤT CẢ các slug giống baseSlug
  const existingDocs = await model.find(query).select(slugField).lean();

  if (existingDocs.length === 0) {
    return baseSlug; // Chưa ai dùng, lấy luôn
  }

  // Tìm hậu tố (số) lớn nhất
  let maxSuffix = 0;
  existingDocs.forEach((doc: any) => {
    const slugStr = doc[slugField];
    if (slugStr === baseSlug) return;

    // Tách phần số ở đuôi (VD: "nhac-tre-15" -> "15")
    const suffix = parseInt(slugStr.replace(`${baseSlug}-`, ""), 10);
    if (!isNaN(suffix) && suffix > maxSuffix) {
      maxSuffix = suffix;
    }
  });

  // Trả về slug mới bằng Max + 1 (Chỉ tốn đúng 1 query DB)
  return `${baseSlug}-${maxSuffix + 1}`;
};

/**
 * 3. Tạo Slug kèm Short ID
 * Đã fix: Hỗ trợ excludeId khi Update
 */
export const generateSafeSlug = async (
  model: Model<any>,
  fieldValue: string,
  excludeId?: string | Types.ObjectId,
): Promise<string> => {
  const baseSlug = stringToSlug(fieldValue);

  // KIỂM TRA NHANH: Nếu baseSlug chưa ai dùng, ta lấy luôn baseSlug (Tốt cho SEO)
  const query: any = { slug: baseSlug };
  if (excludeId) query._id = { $ne: excludeId };

  const isUsed = await model.exists(query);
  if (!isUsed) return baseSlug;

  // Nếu đã có người dùng, lúc này mới bắt đầu gắn Random ID
  let uniqueSlug = "";
  let isDuplicate = true;

  while (isDuplicate) {
    const shortId = Math.random().toString(36).substring(2, 8);
    uniqueSlug = `${baseSlug}-${shortId}`;

    const randomQuery: any = { slug: uniqueSlug };
    if (excludeId) randomQuery._id = { $ne: excludeId };

    const existing = await model.exists(randomQuery);
    if (!existing) {
      isDuplicate = false;
    }
  }

  return uniqueSlug;
};
