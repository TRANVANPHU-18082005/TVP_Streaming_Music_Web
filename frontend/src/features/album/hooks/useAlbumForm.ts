// features/album/hooks/useAlbumForm.ts
import { useMemo, useEffect } from "react";
import { applyServerErrors } from "@/utils/applyServerErrors";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  albumCreateSchema,
  albumEditSchema,
  type AlbumCreateFormValues,
  type AlbumEditFormValues,
} from "../schemas/album.schema";
import type { IAlbum } from "@/features/album/types";
import { mapEntityToForm } from "../utils/formMapper";
import { buildAlbumPayload } from "../utils/payloadBuilder";
import { toast } from "sonner";

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
  albumToEdit: IAlbum;
  onSubmit: (formData: FormData) => Promise<void>;
}

type UseAlbumFormProps = UseAlbumFormCreateProps | UseAlbumFormEditProps;

type FormValues<TMode extends "create" | "edit"> = TMode extends "edit"
  ? AlbumEditFormValues
  : AlbumCreateFormValues;

// ────────────
// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────
export const useAlbumForm = <TMode extends "create" | "edit">({
  mode,
  albumToEdit,
  onSubmit,
}: UseAlbumFormProps & { mode: TMode }) => {
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
  const form = useForm<FormValues<TMode>>({
    resolver: zodResolver(schema) as any,
    defaultValues: defaultValues as any, // Cast 1 lần ở đây, không ảnh hưởng DX bên ngoài
    mode: "onSubmit", // validate khi submit
    reValidateMode: "onChange", // sau lần submit đầu, re-validate realtime
  });

  // ── Reset khi mở modal Edit với album khác ─────────────────────────────────
  useEffect(() => {
    form.reset(defaultValues as any);
  }, [defaultValues, form]);

  // ── Submit handler ─────────────────────────────────────────────────────────
  const handleSubmit = form.handleSubmit(async (values) => {
    const { dirtyFields } = form.formState;

    // Tối ưu băng thông: Edit mode + không có thay đổi → skip
    if (isEditMode) {
      const hasFile = values.coverImage instanceof File;
      const hasDirtyFields = Object.keys(dirtyFields).length > 0;

      if (!hasDirtyFields && !hasFile) {
        toast.info("Không có thay đổi nào để lưu");
        return;
      }
    }
    // Build payload — chỉ gửi dirtyFields khi Edit, gửi tất cả khi Create
    const payload = buildAlbumPayload(values, dirtyFields, isEditMode);
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
