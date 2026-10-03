import React, { useState } from "react";
import { usePublicRecordings } from "../hooks/useKaraokeQueries";
import { useToggleLike, useIncrementPlayCount } from "../hooks/useKaraokeMutations";
import { IKaraokeRecording } from "../types";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { Play, Heart, Headphones, Music2, Loader2, Globe, Clock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import Pagination from "@/utils/pagination";
import { KaraokePlaybackModal } from "./KaraokePlaybackModal";
import { useAppSelector } from "@/store/hooks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const KaraokeCommunityFeed = () => {
  const [page, setPage] = useState(1);
  const [playingRec, setPlayingRec] = useState<IKaraokeRecording | null>(null);

  const { data, isLoading } = usePublicRecordings({
    page,
    limit: 12,
    sort: "newest", // Hoặc có thể tạo select filter
  });

  const { mutate: incrementPlay } = useIncrementPlayCount();

  const handlePlay = (rec: IKaraokeRecording) => {
    setPlayingRec(rec);
    incrementPlay(rec._id);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
        <p>Đang tải danh sách bản thu...</p>
      </div>
    );
  }

  const recordings = data?.data?.data || [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl md:text-2xl font-bold font-display flex items-center gap-2">
            <Globe className="w-5 h-5 md:w-6 md:h-6 text-primary" /> Cộng Đồng Karaoke
          </h2>
          <p className="text-muted-foreground mt-1 text-xs md:text-sm">
            Khám phá và lắng nghe những giọng ca tuyệt vời từ cộng đồng.
          </p>
        </div>
      </div>

      {!recordings.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-white/40 dark:bg-card/20 backdrop-blur-3xl rounded-[2rem] shadow-sm border border-dashed border-border/50">
          <Music2 className="w-16 h-16 mb-4 opacity-30" />
          <p className="font-bold text-lg text-foreground/80">Chưa có bản thu nào được công khai.</p>
          <p className="text-sm mt-1">Hãy là người đầu tiên đóng góp giọng ca của mình nhé!</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {recordings.map((rec: IKaraokeRecording) => (
              <RecordingCard 
                key={rec._id} 
                recording={rec} 
                onPlay={() => handlePlay(rec)}
              />
            ))}
          </div>
          
          {data?.data?.meta && data.data.meta.totalPages > 1 && (
            <div className="mt-10 flex justify-center">
              <Pagination
                currentPage={page}
                totalPages={data.data.meta.totalPages}
                onPageChange={setPage}
                totalItems={data.data.meta.total || data.data.meta.totalItems || 0}
                pageSize={data.data.meta.limit || data.data.meta.pageSize || 10}
              />
            </div>
          )}
        </>
      )}

      {/* Modal Phát Nhạc */}
      {playingRec && (
        <KaraokePlaybackModal 
          recording={playingRec} 
          onClose={() => setPlayingRec(null)} 
        />
      )}
    </div>
  );
};

const formatDuration = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const RecordingCard = ({ 
  recording, 
  onPlay 
}: { 
  recording: IKaraokeRecording; 
  onPlay: () => void 
}) => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const { mutate: toggleLike, isPending: isLiking } = useToggleLike();
  
  const hasLiked = currentUser ? recording.likedBy?.includes(currentUser._id) : false;

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return toast.error("Vui lòng đăng nhập để thích bản thu này");
    toggleLike(recording._id);
  };

  return (
    <div className="flex flex-col rounded-3xl bg-white/40 dark:bg-card/20 backdrop-blur-2xl shadow-sm overflow-hidden group hover:shadow-xl hover:bg-white/60 dark:hover:bg-card/40 transition-all duration-300 relative border border-white/20 dark:border-white/5">
      {/* Thumbnail */}
      <div 
        className="relative aspect-video w-full overflow-hidden bg-black/10 cursor-pointer"
        onClick={onPlay}
      >
        <ImageWithFallback
          src={recording.youtubeThumbnail || `https://img.youtube.com/vi/${recording.youtubeVideoId}/hqdefault.jpg`}
          alt={recording.youtubeTitle}
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
        
        {/* Play Button Overlay */}
        <div className="absolute inset-0 m-auto w-12 h-12 md:w-14 md:h-14 bg-primary/90 text-primary-foreground rounded-full flex items-center justify-center shadow-xl shadow-primary/30 backdrop-blur-sm opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all duration-300 z-10">
          <Play className="w-5 h-5 md:w-6 md:h-6 ml-1" />
        </div>

        {/* Stats Overlay */}
        <div className="absolute bottom-2 right-2 md:right-3 flex items-center gap-2 md:gap-3 text-white text-[10px] md:text-xs font-mono drop-shadow-md z-10">
          <span className="flex items-center gap-1"><Headphones className="w-3 h-3" /> {recording.playCount}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDuration(recording.audioDuration)}</span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 md:p-4 flex flex-col gap-2 md:gap-3 flex-1 relative">
        {/* Like Button (Floating) */}
        <button 
          onClick={handleLike}
          disabled={isLiking}
          className={cn(
            "absolute -top-5 md:-top-6 right-3 md:right-4 p-2.5 md:p-3 rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95",
            hasLiked ? "bg-red-500 text-white" : "bg-card text-muted-foreground border border-border"
          )}
        >
          <Heart className={cn("w-4 h-4 md:w-5 md:h-5", hasLiked && "fill-white")} />
        </button>

        <div className="pr-10">
          <h3 className="font-bold text-base md:text-lg line-clamp-1 group-hover:text-primary transition-colors cursor-pointer" onClick={onPlay} title={recording.title}>
            {recording.title}
          </h3>
          <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-1 mt-0.5 md:mt-1" title={recording.youtubeTitle}>
            Beat: {recording.youtubeTitle}
          </p>
        </div>

        {/* User */}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50">
          <div className="flex items-center gap-2">
            <Avatar className="w-7 h-7 md:w-8 md:h-8 border border-border">
              <AvatarImage src={recording.user?.avatar} />
              <AvatarFallback>{recording.user?.username?.slice(0,2)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-xs md:text-sm font-medium line-clamp-1">{recording.user?.fullName}</span>
              <span className="text-[9px] md:text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(recording.createdAt), { addSuffix: true, locale: vi })}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 text-[10px] md:text-xs text-muted-foreground font-mono bg-muted/30 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md">
            <Heart className="w-2.5 h-2.5 md:w-3 md:h-3" /> {recording.likeCount}
          </div>
        </div>
      </div>
    </div>
  );
};
