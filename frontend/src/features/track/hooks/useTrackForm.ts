import { useMemo, useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  trackCreateSchema,
  trackEditSchema,
  type TrackCreateFormValues,
  type TrackEditFormValues,
} from "../schemas/track.schema";
import { mapTrackToForm } from "../utils/formMapper";
import { buildTrackPayload } from "../utils/payloadBuilder";
import { ITrack } from "@/features/track/types";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Overload types — TS biết chính xác return type theo mode */
interface UseTrackFormCreateProps {
  mode: "create";
  trackToEdit?: never;
  onSubmit: (formData: FormData) => Promise<void>;
}

interface UseTrackFormEditProps {
  mode: "edit";
  trackToEdit: ITrack;
  onSubmit: (formData: FormData) => Promise<void>;
}

type UseTrackFormProps = UseTrackFormCreateProps | UseTrackFormEditProps;

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export const useTrackForm = ({
  mode,
  trackToEdit,
  onSubmit,
}: UseTrackFormProps) => {
  const isEditMode = mode === "edit";

  // Schema khác nhau theo mode:
  // - create: audio/coverImage chỉ nhận File | undefined
  // - edit:   audio/coverImage nhận string URL | File | null | undefined
  const schema = isEditMode ? trackEditSchema : trackCreateSchema;

  const defaultValues = useMemo(
    () => mapTrackToForm(isEditMode ? trackToEdit : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trackToEdit?._id, isEditMode], // dùng _id thay vì object reference — tránh reset vô tội vạ
  );

  // ── Init form ──────────────────────────────────────────────────────────────
  const form = useForm<TrackCreateFormValues | TrackEditFormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: defaultValues as any, // Cast 1 lần ở đây, không ảnh hưởng DX bên ngoài
    mode: "onSubmit", // validate khi submit
    reValidateMode: "onChange", // sau lần submit đầu, re-validate realtime
  });

  // ── Reset khi mở modal Edit với track khác ────────────────────────────────
  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  // ── PREVIEWS LOGIC (Ảnh & Tên File) ────────────────────────────────────────
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);

  const coverValue = form.watch("coverImage" as any);
  const audioValue = form.watch("audio" as any);
  const lyricType = form.watch("lyricType" as any);

  // Xử lý Preview ảnh bìa
  useEffect(() => {
    if (coverValue instanceof File) {
      const url = URL.createObjectURL(coverValue);
      setImagePreview(url);
      return () => URL.revokeObjectURL(url);
    }
    // Nếu là string (URL từ server) thì dùng luôn, không thì null
    setImagePreview(typeof coverValue === "string" ? coverValue : null);
  }, [coverValue]);

  // Xử lý hiển thị tên file nhạc
  useEffect(() => {
    if (audioValue instanceof File) {
      setAudioName(audioValue.name);
    } else if (typeof audioValue === "string") {
      setAudioName("Existing audio (Keep current)");
    } else {
      setAudioName(null);
    }
  }, [audioValue]);

  // ── SMART UX LOGIC ─────────────────────────────────────────────────────────

  // Sync Lời bài hát: Nếu chọn "none" thì clear text, ngược lại nếu có text mà đang "none" thì auto "plain"
  useEffect(() => {
    if (lyricType === "none") {
      const currentLyrics = form.getValues("plainLyrics" as any);
      if (currentLyrics) {
        form.setValue("plainLyrics" as any, "", { shouldDirty: true });
      }
    }
  }, [lyricType, form]);

  // Handler khi chọn File nhạc
  const handleAudioChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Auto-fill Title từ tên file nếu Title đang trống
      if (!form.getValues("title" as any)) {
        const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        form.setValue("title" as any, fileNameWithoutExt, {
          shouldValidate: true,
          shouldDirty: true,
        });
      }

      form.setValue("audio" as any, file, {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [form],
  );

  // ── Submit handler ─────────────────────────────────────────────────────────
  const handleSubmit = form.handleSubmit(async (values) => {
    const { dirtyFields } = form.formState;

    // Tối ưu băng thông: Edit mode + không có thay đổi → skip
    if (isEditMode) {
      const hasNewAudio = values.audio instanceof File;
      const hasNewImage = (values as any).coverImage instanceof File;
      const hasDirtyFields = Object.keys(dirtyFields).length > 0;

      if (!hasDirtyFields && !hasNewAudio && !hasNewImage) {
        // Không throw, không toast — gọi callback để component tự xử lý (đóng modal,...)
        console.warn("[TrackForm] No changes detected, skipping API call.");
        return;
      }
    }

    // Build payload — chỉ gửi dirtyFields khi Edit, gửi tất cả khi Create
    const payload = buildTrackPayload(values as any, dirtyFields, isEditMode);

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
              form.setError(item.field as any, {
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
        const message = resp?.message || err?.message || "Lỗi lưu bài hát";
        toast.error(message);
      }

      // Keep modal open for user to fix errors — swallow the error here.
      return;
    }
  });

  return {
    form,
    handleSubmit,
    handleAudioChange,
    imagePreview,
    audioName,
    isSubmitting: form.formState.isSubmitting,
    isDirty: form.formState.isDirty,
    isEditMode,
  };
};
