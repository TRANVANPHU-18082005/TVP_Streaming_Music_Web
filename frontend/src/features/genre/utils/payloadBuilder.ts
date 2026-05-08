// utils/payloadBuilder.ts
import {
  GenreCreateFormValues,
  GenreEditFormValues,
} from "../schemas/genre.schema";

type FormValues = GenreCreateFormValues | GenreEditFormValues;

const serializeValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
};

export const buildGenrePayload = (
  values: FormValues,
  dirtyFields: Partial<Record<keyof FormValues, boolean>>,
  isEditMode: boolean,
): FormData => {
  const formData = new FormData();

  // 1. Image: File mới, xóa ảnh (null), hoặc bỏ qua (URL string giữ nguyên)
  if (values.image instanceof File) {
    formData.append("image", values.image);
  } else if (isEditMode && dirtyFields.image && values.image === null) {
    formData.append("image", ""); // Signal xóa ảnh
  }

  // 2. Các field còn lại
  (Object.keys(values) as Array<keyof FormValues>).forEach((key) => {
    if (key === "image") return;
    if (!isEditMode || dirtyFields[key]) {
      const val = values[key];
      // Omit undefined (not provided). Still send null/"" to signal explicit clear.
      if (val === undefined) return;
      const serialized = serializeValue(val);
      // Send empty string for null to signal deletion (backend accepts "" or null)
      formData.append(key, serialized ?? "");
    }
  });

  return formData;
};
