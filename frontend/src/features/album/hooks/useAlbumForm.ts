// features/album/hooks/useAlbumForm.ts
import { useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  albumCreateSchema,
  albumEditSchema,
  type AlbumCreateFormValues,
  type AlbumEditFormValues,
} from "../schemas/album.schema";
import type { Album } from "@/features/album/types";
import { mapEntityToForm } from "../utils/formMapper";
import { buildAlbumPayload } from "../utils/payloadBuilder";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Overload types — TS biết chính xác return type theo mode */
interface UseAlbumFormCreateProps {
  mode: "create";
  albumToEdit?: never;
  onSubmit: (formData: FormData) => Promise<void>;
}

interface UseAlbumFormEditProps {
  mode: "edit";
  albumToEdit: Album;
  onSubmit: (formData: FormData) => Promise<void>;
}

type UseAlbumFormProps = UseAlbumFormCreateProps | UseAlbumFormEditProps;

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────
export const useAlbumForm = ({
  mode,
  albumToEdit,
  onSubmit,
}: UseAlbumFormProps) => {
  const isEditMode = mode === "edit";

  // Schema khác nhau theo mode:
  // - create: coverImage chỉ nhận File | undefined
  // - edit:   coverImage nhận string URL | File | null | undefined
  const schema = isEditMode ? albumEditSchema : albumCreateSchema;

  const defaultValues = useMemo(
    () => mapEntityToForm(isEditMode ? albumToEdit : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [albumToEdit?._id, isEditMode], // dùng _id thay vì object reference — tránh reset vô tội vạ
  );

  // ── Init form ──────────────────────────────────────────────────────────────
  const form = useForm<AlbumCreateFormValues | AlbumEditFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onSubmit", // validate khi submit
    reValidateMode: "onChange", // sau lần submit đầu, re-validate realtime
  });

  // ── Reset khi mở modal Edit với album khác ─────────────────────────────────
  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  // ── Submit handler ─────────────────────────────────────────────────────────
  const handleSubmit = form.handleSubmit(async (values) => {
    const { dirtyFields } = form.formState;

    // Tối ưu băng thông: Edit mode + không có thay đổi → skip
    if (isEditMode) {
      const hasFile = values.coverImage instanceof File;
      const hasDirtyFields = Object.keys(dirtyFields).length > 0;

      if (!hasDirtyFields && !hasFile) {
        // Không throw, không toast — gọi callback để component tự xử lý (đóng modal,...)
        console.warn("[AlbumForm] No changes detected, skipping API call.");
        return;
      }
    }

    // Build payload — chỉ gửi dirtyFields khi Edit, gửi tất cả khi Create
    const payload = buildAlbumPayload(values, dirtyFields, isEditMode);
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
