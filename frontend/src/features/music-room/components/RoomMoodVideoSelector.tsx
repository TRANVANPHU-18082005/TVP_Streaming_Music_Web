import React, { useEffect, useState } from "react";
import { Check, Loader2, Video, X } from "lucide-react";
import { getMoodVideos } from "../api/room.api";
import { cn } from "@/lib/utils";
import { RoomMoodVideoMini } from "../types/room.types";

interface Props {
  currentMoodVideoId: string | null;
  onChangeMoodVideo: (videoId: string | null) => void;
  accentColor: string;
}

const RoomMoodVideoSelector = ({ currentMoodVideoId, onChangeMoodVideo, accentColor }: Props) => {
  const [videos, setVideos] = useState<RoomMoodVideoMini[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const data = await getMoodVideos(1, 50); // Fetch a reasonable amount
        setVideos(data.docs);
      } catch (err) {
        console.error("Failed to fetch mood videos", err);
      } finally {
        setLoading(false);
      }
    };
    fetchVideos();
  }, []);

  return (
    <div className="mt-6">
      <div className="mb-4">
        <h3 className="text-base font-bold flex items-center gap-2">
          <Video className="size-4" /> Nền Video (Mood Video)
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Chọn video để phát làm hình nền (Background) cho người nghe (Listeners).
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 pb-2">
          {/* Tùy chọn không dùng video (sử dụng theme mặc định) */}
          <button
            onClick={() => onChangeMoodVideo(null)}
            className={cn(
              "group relative flex flex-col items-center justify-center p-4 h-[120px] rounded-2xl border transition-all duration-300",
              !currentMoodVideoId
                ? "border-transparent scale-[1.02] shadow-brand"
                : "border-border/60 dark:border-border/30 hover:border-border/60 hover:scale-[1.01] bg-card/40"
            )}
            style={!currentMoodVideoId ? {
              backgroundColor: `${accentColor}18`,
              boxShadow: `0 0 0 1.5px ${accentColor}66, 0 8px 24px ${accentColor}22`
            } : {}}
          >
            {!currentMoodVideoId && (
              <div className="absolute top-2 right-2 size-4 rounded-full flex items-center justify-center" style={{ backgroundColor: accentColor }}>
                <Check className="size-2.5 text-white" />
              </div>
            )}
            <X className="size-8 text-muted-foreground mb-2" />
            <h4 className="font-bold text-sm" style={{ color: !currentMoodVideoId ? accentColor : undefined }}>
              Tắt Video
            </h4>
          </button>

          {/* Danh sách video */}
          {videos.map((video) => {
            const isActive = currentMoodVideoId === video._id;
            return (
              <button
                key={video._id}
                onClick={() => onChangeMoodVideo(video._id)}
                className={cn(
                  "group relative rounded-2xl overflow-hidden border transition-all duration-300 h-[120px]",
                  isActive
                    ? "border-transparent scale-[1.02] shadow-brand"
                    : "border-border/60 dark:border-border/30 hover:border-border/60 hover:scale-[1.01]"
                )}
                style={isActive ? {
                  boxShadow: `0 0 0 1.5px ${accentColor}66, 0 8px 24px ${accentColor}22`
                } : {}}
              >
                {/* Thumbnail */}
                <div className="absolute inset-0 bg-muted">
                  {video.thumbnailUrl ? (
                    <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <video src={video.videoUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" muted loop playsInline />
                  )}
                  {/* Gradient Overlay for text readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                </div>
                
                {/* Content */}
                <div className="absolute inset-0 p-3 flex flex-col justify-end text-left z-10">
                  {isActive && (
                    <div className="absolute top-2 right-2 size-4 rounded-full flex items-center justify-center" style={{ backgroundColor: accentColor }}>
                      <Check className="size-2.5 text-white" />
                    </div>
                  )}
                  <h4 className="font-bold text-sm text-white line-clamp-2 leading-tight drop-shadow-md">
                    {video.title}
                  </h4>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RoomMoodVideoSelector;
