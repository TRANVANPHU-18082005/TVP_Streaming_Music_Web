import { useMemo, useEffect } from "react";
import { applyServerErrors } from "@/utils/applyServerErrors";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  artistCreateSchema,
  artistEditSchema,
  type ArtistCreateFormValues,
  type ArtistEditFormValues,
} from "../schemas/artist.schema";
import { mapEntityToForm } from "../utils/formMapper";
import { buildArtistPayload } from "../utils/payloadBuilder";
import { toast } from "sonner";
import { IArtist } from "../types";

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
  artistToEdit: IArtist;
  onSubmit: (formData: FormData) => Promise<void>;
}

type UseArtistFormProps = UseArtistFormCreateProps | UseArtistFormEditProps;

type FormValues<TMode extends "create" | "edit"> = TMode extends "edit"
  ? ArtistEditFormValues
  : ArtistCreateFormValues;

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export const useArtistForm = <TMode extends "create" | "edit">({
  mode,
  artistToEdit,
  onSubmit,
}: UseArtistFormProps & { mode: TMode }) => {
  const isEditMode = mode === "edit";
  const schema = isEditMode ? artistEditSchema : artistCreateSchema;

  const defaultValues = useMemo(
    () => mapEntityToForm(isEditMode ? artistToEdit : undefined),
    [artistToEdit?._id, isEditMode],
  );

  const form = useForm<FormValues<TMode>>({
    resolver: zodResolver(schema) as any,
    defaultValues: defaultValues as any, // Cast 1 lần ở đây, không ảnh hưởng DX bên ngoài
    mode: "onSubmit", // validate khi submit
    reValidateMode: "onChange", // sau lần submit đầu, re-validate realtime
  });

  useEffect(() => {
    form.reset(defaultValues as any);
  }, [defaultValues, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const { dirtyFields } = form.formState;

    // --- OPTIMIZATION: DIRTY CHECKING ---
    if (isEditMode) {
      // Kiểm tra có file mới ở Avatar, Cover hoặc bất kỳ ảnh nào trong Gallery
      const hasNewFiles =
        values.avatar instanceof File ||
        values.coverImage instanceof File ||
        values.images?.some((img) => img instanceof File);

      const hasChanges = Object.keys(dirtyFields).length > 0;

      // Nếu không có thay đổi field text và không có file mới -> Skip
      if (!hasChanges && !hasNewFiles) {
        console.warn("[ArtistForm] No changes detected.");
        return;
      }
    }

    // Build Payload - Payload builder sẽ xử lý việc lọc dirtyFields cho Phú
    const payload = buildArtistPayload(
      values as any,
      dirtyFields as any,
      isEditMode,
    );

    try {
      await onSubmit(payload);
    } catch (err) {
      // Mutation đã toast lỗi chung; ở đây gán lỗi theo field để người dùng sửa ngay trên form.
      applyServerErrors(err, form.setError, {
        knownFields: Object.keys(form.getValues()),
      });

      // Giữ modal mở để người dùng sửa lỗi — nuốt lỗi tại đây.
      return;
    }
  });

  return {
    form,
    handleSubmit,
    isSubmitting: form.formState.isSubmitting,
    isDirty: form.formState.isDirty,
    isEditMode,
  };
};
