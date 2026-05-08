import { PlaylistEditFormValues } from "../schemas/playlist.schema";

export const buildPlaylistPayload = (
  values: PlaylistEditFormValues,
  dirtyFields: Partial<Record<keyof PlaylistEditFormValues, boolean | any>>,
  isEditMode: boolean,
): FormData => {
  const formData = new FormData();
  // Hàm chuyển đổi an toàn, xử lý cả String và Date object
  const convertToISO = (value: any): string | undefined => {
    if (!value) return undefined;

    const date = new Date(value);
    // Kiểm tra xem date có hợp lệ không (tránh Invalid Date)
    return isNaN(date.getTime()) ? undefined : date.toISOString();
  };

  const append = (key: string, value: any) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  };

  // 1. Logic Ảnh: Luôn gửi nếu là File mới
  if (values.coverImage instanceof File) {
    formData.append("coverImage", values.coverImage);
  }

  // 2. Logic Fields khác: Chỉ gửi nếu Create mới HOẶC Field đó bị thay đổi (Dirty)
  (Object.keys(values) as Array<keyof PlaylistEditFormValues>).forEach(
    (key) => {
      if (key === "coverImage") return;

      if (!isEditMode || dirtyFields[key]) {
        const value = values[key];
        if (Array.isArray(value)) {
          append(key, JSON.stringify(value)); // Mảng -> JSON String
        } else {
          if (key === "publishAt") {
            const iso = convertToISO(value);
            if (iso) append(key, iso);
          } else {
            append(key, String(value)); // Primitive -> String
          }
        }
      }
    },
  );

  return formData;
};
