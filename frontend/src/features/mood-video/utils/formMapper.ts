import { type MoodVideoFormValues } from "../schemas/moodVideo.schema";
import { IMoodVideo } from "../types";

export const MOOD_VIDEO_DEFAULT_VALUES: MoodVideoFormValues = {
  title: "",
  tags: [],
  isActive: true,
  video: null,
};

export const mapMoodVideoToForm = (
  video?: IMoodVideo | null,
): MoodVideoFormValues => {
  if (!video) return MOOD_VIDEO_DEFAULT_VALUES;

  return {
    title: video.title,
    tags: Array.isArray(video.tags) ? video.tags : [],
    isActive: video.isActive,
    video: video.videoUrl, // Lưu URL cũ để hiển thị preview nếu cần
  };
};
