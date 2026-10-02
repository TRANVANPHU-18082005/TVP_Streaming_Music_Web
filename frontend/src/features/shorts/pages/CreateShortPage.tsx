import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
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
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tạo Short</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Chọn một đoạn 10–60 giây. Short ở trạng thái chờ duyệt cho đến khi admin chấp nhận.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="Tìm bài hát"
          className="pl-9"
        />
        {keyword.trim().length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border bg-popover shadow-lg max-h-72 overflow-y-auto">
            {isFetching && (
              <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Đang tìm
              </div>
            )}
            {results.map((item) => (
              <button
                key={item._id}
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted"
                onClick={() => pickTrack(item)}
              >
                <ImageWithFallback src={item.coverImage} className="w-10 h-10 rounded object-cover" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">{item.title}</span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {item.artist?.name}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {track && (
        <div className="space-y-4 rounded-2xl border p-4">
          <div className="relative h-56 overflow-hidden rounded-xl bg-black">
            {moodUrl ? (
              <VideoMoodEngine src={moodUrl} isPlaying={isPlaying} blur={0} />
            ) : (
              <ImageWithFallback src={track.coverImage} className="w-full h-full object-cover" />
            )}
          </div>
          <div>
            <p className="font-semibold">{track.title}</p>
            <p className="text-sm text-muted-foreground">{track.artist?.name}</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Bắt đầu {Math.round(startTime)}s</span>
              <span>Độ dài {Math.round(endTime - startTime)}s</span>
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
            />
            <Slider
              min={10}
              max={Math.min(60, Math.max(10, duration || 60))}
              step={1}
              value={[length]}
              onValueChange={([value]) => {
                setPreviewOn(false);
                setLength(value ?? 15);
              }}
            />
          </div>
          <Textarea
            value={caption}
            maxLength={500}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Caption"
          />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => {
              if (previewOn && isPlaying) {
                togglePlay();
                return;
              }
              setPreviewOn(true);
              if (autoplayBlocked) togglePlay();
            }}>
              {isPlaying ? "Tạm dừng" : "Nghe thử"}
            </Button>
            <Button type="button" onClick={submit} disabled={createShort.isPending || endTime - startTime < 10}>
              {createShort.isPending ? "Đang gửi" : "Gửi duyệt"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateShortPage;
