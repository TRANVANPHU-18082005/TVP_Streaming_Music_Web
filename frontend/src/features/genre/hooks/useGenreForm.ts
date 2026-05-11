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
import { handleError } from "@/utils/handleError";

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
    form.reset(defaultValues as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const { dirtyFields } = form.formState;

    if (env.NODE_ENV === "development") {
      console.debug("[GenreForm] submit values:", values);
      console.debug("[GenreForm] dirtyFields:", dirtyFields);
    }

    if (isEditMode) {
      // dirtyFields.image = true khi xóa ảnh (image = null) hoặc đổi file
      const dirtyCount = Object.keys(dirtyFields).length;
      let hasChanges = dirtyCount > 0;

      // FALLBACK: nếu RHF không đánh dấu dirty nhưng giá trị thực sự khác default,
      // so sánh values vs defaultValues để phát hiện thay đổi (bảo toàn tính năng).
      if (!hasChanges) {
        const orig = defaultValues as any;
        const cur = values as any;

        const serialize = (v: any) => {
          if (v === null || v === undefined) return null;
          if (v instanceof File) return "__FILE__";
          if (typeof v === "boolean") return v ? "true" : "false";
          return String(v);
        };

        const normalizeParent = (v: any) => {
          if (v === null || v === undefined) return "root";
          const s = String(v).trim();
          return s === "" || s === "null" || s === "undefined" || s === "root"
            ? "root"
            : s;
        };

        for (const key of Object.keys(cur)) {
          if (key === "image") {
            if (cur.image instanceof File) {
              hasChanges = true;
              break;
            }
            if ((dirtyFields as any).image && cur.image === null) {
              hasChanges = true;
              break;
            }
            continue;
          }

          if (key === "parentId") {
            if (
              normalizeParent(cur.parentId) !== normalizeParent(orig.parentId)
            ) {
              hasChanges = true;
              break;
            }
            continue;
          }

          if (serialize(cur[key]) !== serialize(orig[key])) {
            hasChanges = true;
            break;
          }
        }

        if (env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.debug(
            "[GenreForm] fallback compare -> hasChanges:",
            hasChanges,
            { cur: values, orig: defaultValues },
          );
        }
      }

      if (!hasChanges) {
        // Thông báo rõ ràng cho user thay vì im lặng (tránh nhầm là lỗi)
        console.warn("[GenreForm] No changes detected, skipping...");
        try {
          toast.info("Không có thay đổi để lưu.");
        } catch (e) {
          /* ignore toast errors */
          handleError(e, "Toast error"); // Log nếu toast bị lỗi (như khi gọi trong test environment) nhưng không block flow chính
        }
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
      console.log("🚀 Final Genre Payload (FormData):", payload);
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
