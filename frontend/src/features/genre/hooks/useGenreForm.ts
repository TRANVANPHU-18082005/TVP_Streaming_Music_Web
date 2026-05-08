import { useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  genreCreateSchema,
  genreEditSchema,
  type GenreCreateFormValues,
  type GenreEditFormValues,
} from "../schemas/genre.schema";
import { mapEntityToForm } from "../utils/formMapper";
import { buildGenrePayload } from "../utils/payloadBuilder";
import { IGenre } from "../types";
import { env } from "@/config/env";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface UseGenreFormCreateProps {
  mode: "create";
  genreToEdit?: never;
  onSubmit: (formData: FormData) => Promise<void>;
}

interface UseGenreFormEditProps {
  mode: "edit";
  genreToEdit: IGenre;
  onSubmit: (formData: FormData) => Promise<void>;
}

type UseGenreFormProps = UseGenreFormCreateProps | UseGenreFormEditProps;

type FormValues<TMode extends "create" | "edit"> = TMode extends "edit"
  ? GenreEditFormValues
  : GenreCreateFormValues;

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────
export const useGenreForm = <TMode extends "create" | "edit">({
  mode,
  genreToEdit,
  onSubmit,
}: UseGenreFormProps & { mode: TMode }) => {
  const isEditMode = mode === "edit";

  // Schema theo mode — không cần memo vì schema là module-level constant
  const schema = isEditMode ? genreEditSchema : genreCreateSchema;

  // QUAN TRỌNG: genreToEdit phải stable ở component cha (memo theo _id)
  const defaultValues = useMemo(
    () => mapEntityToForm(isEditMode ? genreToEdit : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [genreToEdit, isEditMode],
  );

  const form = useForm<FormValues<TMode>>({
    resolver: zodResolver(schema) as any,
    defaultValues: defaultValues as any, // cast chỉ ở đây, không ảnh hưởng DX
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  // Sync khi genreToEdit thay đổi (chuyển sang genre khác để edit)
  // Bỏ `form` khỏi deps — reset là stable, form object thì không
  useEffect(() => {
    form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const { dirtyFields } = form.formState;

    if (isEditMode) {
      // dirtyFields.image = true khi xóa ảnh (image = null) hoặc đổi file
      const hasChanges = Object.keys(dirtyFields).length > 0;
      if (!hasChanges) {
        console.warn("[GenreForm] No changes detected, skipping...");
        return;
      }
    }

    if (env.NODE_ENV === "development") {
      console.log("🚀 Submitting Genre Payload:", {
        mode,
        values,
        dirtyFields,
      });
    }

    const payload = buildGenrePayload(
      values as any,
      dirtyFields as any,
      isEditMode,
    );

    try {
      await onSubmit(payload);
    } catch (err: any) {
      // Map server-side validation errors to form fields where possible.
      const resp = err?.response?.data || err?.response || null;

      let handled = false;

      const maybeFieldMap = resp?.data ?? resp?.errors ?? resp;
      if (maybeFieldMap && typeof maybeFieldMap === "object") {
        if (Array.isArray(maybeFieldMap)) {
          for (const item of maybeFieldMap) {
            if (!item) continue;
            if (typeof item === "string") {
              toast.error(item);
            } else if (item.field && (item.message || item.msg)) {
              form.setError(item.field, {
                type: "server",
                message: item.message || item.msg,
              });
              handled = true;
            }
          }
        } else {
          Object.entries(maybeFieldMap).forEach(([k, v]) => {
            if (!k) return;
            const msg = Array.isArray(v) ? v.join(" ") : String(v || "");
            if (k === "message" || k === "errorCode") return;
            form.setError(k as any, { type: "server", message: msg });
            handled = true;
          });
        }
      }

      if (!handled) {
        const message = resp?.message || err?.message || "Lỗi lưu thể loại";
        toast.error(message);
      }

      // Keep modal open for user to fix errors — swallow the error here.
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
