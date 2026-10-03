import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Search, Play, Pause, Send, Sparkles, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useDebounce } from "@/hooks/useDebounce";
import { usePublicTracks } from "@/features/track/hooks/useTracksQuery";
import { useCreateShort } from "../hooks/useShorts";
import { useShortAudio } from "../hooks/useShortAudio";
import { VideoMoodEngine } from "@/features/player/components/VideoMoodEngine";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import type { ITrack } from "@/features/track/types";

const clipLength = (duration: number) => Math.min(30, Math.max(10, Math.min(60, duration || 30)));

export const CreateShortPage = () => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const debounced = useDebounce(keyword, 300);
  const [track, setTrack] = useState<ITrack | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [length, setLength] = useState(15);
  const [caption, setCaption] = useState("");
  const [previewOn, setPreviewOn] = useState(false);

  const { data, isFetching } = usePublicTracks({
    keyword: debounced,
    limit: 8,
    page: 1,
    status: "ready",
  });
  const createShort = useCreateShort();

  const duration = track?.duration || 0;
  const maxStart = Math.max(0, duration - 10);
  const endTime = Math.min(duration || startTime + length, startTime + length);
  const src = track?.hlsUrl || track?.trackUrl || "";
  const moodId = track?.moodVideo?._id;
  const moodUrl = track?.moodVideo?.videoUrl;

  const { isPlaying, autoplayBlocked, togglePlay } = useShortAudio(
    src,
    startTime,
    endTime,
    previewOn && Boolean(src),
  );

  const results = (data?.tracks ?? []).filter((item) => item.status === "ready" || !item.status);

  const pickTrack = (item: ITrack) => {
    setTrack(item);
    setPreviewOn(false);
    const nextLength = clipLength(item.duration || 30);
    setLength(nextLength);
    setStartTime(0);
    setKeyword("");
  };

  const submit = () => {
    if (!track) return;
    createShort.mutate(
      {
        track: track._id,
        ...(moodId ? { moodVideo: moodId } : {}),
        startTime,
        endTime,
        caption: caption.trim() || undefined,
        title: track.title,
      },
      {
        onSuccess: () => {
          toast.success("Đã gửi short. Admin sẽ duyệt trước khi lên feed.");
          navigate("/profile?tab=shorts");
        },
        onError: () => toast.error("Không gửi được short"),
      },
    );
  };

  return (
    <div className="section-container max-w-3xl py-8 md:py-12 relative z-10 min-h-screen">
      {/* Background ambient light */}
      <div className="absolute top-0 left-0 w-full h-[500px] overflow-hidden -z-10 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[100%] rounded-full bg-primary/20 dark:bg-primary/10 blur-[120px]" />
      </div>

      <div className="flex flex-col items-center text-center space-y-3 mb-10">
        <div className="inline-flex items-center justify-center p-3 md:p-4 bg-primary/10 text-primary rounded-2xl md:rounded-[2rem] shadow-sm mb-2 border border-primary/20">
          <Scissors className="w-8 h-8 md:w-10 md:h-10" />
        </div>
        <h1 className="text-3xl md:text-5xl font-black font-display tracking-tight text-foreground">
          Tạo Short <Sparkles className="inline-block w-6 h-6 md:w-8 md:h-8 text-yellow-400 -mt-4 animate-pulse" />
        </h1>
        <p className="text-sm md:text-base text-muted-foreground/80 max-w-md font-medium">
          Cắt một đoạn 10–60 giây từ bài hát bạn yêu thích. Bản short sẽ được duyệt bởi Admin trước khi hiển thị trên feed.
        </p>
      </div>

      <div className="relative max-w-xl mx-auto w-full z-20">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm bài hát để cắt..."
            className="pl-11 h-14 rounded-full bg-white/60 dark:bg-black/20 backdrop-blur-xl border-border/50 focus-visible:ring-1 focus-visible:ring-primary shadow-sm text-base"
          />
        </div>
        
        {keyword.trim().length > 0 && (
          <div className="absolute mt-2 w-full rounded-2xl border border-white/20 dark:border-white/5 bg-white/70 dark:bg-card/70 backdrop-blur-2xl shadow-xl max-h-80 overflow-y-auto overflow-hidden">
            {isFetching && (
              <div className="p-4 text-sm font-medium text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" /> Đang tìm kiếm...
              </div>
            )}
            {!isFetching && results.length === 0 && (
              <div className="p-4 text-sm font-medium text-muted-foreground text-center">
                Không tìm thấy bài hát nào.
              </div>
            )}
            <div className="p-2">
              {results.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left rounded-xl hover:bg-white/50 dark:hover:bg-white/10 transition-colors"
                  onClick={() => pickTrack(item)}
                >
                  <ImageWithFallback src={item.coverImage} className="w-12 h-12 rounded-lg object-cover shadow-sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold truncate text-foreground">{item.title}</span>
                    <span className="block text-xs font-medium text-muted-foreground truncate mt-0.5">
                      {item.artist?.name}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {track && (
        <div className="mt-8 space-y-6 rounded-[2rem] border border-white/60 dark:border-white/5 bg-white/60 dark:bg-card/30 backdrop-blur-2xl p-6 md:p-8 shadow-xl max-w-2xl mx-auto relative z-10">
          <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
            <div className="relative w-full sm:w-48 aspect-video sm:aspect-square overflow-hidden rounded-2xl bg-black/5 dark:bg-black/50 shadow-lg ring-1 ring-border/50 shrink-0 group">
              {moodUrl ? (
                <VideoMoodEngine src={moodUrl} isPlaying={isPlaying} blur={0} />
              ) : (
                <ImageWithFallback src={track.coverImage} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              )}
              {/* Playback overlay effect */}
              {isPlaying && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center backdrop-blur-[2px]">
                  <div className="w-12 h-12 rounded-full bg-primary/20 animate-ping absolute" />
                  <Pause className="w-8 h-8 text-white z-10" />
                </div>
              )}
            </div>
            
            <div className="flex-1 text-center sm:text-left min-w-0 w-full">
              <p className="font-bold font-display text-xl md:text-2xl truncate drop-shadow-sm">{track.title}</p>
              <p className="text-sm font-medium text-muted-foreground mt-1">{track.artist?.name}</p>
              
              <div className="mt-5 space-y-5 bg-white/50 dark:bg-black/20 p-4 rounded-2xl border border-white/50 dark:border-white/5 shadow-inner">
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-bold text-muted-foreground">
                    <span>Bắt đầu: <span className="text-foreground">{Math.round(startTime)}s</span></span>
                  </div>
                  <Slider
                    min={0}
                    max={Math.max(0, maxStart)}
                    step={1}
                    value={[Math.min(startTime, maxStart)]}
                    onValueChange={([value]) => {
                      setPreviewOn(false);
                      setStartTime(value ?? 0);
                    }}
                    className="cursor-pointer"
                  />
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-bold text-muted-foreground">
                    <span>Độ dài đoạn cắt: <span className="text-foreground">{Math.round(endTime - startTime)}s</span></span>
                  </div>
                  <Slider
                    min={10}
                    max={Math.min(60, Math.max(10, duration || 60))}
                    step={1}
                    value={[length]}
                    onValueChange={([value]) => {
                      setPreviewOn(false);
                      setLength(value ?? 15);
                    }}
                    className="cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Textarea
              value={caption}
              maxLength={500}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Viết cảm nghĩ hoặc tiêu đề cho Short của bạn..."
              className="resize-none rounded-2xl border-white/50 dark:border-white/5 bg-white/50 dark:bg-black/20 focus-visible:ring-primary shadow-inner min-h-[100px] p-4"
            />
            <div className="text-right text-[10px] font-mono text-muted-foreground">
              {caption.length}/500
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button 
              type="button" 
              variant="secondary" 
              className="gap-2 rounded-full h-12 px-8 font-bold flex-1 sm:flex-none shadow-sm hover:bg-white/60 dark:hover:bg-white/10"
              onClick={() => {
                if (previewOn && isPlaying) {
                  togglePlay();
                  return;
                }
                setPreviewOn(true);
                if (autoplayBlocked) togglePlay();
              }}
            >
              {isPlaying ? <><Pause className="w-4 h-4 fill-current" /> Dừng phát</> : <><Play className="w-4 h-4 fill-current" /> Nghe thử</>}
            </Button>
            
            <Button 
              type="button" 
              onClick={submit} 
              disabled={createShort.isPending || endTime - startTime < 10}
              className="gap-2 rounded-full h-12 px-8 font-bold flex-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:scale-[1.02]"
            >
              {createShort.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang gửi...</> : <><Send className="w-4 h-4" /> Gửi duyệt lên hệ thống</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateShortPage;
