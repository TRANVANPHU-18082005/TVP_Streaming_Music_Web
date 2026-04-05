import { TrackFormValues } from "../schemas/track.schema";

export const buildTrackPayload = (
  values: TrackFormValues,
  dirtyFields: Partial<Record<keyof TrackFormValues, any>>,
  isEditMode: boolean,
): FormData => {
  const formData = new FormData();

  (Object.keys(values) as Array<keyof TrackFormValues>).forEach((key) => {
    const value = values[key];
    const isFile = value instanceof File;
    const isDirty = !!dirtyFields[key];

    // Gửi nếu: Tạo mới OR Có thay đổi OR Là file mới
    const shouldSend = !isEditMode || isDirty || isFile;

    if (!shouldSend) return;

    // 1. Xử lý Files
    if (isFile) {
      formData.append(key, value as File);
      return;
    }

    // 2. Bỏ qua các URL cũ trong Edit Mode
    if (
      isEditMode &&
      typeof value === "string" &&
      (key === "audio" || key === "coverImage")
    ) {
      return;
    }

    // 3. Xử lý giá trị NULL/Rỗng (Để Backend xóa liên kết)
    if (value === null || value === undefined || value === "") {
      formData.append(key, ""); // Gửi chuỗi rỗng để chỉ định "Clear" field
      return;
    }

    // 4. Xử lý Array (tags, genres...)
    if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value));
    }
    // 5. Xử lý Date
    else if (key === "releaseDate") {
      formData.append(key, new Date(value as string).toISOString());
    }
    // 6. Các trường còn lại
    else {
      formData.append(key, String(value));
    }
  });

  return formData;
};
