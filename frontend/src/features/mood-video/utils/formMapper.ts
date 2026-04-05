import type { MoodVideo } from "../types";
import { type MoodVideoFormValues } from "../schemas/moodVideo.schema";

export const MOOD_VIDEO_DEFAULT_VALUES: MoodVideoFormValues = {
  title: "",
  tags: [],
  isActive: true,
  video: null,
};

export const mapMoodVideoToForm = (
  video?: MoodVideo | null,
): MoodVideoFormValues => {
  if (!video) return MOOD_VIDEO_DEFAULT_VALUES;

  return {
    title: video.title,
    tags: Array.isArray(video.tags) ? video.tags : [],
    isActive: video.isActive,
    video: video.videoUrl, // Lưu URL cũ để hiển thị preview nếu cần
  };
};
