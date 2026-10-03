import { useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  playlistCreateSchema,
  playlistEditSchema,
  type PlaylistCreateFormValues,
  type PlaylistEditFormValues,
} from "../schemas/playlist.schema";
import { mapEntityToForm } from "../utils/formMapper";
import { buildPlaylistPayload } from "../utils/payloadBuilder";
import { toast } from "sonner";
import { IPlaylist } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES — Sử dụng Overload để ép kiểu chặt chẽ theo Mode
// ─────────────────────────────────────────────────────────────────────────────

interface UsePlaylistFormCreateProps {
  mode: "create";
  playlistToEdit?: never; // Cấm truyền playlist khi ở mode create
  onSubmit: (formData: FormData) => Promise<void>;
}

interface UsePlaylistFormEditProps {
  mode: "edit";
  playlistToEdit: IPlaylist; // Bắt buộc phải có playlist khi ở mode edit
  onSubmit: (formData: FormData) => Promise<void>;
}

type UsePlaylistFormProps =
  | UsePlaylistFormCreateProps
  | UsePlaylistFormEditProps;

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export const usePlaylistForm = ({
  mode,
  playlistToEdit,
  onSubmit,
}: UsePlaylistFormProps) => {
  const isEditMode = mode === "edit";

  // 1. Chọn Schema tương ứng (Create bắt buộc File, Edit chấp nhận URL string)
  const schema = isEditMode ? playlistEditSchema : playlistCreateSchema;

  // 2. Memoize default values - Dùng _id để tránh reset vòng lặp
  const defaultValues = useMemo(
    () => mapEntityToForm(isEditMode ? playlistToEdit : undefined),
    [isEditMode, playlistToEdit, playlistToEdit?._id],
  );

  // 3. Init Form
  const form = useForm<PlaylistCreateFormValues | PlaylistEditFormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange", // Re-validate ngay khi user sửa lỗi
  });

  // 4. Reset form khi chuyển đổi giữa các Playlist hoặc đóng/mở Modal
  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  // 5. Submit Handler tối ưu
  const handleSubmit = form.handleSubmit(async (values) => {
    const { dirtyFields } = form.formState;

    // --- OPTIMIZATION: DIRTY CHECKING ---
    if (isEditMode) {
      const hasFile = values.coverImage instanceof File;
      const hasDirtyFields = Object.keys(dirtyFields).length > 0;

      // Nếu không có thay đổi gì về text và cũng không upload ảnh mới -> Thoát sớm
      if (!hasDirtyFields && !hasFile) {
        console.warn("[PlaylistForm] No changes detected.");
        return;
      }
    }

    // Build Payload (FormData) - buildPlaylistPayload sẽ chỉ lấy các field bị "dirty" khi Edit
    const payload = buildPlaylistPayload(values, dirtyFields, isEditMode);

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
        const message = resp?.message || err?.message || "Lỗi lưu playlist";
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
