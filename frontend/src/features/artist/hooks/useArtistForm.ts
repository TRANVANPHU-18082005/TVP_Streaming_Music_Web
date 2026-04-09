import { useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Artist } from "../types";
import {
  artistCreateSchema,
  artistEditSchema,
  type ArtistCreateFormValues,
  type ArtistEditFormValues,
} from "../schemas/artist.schema";
import { mapEntityToForm } from "../utils/formMapper";
import { buildArtistPayload } from "../utils/payloadBuilder";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface UseArtistFormCreateProps {
  mode: "create";
  artistToEdit?: never;
  onSubmit: (formData: FormData) => Promise<void>;
}

interface UseArtistFormEditProps {
  mode: "edit";
  artistToEdit: Artist;
  onSubmit: (formData: FormData) => Promise<void>;
}

type UseArtistFormProps = UseArtistFormCreateProps | UseArtistFormEditProps;

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export const useArtistForm = ({
  mode,
  artistToEdit,
  onSubmit,
}: UseArtistFormProps) => {
  const isEditMode = mode === "edit";
  const schema = isEditMode ? artistEditSchema : artistCreateSchema;

  const defaultValues = useMemo(
    () => mapEntityToForm(isEditMode ? artistToEdit : undefined),
    [artistToEdit?._id, isEditMode],
  );

  const form = useForm<ArtistCreateFormValues | ArtistEditFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const { dirtyFields } = form.formState;

    // --- OPTIMIZATION: DIRTY CHECKING ---
    if (isEditMode) {
      // Kiểm tra có file mới ở Avatar, Cover hoặc bất kỳ ảnh nào trong Gallery
      const hasNewFiles =
        values.avatar instanceof File ||
        values.coverImage instanceof File ||
        values.images.some((img) => img instanceof File);

      const hasChanges = Object.keys(dirtyFields).length > 0;

      // Nếu không có thay đổi field text và không có file mới -> Skip
      if (!hasChanges && !hasNewFiles) {
        console.warn("[ArtistForm] No changes detected.");
        return;
      }
    }

    // Build Payload - Payload builder sẽ xử lý việc lọc dirtyFields cho Phú
    const payload = buildArtistPayload(values, dirtyFields, isEditMode);

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
