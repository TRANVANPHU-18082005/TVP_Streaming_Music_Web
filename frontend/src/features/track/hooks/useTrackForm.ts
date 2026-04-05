import { useMemo, useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { trackSchema, type TrackFormValues } from "../schemas/track.schema";
import { mapTrackToForm } from "../utils/formMapper";
import { buildTrackPayload } from "../utils/payloadBuilder";
import { ITrack } from "@/features/track/types";

interface UseTrackFormProps {
  trackToEdit?: ITrack | null;
  onSubmit: (formData: FormData) => Promise<void>;
}

export const useTrackForm = ({ trackToEdit, onSubmit }: UseTrackFormProps) => {
  const defaultValues = useMemo(
    () => mapTrackToForm(trackToEdit),
    [trackToEdit],
  );

  const form = useForm<TrackFormValues>({
    resolver: zodResolver(trackSchema),
    defaultValues,
    mode: "onSubmit",
  });

  const { reset, watch, setValue, formState, getValues } = form;
  const { dirtyFields, isSubmitting } = formState;

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  // --- PREVIEWS ---
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);

  const coverValue = watch("coverImage");
  const audioValue = watch("audio");
  const lyricType = watch("lyricType");

  useEffect(() => {
    if (coverValue instanceof File) {
      const url = URL.createObjectURL(coverValue);
      setImagePreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setImagePreview(typeof coverValue === "string" ? coverValue : null);
  }, [coverValue]);

  useEffect(() => {
    if (audioValue instanceof File) {
      setAudioName(audioValue.name);
    } else {
      setAudioName(
        typeof audioValue === "string" ? "Current Audio File" : null,
      );
    }
  }, [audioValue]);

  // --- SMART LOGIC ---

  // Nếu LyricType là "none", tự động xóa Plain Lyrics
  useEffect(() => {
    if (lyricType === "none") {
      setValue("plainLyrics", "", { shouldDirty: true });
    }
  }, [lyricType, setValue]);

  const handleAudioChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Auto-fill tên bài hát nếu đang trống
      if (!getValues("title")) {
        const fileName = file.name.replace(/\.[^/.]+$/, "");
        setValue("title", fileName, {
          shouldValidate: true,
          shouldDirty: true,
        });
      }

      setValue("audio", file, { shouldValidate: true, shouldDirty: true });
    },
    [getValues, setValue],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    const isEditMode = !!trackToEdit;
    const hasNewAudio = values.audio instanceof File;
    const hasNewImage = values.coverImage instanceof File;
    const isDirty = Object.keys(dirtyFields).length > 0;

    if (isEditMode && !isDirty && !hasNewAudio && !hasNewImage) {
      toast.info("No changes detected.");
      return;
    }

    // Tự động chuyển type sang "plain" nếu có text mà chưa chọn type
    if (values.plainLyrics?.trim() && values.lyricType === "none") {
      setValue("lyricType", "plain");
    }
    console.log("Form Values on Submit:", values);
    try {
      const payload = buildTrackPayload(values, dirtyFields, isEditMode);
      await onSubmit(payload);
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("Failed to save track. Please check the form.");
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
  };
};
