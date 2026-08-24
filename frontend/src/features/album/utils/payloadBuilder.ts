import { AlbumFormValues } from "../schemas/album.schema";

export const buildAlbumPayload = (
  values: AlbumFormValues,
  dirtyFields: Partial<Record<keyof AlbumFormValues, boolean | any>>,
  isEditMode: boolean,
): FormData => {
  const formData = new FormData();

  const append = (key: string, value: any) => {
    if (value === undefined || value === null) return;
    formData.append(key, value);
  };

  if (values.coverImage instanceof File) {
    formData.append("coverImage", values.coverImage);
  }

  (Object.keys(values) as Array<keyof AlbumFormValues>).forEach((key) => {
    if (key === "coverImage") return;

    const shouldSend = !isEditMode || dirtyFields[key];

    if (shouldSend) {
      const value = values[key];

      if (Array.isArray(value)) {
        append(key, JSON.stringify(value));
      } else if (value !== undefined && value !== null) {
        append(key, String(value));
      }
    }
  });

  return formData;
};
