import { MoodVideoFormValues } from "../schemas/moodVideo.schema";

export const buildMoodVideoPayload = (
  values: MoodVideoFormValues,
  dirtyFields: Partial<Record<keyof MoodVideoFormValues, boolean>>,
  isEditMode: boolean,
): FormData => {
  const formData = new FormData();

  // 1. Xử lý file Video (Chỉ gửi nếu là File mới)
  if (values.video instanceof File) {
    formData.append("video", values.video);
  }

  // 2. Xử lý các trường text/boolean
  (Object.keys(values) as Array<keyof MoodVideoFormValues>).forEach((key) => {
    if (key === "video") return;

    // Gửi dữ liệu nếu:
    // - Đang tạo mới (isEditMode = false)
    // - Hoặc trường đó đã bị thay đổi (dirtyFields[key] = true)
    const shouldSend = !isEditMode || dirtyFields[key];

    if (shouldSend) {
      const value = values[key];
      if (Array.isArray(value)) {
        // Mảng (tags) cần stringify để Backend parseTags nhận diện được
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    }
  });

  return formData;
};
