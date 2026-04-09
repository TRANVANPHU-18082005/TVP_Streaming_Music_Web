import { useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Genre } from "../types";
import {
  genreCreateSchema,
  genreEditSchema,
  type GenreCreateFormValues,
  type GenreEditFormValues,
} from "../schemas/genre.schema";
import { mapEntityToForm } from "../utils/formMapper";
import { buildGenrePayload } from "../utils/payloadBuilder";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES — Sử dụng Overload để đảm bảo Type-safe theo Mode
// ─────────────────────────────────────────────────────────────────────────────

interface UseGenreFormCreateProps {
  mode: "create";
  genreToEdit?: never;
  onSubmit: (formData: FormData) => Promise<void>;
}

interface UseGenreFormEditProps {
  mode: "edit";
  genreToEdit: Genre;
  onSubmit: (formData: FormData) => Promise<void>;
}

type UseGenreFormProps = UseGenreFormCreateProps | UseGenreFormEditProps;

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export const useGenreForm = ({
  mode,
  genreToEdit,
  onSubmit,
}: UseGenreFormProps) => {
  const isEditMode = mode === "edit";

  // 1. Chọn Schema dựa trên Mode (Create bắt buộc File/Edit cho phép URL string)
  const schema = isEditMode ? genreEditSchema : genreCreateSchema;

  // 2. Memoize default values - Dùng _id để tránh reset form không cần thiết
  const defaultValues = useMemo(
    () => mapEntityToForm(isEditMode ? genreToEdit : undefined),
    [genreToEdit?._id, isEditMode],
  );

  // 3. Khởi tạo Form
  const form = useForm<GenreCreateFormValues | GenreEditFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  // 4. Đồng bộ dữ liệu khi data đầu vào thay đổi (Reset form)
  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  // 5. Submit Handler tối ưu hóa
  const handleSubmit = form.handleSubmit(async (values) => {
    const { dirtyFields } = form.formState;

    // --- OPTIMIZATION: DIRTY CHECKING ---
    if (isEditMode) {
      const hasFile = values.image instanceof File;
      const hasChanges = Object.keys(dirtyFields).length > 0;

      // Nếu đang sửa mà không đổi text/color và không up ảnh mới -> Bỏ qua API
      if (!hasChanges && !hasFile) {
        console.warn("[GenreForm] No changes detected, skipping...");
        return;
      }
    }

    // Build Payload (FormData)
    // buildGenrePayload sẽ tự động xử lý chuyển parentId thành null nếu rỗng
    const payload = buildGenrePayload(values, dirtyFields, isEditMode);

    console.log("🚀 Submitting Genre Payload:", {
      mode,
      values,
      dirtyFields,
    });

    await onSubmit(payload);
  });

  return {
    form,
    handleSubmit,
    isSubmitting: form.formState.isSubmitting,
    isDirty: form.formState.isDirty,
    isEditMode,
  };
};
