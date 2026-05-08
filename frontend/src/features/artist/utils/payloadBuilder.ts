import { ArtistEditFormValues } from "../schemas/artist.schema";

export const buildArtistPayload = (
  values: ArtistEditFormValues,
  dirtyFields: Partial<Record<keyof ArtistEditFormValues, boolean | any>>,
  isEditMode: boolean,
): FormData => {
  const formData = new FormData();

  const append = (key: string, value: any) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  };

  // ── 1. FILE UPLOADS (Avatar, Cover) — only if new File ──────────────────
  if (values.avatar instanceof File) formData.append("avatar", values.avatar);
  if (values.coverImage instanceof File)
    formData.append("coverImage", values.coverImage);

  // ── 2. GALLERY IMAGES (split new Files vs kept URLs) ───────────────────
  // Only process if changed or creating new
  if (!isEditMode || dirtyFields.images) {
    const newFiles: File[] = [];
    const keptUrls: string[] = [];

    values.images?.forEach((item) => {
      if (item instanceof File) newFiles.push(item);
      else if (typeof item === "string") keptUrls.push(item);
    });

    // Send new files (backend handles array)
    newFiles.forEach((file) => formData.append("images", file));

    // Send kept URLs (backend preserves them)
    if (keptUrls.length > 0) {
      formData.append("keptImages", JSON.stringify(keptUrls));
    }
  }

  // ── 3. OTHER FIELDS (Dirty Checking) ──────────────────────────────────
  const fieldsToSkip = new Set(["avatar", "coverImage", "images"]);

  (Object.keys(values) as Array<keyof ArtistEditFormValues>).forEach((key) => {
    // Skip file fields already handled above
    if (fieldsToSkip.has(key)) return;

    // For edit mode: only include dirty fields
    if (isEditMode && !dirtyFields[key]) return;

    const value = values[key];

    // Append based on type
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      append(key, JSON.stringify(value));
    } else if (Array.isArray(value)) {
      append(key, JSON.stringify(value));
    } else if (value !== undefined && value !== null) {
      append(key, String(value));
    }
  });

  return formData;
};
