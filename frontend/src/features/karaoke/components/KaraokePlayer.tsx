import React, { useState, useEffect, useRef } from "react";
import { Mic, Square, Play, Pause, Upload, Youtube, RefreshCcw, Loader2 } from "lucide-react";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import PageHeader from "@/components/ui/PageHeader";
import { useKaraokeRecorder } from "../hooks/useKaraokeRecorder";
import { useMyKaraokePermission } from "../hooks/useKaraokeQueries";
import { useUploadRecording } from "../hooks/useKaraokeMutations";
import { KaraokeYoutubeSearch } from "./KaraokeYoutubeSearch";

// Cần regex để bóc video ID từ URL youtube
const extractYoutubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const KaraokePlayer = () => {
  // 1. YouTube & Search State
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string>("");
  const playerRef = useRef<any>(null); // Reference to YT Player object

  // 2. Recorder Hook
  const {
    isRecording,
    audioUrl,
    audioBlob,
    recordingTime,
    startRecording,
    stopRecording,
    clearRecording,
  } = useKaraokeRecorder();

  // 3. Audio Preview State
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  // 4. Upload & Permission State
  const { data: permissionData, isLoading: permissionLoading } = useMyKaraokePermission();
  const { mutateAsync: uploadAudio, isPending: isUploading } = useUploadRecording();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Load YouTube IFrame API script
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Initialize YT Player khi có videoId mới
  useEffect(() => {
    if (!videoId || !window.YT || !window.YT.Player) return;

    // Cleanup player cũ
    if (playerRef.current) {
      playerRef.current.destroy();
    }

    playerRef.current = new window.YT.Player("youtube-player", {
      height: "390",
      width: "100%",
      videoId: videoId,
      playerVars: {
        controls: 1,
        rel: 0,
        modestbranding: 1,
      },
      events: {
        onStateChange: (event: any) => {
          // Nếu đang preview mà video pause, pause luôn audio
          if (audioUrl && previewAudioRef.current) {
            if (event.data === window.YT.PlayerState.PLAYING) {
              previewAudioRef.current.play();
              setIsPlayingPreview(true);
            } else if (
              event.data === window.YT.PlayerState.PAUSED ||
              event.data === window.YT.PlayerState.ENDED
            ) {
              previewAudioRef.current.pause();
              setIsPlayingPreview(false);
            }
          }
        },
      },
    });

    return () => {
      if (playerRef.current) playerRef.current.destroy();
    };
  }, [videoId, audioUrl]);

  // Load video
  const handleSelectVideo = (id: string, selectedTitle: string) => {
    setVideoId(id);
    setVideoTitle(selectedTitle);
    setTitle(selectedTitle); // Tự động điền tiêu đề bài hát
    clearRecording();
  };

  // Recording Controls
  const handleStartRecord = () => {
    // Đeo tai nghe là bắt buộc để tránh dội âm
    if (!window.confirm("Vui lòng đảm bảo bạn đang ĐEO TAI NGHE để mic không thu âm lại nhạc từ video. Bắt đầu?")) {
      return;
    }
    clearRecording();
    startRecording();
    if (playerRef.current && typeof playerRef.current.seekTo === "function") {
      playerRef.current.seekTo(0);
      playerRef.current.playVideo();
    }
  };

  const handleStopRecord = () => {
    stopRecording();
    if (playerRef.current && typeof playerRef.current.pauseVideo === "function") {
      playerRef.current.pauseVideo();
    }
  };

  // Preview Controls
  const handlePlayPreview = () => {
    if (!audioUrl) return;
    if (playerRef.current && typeof playerRef.current.seekTo === "function") {
      playerRef.current.seekTo(0);
      playerRef.current.playVideo();
      // event onStateChange (PLAYING) sẽ tự trigger play audio
    }
  };

  // Upload Logic
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioBlob) return toast.error("Chưa có bản thu nào");
    if (!videoId) return toast.error("Lỗi: Không tìm thấy Video ID");

    // Check permission local
    if (!permissionData?.data?.hasPermission) {
      return toast.error("Bạn chưa được cấp quyền upload hoặc đã hết số lượt. Vui lòng liên hệ Admin.");
    }

    if (!title.trim()) {
      return toast.error("Vui lòng nhập tiêu đề");
    }

    try {
      await uploadAudio({
        audio: audioBlob,
        title: title,
        youtubeVideoId: videoId,
        youtubeTitle: videoTitle || "Karaoke Video",
        description,
        audioDuration: recordingTime,
      });
      toast.success("Tải lên thành công! Đang chờ Admin duyệt.");
      clearRecording();
      setTitle("");
      setDescription("");
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Lỗi khi upload");
    }
  };

  return (
    <div className="flex w-full flex-col lg:flex-row gap-6 p-4 md:p-6 bg-transparent">
      {/* LEFT: Player & Controls */}
      <div className="flex-1 flex flex-col space-y-6">
        <PageHeader title="Phòng Thu Karaoke" />

        {/* Youtube Search Component */}
        <div className="z-20">
          <KaraokeYoutubeSearch onSelectVideo={handleSelectVideo} />
        </div>

        {/* Player Container */}
        <div className="w-full aspect-video bg-black/90 rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative flex items-center justify-center">
          {!videoId ? (
            <div className="flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
              <Youtube className="w-16 h-16 mb-4 opacity-50" />
              <p>Hãy tìm kiếm bài hát trên Youtube bằng thanh tìm kiếm ở trên để bắt đầu hát nhé.</p>
            </div>
          ) : (
            <div id="youtube-player" className="absolute inset-0 w-full h-full" />
          )}
        </div>

        {/* Audio Preview (Hidden, controlled by JS) */}
        {audioUrl && (
          <audio ref={previewAudioRef} src={audioUrl} className="hidden" />
        )}

        {/* Controls Bar */}
        {videoId && (
          <div className="flex flex-col md:flex-row items-center justify-between glass-frosted p-4 rounded-2xl border shadow-floating gap-4">
            <div className="flex flex-wrap items-center gap-2 md:gap-4 justify-center w-full md:w-auto">
              {!isRecording && !audioBlob ? (
                <Button onClick={handleStartRecord} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                  <Mic className="w-4 h-4" /> Bắt đầu Thu Âm
                </Button>
              ) : isRecording ? (
                <div className="flex items-center gap-4">
                  <Button onClick={handleStopRecord} variant="outline" className="gap-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white">
                    <Square className="w-4 h-4" /> Dừng thu
                  </Button>
                  <span className="flex items-center gap-2 text-red-500 font-mono font-medium animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    {formatTime(recordingTime)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button onClick={handlePlayPreview} variant="secondary" className="gap-2">
                    {isPlayingPreview ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    Nghe Lại
                  </Button>
                  <Button onClick={handleStartRecord} variant="outline" className="gap-2">
                    <RefreshCcw className="w-4 h-4" /> Thu Lại
                  </Button>
                </div>
              )}
            </div>

            {audioBlob && (
              <div className="text-sm text-muted-foreground font-mono">
                Độ dài: {formatTime(recordingTime)} | Size: {(audioBlob.size / 1024 / 1024).toFixed(2)} MB
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT: Upload Form */}
      <div className="w-full lg:w-[400px] flex flex-col space-y-6">
        {/* Permission Status */}
        <div className="p-5 rounded-2xl border shadow-floating glass-frosted">
          <h3 className="font-semibold flex items-center gap-2 mb-2">
            <Upload className="w-4 h-4 text-primary" /> Quyền Tải Lên
          </h3>
          {permissionLoading ? (
            <p className="text-sm text-muted-foreground animate-pulse">Đang kiểm tra quyền...</p>
          ) : permissionData?.data?.hasPermission ? (
            <div className="text-sm space-y-1 text-muted-foreground">
              <p className="text-green-500 font-medium">✅ Bạn có thể tải lên</p>
              <p>Số lượt còn lại: <strong className="text-foreground">{permissionData.data.uploadsRemaining === -1 ? 'Vô hạn' : permissionData.data.uploadsRemaining}</strong></p>
              <p>Max duration: <strong className="text-foreground">{permissionData.data.maxDuration / 60} phút</strong></p>
            </div>
          ) : (
            <div className="text-sm text-red-500 font-medium">
              ❌ Bạn chưa có quyền tải lên hoặc đã hết lượt.
              <br />Vui lòng liên hệ Admin để được cấp quyền.
            </div>
          )}
        </div>

        {/* Upload Form */}
        <form onSubmit={handleUpload} className="flex flex-col space-y-5 p-5 rounded-2xl border shadow-floating glass-frosted flex-1">
          <h3 className="font-bold text-xl border-b border-border/50 pb-3 font-display">Đăng bản thu</h3>

          <div className="space-y-2">
            <Label htmlFor="title">Tên bản thu <span className="text-red-500">*</span></Label>
            <Input
              id="title"
              placeholder="VD: Chắc ai đó sẽ về (Cover by Me)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!audioBlob || isUploading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">Mô tả (Không bắt buộc)</Label>
            <Textarea
              id="desc"
              placeholder="Cảm nghĩ của bạn về bản thu này..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!audioBlob || isUploading}
              rows={4}
            />
          </div>

          <div className="mt-auto pt-4">
            <Button
              type="submit"
              className="w-full gap-2"
              disabled={!audioBlob || isUploading || !permissionData?.data?.hasPermission}
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {isUploading ? "Đang tải lên..." : "Tải lên & Gửi duyệt"}
            </Button>
            {!audioBlob && (
              <p className="text-xs text-center text-muted-foreground mt-2">
                Bạn cần thu âm trước khi có thể tải lên
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
