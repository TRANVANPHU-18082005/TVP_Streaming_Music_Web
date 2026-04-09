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
  const schema = isEditMode ? trackEditSchema : trackCreateSchema;

  // 1. Khởi tạo giá trị mặc định
  const defaultValues = useMemo(
    () => mapTrackToForm(isEditMode ? trackToEdit : undefined),
    [trackToEdit?._id, isEditMode],
  );

  const form = useForm<TrackCreateFormValues | TrackEditFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const {
    reset,
    watch,
    setValue,
    formState,
    getValues,
    handleSubmit: internalHandleSubmit,
  } = form;
  const { dirtyFields, isSubmitting } = formState;

  // 2. Reset form khi chuyển đổi track hoặc mode
  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  // ── 3. PREVIEWS LOGIC (Ảnh & Tên File) ──────────────────────────────────────
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);

  const coverValue = watch("coverImage");
  const audioValue = watch("audio");
  const lyricType = watch("lyricType");

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

  // ── 4. SMART UX LOGIC ───────────────────────────────────────────────────────

  // Sync Lời bài hát: Nếu chọn "none" thì clear text, ngược lại nếu có text mà đang "none" thì auto "plain"
  useEffect(() => {
    if (lyricType === "none") {
      const currentLyrics = getValues("plainLyrics");
      if (currentLyrics) setValue("plainLyrics", "", { shouldDirty: true });
    }
  }, [lyricType, setValue, getValues]);

  // Handler khi chọn File nhạc
  const handleAudioChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Auto-fill Title từ tên file nếu Title đang trống
      if (!getValues("title")) {
        const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setValue("title", fileNameWithoutExt, {
          shouldValidate: true,
          shouldDirty: true,
        });
      }

      setValue("audio", file, { shouldValidate: true, shouldDirty: true });
    },
    [getValues, setValue],
  );

  // ── 5. SUBMIT HANDLER ───────────────────────────────────────────────────────
  const handleSubmit = internalHandleSubmit(async (values) => {
    // Dirty Checking nâng cao
    const hasNewAudio = values.audio instanceof File;
    const hasNewImage = values.coverImage instanceof File;
    const hasChanges = Object.keys(dirtyFields).length > 0;

    if (isEditMode && !hasChanges && !hasNewAudio && !hasNewImage) {
      toast.info("Không có thay đổi nào được ghi nhận.");
      return;
    }

    // Logic "Chữa lành" Lời nhạc trước khi gửi
    if (values.plainLyrics?.trim() && values.lyricType === "none") {
      values.lyricType = "plain";
    }

    try {
      const payload = buildTrackPayload(values, dirtyFields, isEditMode);
      await onSubmit(payload);
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("Không thể lưu bài hát. Vui lòng kiểm tra lại dữ liệu.");
    }
  });

  return {
    form,
    handleSubmit,
    handleAudioChange,
    imagePreview,
    audioName,
    isSubmitting,
    isDirty: formState.isDirty,
    isEditMode,
  };
};
