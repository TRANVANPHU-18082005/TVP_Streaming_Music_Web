import { useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  moodVideoSchema,
  type MoodVideoFormValues,
} from "../schemas/moodVideo.schema";
import type { MoodVideo } from "../types";
import { mapMoodVideoToForm } from "../utils/formMapper";
import { buildMoodVideoPayload } from "../utils/payloadBuilder";

interface UseMoodVideoFormProps {
  videoToEdit?: MoodVideo | null;
  onSubmit: (formData: FormData) => Promise<void>;
}

export const useMoodVideoForm = ({
  videoToEdit,
  onSubmit,
}: UseMoodVideoFormProps) => {
  const defaultValues = useMemo(() => {
    return mapMoodVideoToForm(videoToEdit);
  }, [videoToEdit]);

  const form = useForm<MoodVideoFormValues>({
    resolver: zodResolver(moodVideoSchema),
    defaultValues,
    mode: "onSubmit",
  });

  // Reset form khi dữ liệu chỉnh sửa thay đổi
  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const { dirtyFields } = form.formState;
    const isEditMode = !!videoToEdit;

    const hasNewVideo = values.video instanceof File;
    const hasChanges = Object.keys(dirtyFields).length > 0;

    // Tối ưu: Nếu sửa mà không đổi gì thì không gọi API
    if (isEditMode && !hasChanges && !hasNewVideo) {
      return;
    }
    console.log(values);
    const payload = buildMoodVideoPayload(values, dirtyFields, isEditMode);
    console.log("Check File before submit:", values.video instanceof File);
    console.log("FormData Video Check:", payload.get("video"));
    await onSubmit(payload);
  });

  return {
    form,
    handleSubmit,
    isSubmitting: form.formState.isSubmitting,
    isDirty: form.formState.isDirty,
    errors: form.formState.errors,
  };
};
