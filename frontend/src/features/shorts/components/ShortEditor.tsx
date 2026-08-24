import { useState, useRef, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TrackSelector } from "@/features/track";
import { MoodVideoPicker } from "@/features/mood-video/components/MoodVideoPicker";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Scissors, Type, Info, Video, Music, Smartphone } from "lucide-react";
import { ITrackShort } from "../types";
import { useAdminTrackDetail } from "@/features/track/hooks/useTracksQuery";
import { useMoodVideosQuery } from "@/features/mood-video/hooks/useMoodVideoQuery";
import { VideoMoodEngine } from "@/features/player/components/VideoMoodEngine";
import { Separator } from "@/components/ui/separator";

interface ShortEditorProps {
  initialData?: Partial<ITrackShort>;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export const ShortEditor = ({ initialData, onSubmit, onCancel, isLoading }: ShortEditorProps) => {
  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      track: initialData?.track?._id || "",
      moodVideo: initialData?.moodVideo?._id || "",
      startTime: initialData?.startTime || 0,
      endTime: initialData?.endTime || 30,
      title: initialData?.title || "",
      caption: initialData?.caption || "",
      isPublished: initialData?.isPublished ?? false,
      priority: initialData?.priority || 0,
    }
  });

  const trackId = watch("track");
  const { data: trackData } = useAdminTrackDetail(trackId);
  const selectedTrack = trackData?.data || initialData?.track;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialData?.startTime || 0);

  const startTime = watch("startTime");
  const endTime = watch("endTime");

  const moodVideoId = watch("moodVideo");
  const { data: moodVideosData } = useMoodVideosQuery({ limit: 100 });
  const selectedMoodVideo = moodVideosData?.videos.find((v: any) => v._id === moodVideoId) || initialData?.moodVideo;

  // Active lyric
  const activeLyric = selectedTrack?.lyricPreview?.find(
    (line: any) => currentTime * 1000 >= line.startTime && currentTime * 1000 <= line.endTime
  )?.text;

  // Xử lý auto-stop khi preview chạm đến endTime
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.currentTime >= endTime) {
        audio.pause();
        setIsPlaying(false);
        audio.currentTime = startTime; // Reset về điểm đầu
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    return () => audio.removeEventListener("timeupdate", handleTimeUpdate);
  }, [endTime, startTime]);

  // Cleanup audio khi đóng modal/unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  // Cập nhật duration khi đổi track
  useEffect(() => {
    if (selectedTrack && !initialData) {
      // Mặc định chọn 30s đầu nếu track đủ dài
      const defaultEnd = Math.min(30, selectedTrack.duration || 30);
      setValue("endTime", defaultEnd);
    }
  }, [selectedTrack, initialData, setValue]);

  const togglePreview = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.currentTime = startTime;
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full relative">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 overflow-y-auto no-scrollbar pb-24 pr-1 md:pr-2">

        {/* LEFT COLUMN: Data Entry */}
        <div className="lg:col-span-7 space-y-8">

          {/* SECTION 1: Media Selection */}
          <section className="space-y-5 bg-background/40 p-5 rounded-xl border border-border">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Music className="w-5 h-5 text-primary" /> Media & Video
            </h2>
            <div className="grid gap-6">
              <div className="space-y-2">
                <Label className="text-muted-foreground flex items-center gap-2">
                  <Music className="w-4 h-4" /> Bài hát gốc <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="track"
                  control={control}
                  rules={{ required: "Vui lòng chọn bài hát" }}
                  render={({ field }) => (
                    <div>
                      <TrackSelector
                        value={field.value}
                        onChange={(val) => field.onChange(Array.isArray(val) ? val[0] : val)}
                        multiple={false}
                      />
                      {errors.track && <p className="text-destructive text-sm mt-1">{errors.track.message as string}</p>}
                    </div>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground flex items-center gap-2">
                  <Video className="w-4 h-4" /> Mood Video nền <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="moodVideo"
                  control={control}
                  rules={{ required: "Vui lòng chọn video nền" }}
                  render={({ field }) => (
                    <div className="p-2 md:p-4 border border-border rounded-lg overflow-hidden bg-black/20 shadow-inner">
                      <MoodVideoPicker
                        value={field.value}
                        onChange={field.onChange}
                        variant="picker"
                      />
                    </div>
                  )}
                />
                {errors.moodVideo && <p className="text-destructive text-sm mt-1">{errors.moodVideo.message as string}</p>}
              </div>
            </div>
          </section>

          {/* SECTION 2: Text Information */}
          <section className="space-y-5 bg-background/40 p-5 rounded-xl border border-border">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Type className="w-5 h-5 text-primary" /> Thông tin hiển thị
            </h2>
            <div className="grid gap-6">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Tiêu đề Short (Tùy chọn)</Label>
                <Input
                  {...control.register("title")}
                  placeholder="VD: Highlight đoạn điệp khúc cực cháy..."
                  className="bg-background/50 border-white/10"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Mô tả (Caption)</Label>
                <Input
                  {...control.register("caption")}
                  placeholder="Thêm mô tả thu hút người xem..."
                  className="bg-background/50 border-white/10"
                />
              </div>
            </div>
          </section>

          {/* SECTION 3: Settings */}
          <section className="space-y-5 bg-background/40 p-5 rounded-xl border border-border">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" /> Cài đặt xuất bản
            </h2>
            <div className="flex flex-col sm:flex-row gap-8 items-start sm:items-center">
              <div className="flex-1 space-y-2 w-full">
                <Label className="text-muted-foreground">Độ ưu tiên hiển thị (Priority)</Label>
                <Input
                  type="number"
                  {...control.register("priority", { valueAsNumber: true })}
                  className="bg-background/50 border-white/10 w-full sm:max-w-[200px]"
                />
                <p className="text-xs text-muted-foreground">Số càng lớn hiển thị càng cao trong feed</p>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-card/50 border border-border w-full sm:w-auto mt-2 sm:mt-0">
                <Controller
                  name="isPublished"
                  control={control}
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
                <div className="space-y-0.5">
                  <Label className="font-semibold">Publish lên Feed</Label>
                  <p className="text-xs text-muted-foreground">Người dùng có thể xem</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Audio Waveform & Preview (Sticky) */}
        <div className="lg:col-span-5 h-full relative">
          <div className="sticky top-0 space-y-5 bg-card p-5 rounded-xl border border-primary/20 shadow-lg shadow-primary/5">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Scissors className="w-5 h-5 text-primary" /> Cắt Highlight
            </h3>
            <p className="text-sm text-muted-foreground">
              Chọn đoạn nhạc hay nhất làm điểm nhấn cho Short. (Thời lượng từ 10s - 60s)
            </p>

            <Separator className="bg-border" />

            {selectedTrack ? (
              <div className="space-y-8 py-2">
                {/* Audio Element ẩn */}
                <audio ref={audioRef} src={selectedTrack.hlsUrl || selectedTrack.trackUrl} />

                {/* Mobile Preview Box */}
                <div className="flex justify-center mb-6">
                  <div className="relative w-[200px] h-[350px] sm:w-[240px] sm:h-[426px] bg-black rounded-[2rem] border-[6px] border-border overflow-hidden shadow-2xl flex-shrink-0">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-4 bg-border rounded-b-xl z-20" />
                    
                    {/* Background Video */}
                    <div className="absolute inset-0 z-0 bg-muted">
                      <VideoMoodEngine 
                        src={selectedMoodVideo?.videoUrl || null} 
                        isPlaying={isPlaying}
                        blur={0} 
                      />
                    </div>
                    
                    {/* Scrims */}
                    <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/40 via-transparent to-black/80 pointer-events-none" />
                    
                    {/* Fake UI Elements */}
                    <div className="absolute right-2 bottom-20 flex flex-col gap-3 z-20">
                      <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur" />
                      <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur" />
                      <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur" />
                    </div>
                    
                    {/* Content / Lyrics */}
                    <div className="absolute inset-x-0 bottom-6 p-4 z-20 flex flex-col justify-end">
                      <h4 className="font-bold text-white text-sm line-clamp-1 shadow-black drop-shadow-md">
                        {watch("title") || selectedTrack.title}
                      </h4>
                      
                      {/* Lời bài hát */}
                      <div className="mt-2 min-h-[40px] flex items-end">
                        {activeLyric ? (
                          <p className="text-white font-bold text-base md:text-lg text-center w-full leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-bottom-2">
                            {activeLyric}
                          </p>
                        ) : selectedTrack.plainLyrics ? (
                          <p className="text-white/60 text-xs line-clamp-2 italic shadow-black drop-shadow-md">
                            (Playing...)
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Audio Player Controls */}
                <div className="flex gap-4 items-center bg-black/60 backdrop-blur-sm p-4 rounded-xl border border-white/10 shadow-inner">
                  <Button
                    type="button"
                    variant="default"
                    size="icon"
                    className="rounded-full w-14 h-14 flex-shrink-0 bg-primary hover:bg-primary/90 text-black shadow-lg shadow-primary/20"
                    onClick={togglePreview}
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                  </Button>

                  <div className="flex-1 flex flex-col gap-1">
                    <div className="text-sm font-medium flex justify-between">
                      <span className="text-muted-foreground">Preview đoạn cắt:</span>
                      <span className="text-primary font-bold">
                        {startTime.toFixed(1)}s - {endTime.toFixed(1)}s
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground flex justify-between">
                      <span>Độ dài đoạn:</span>
                      <span className={`font-semibold ${(endTime - startTime) < 10 || (endTime - startTime) > 60 ? "text-destructive" : "text-emerald-400"}`}>
                        {(endTime - startTime).toFixed(1)}s
                      </span>
                    </div>
                  </div>
                </div>

                {/* Range Slider */}
                <div className="space-y-6 pt-4 px-2">
                  <Label className="font-semibold text-foreground">Kéo để chọn phân đoạn</Label>
                  <Controller
                    name="startTime"
                    control={control}
                    render={({ field: { value, onChange } }) => (
                      <div className="relative w-full h-8 flex items-center">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 pointer-events-none" />
                        <Slider
                          value={[value, endTime]}
                          min={0}
                          max={selectedTrack.duration || 300}
                          step={0.1}
                          minStepsBetweenThumbs={100} // ~10 seconds minimum
                          onValueChange={([start, end]) => {
                            onChange(start);
                            setValue("endTime", end);
                            if (audioRef.current) audioRef.current.currentTime = start;
                          }}
                          className="w-full relative z-10"
                        />
                      </div>
                    )}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground px-1">
                    <span>0:00</span>
                    <span>Track length: {selectedTrack.duration ? Math.floor(selectedTrack.duration / 60) + ":" + String(Math.floor(selectedTrack.duration % 60)).padStart(2, '0') : "Unknown"}</span>
                  </div>
                </div>

                {/* Warning message if validation fails visually */}
                {((endTime - startTime) < 10 || (endTime - startTime) > 60) && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg text-center font-medium">
                    Thời lượng phải nằm trong khoảng 10 giây đến 60 giây.
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border p-6 text-center gap-3">
                <Music className="w-10 h-10 opacity-20" />
                <p>Vui lòng chọn bài hát ở phần "Media & Video" để hiển thị công cụ cắt audio.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STICKY FOOTER (ACTIONS) */}
      <div className="absolute bottom-0 left-0 right-0 bg-card/80 backdrop-blur-md border-t border-border p-4 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.3)] flex justify-end gap-4 rounded-b-xl z-20">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className="min-w-[100px]"
        >
          Hủy bỏ
        </Button>
        <Button
          type="submit"
          disabled={isLoading || (selectedTrack && ((endTime - startTime) < 10 || (endTime - startTime) > 60))}
          className="min-w-[150px] shadow-lg"
        >
          {initialData?.track ? "Lưu thay đổi" : "Tạo mới Short"}
        </Button>
      </div>
    </form>
  );
};
