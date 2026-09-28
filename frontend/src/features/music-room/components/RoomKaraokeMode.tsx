import React, { useEffect, useRef, useState } from "react";
import { Mic, ListMusic, Plus, Play, User2, UserCheck, FastForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppSelector } from "@/store/hooks";
import { useKaraokeRecorder } from "../../karaoke/hooks/useKaraokeRecorder";
import { KaraokeYoutubeSearch } from "../../karaoke/components/KaraokeYoutubeSearch";
import { Square, Upload, RefreshCcw } from "lucide-react";

interface RoomKaraokeModeProps {
  videoId?: string;
  karaokeQueue: any[];
  currentSinger?: any;
  isHost: boolean;
  onAddQueue: (videoId: string, title: string) => void;
  onNextSinger: () => void;
  onShareRecording: (recordingId: string, url: string, title: string) => void; // Cho sau này
}


export const RoomKaraokeMode = ({
  videoId,
  karaokeQueue,
  currentSinger,
  isHost,
  onAddQueue,
  onNextSinger
}: RoomKaraokeModeProps) => {
  const playerRef = useRef<any>(null);
  const currentUser = useAppSelector((state) => state.auth.user);

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  const {
    isRecording,
    audioUrl,
    recordingTime,
    startRecording,
    stopRecording,
    clearRecording,
  } = useKaraokeRecorder();

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!videoId || !window.YT || !window.YT.Player) return;

    if (playerRef.current) {
      playerRef.current.destroy();
    }

    playerRef.current = new window.YT.Player("room-karaoke-player", {
      height: "100%",
      width: "100%",
      videoId: videoId,
      playerVars: {
        controls: 1,
        rel: 0,
        modestbranding: 1,
        autoplay: 1
      },
      events: {
        onStateChange: (event: any) => {
          if (event.data === window.YT.PlayerState.ENDED && isHost) {
            onNextSinger();
          }
          // Sync preview audio
          if (audioUrl && previewAudioRef.current) {
            if (event.data === window.YT.PlayerState.PLAYING) {
              previewAudioRef.current.play();
            } else if (
              event.data === window.YT.PlayerState.PAUSED ||
              event.data === window.YT.PlayerState.ENDED
            ) {
              previewAudioRef.current.pause();
            }
          }
        },
      },
    });

    return () => {
      if (playerRef.current) playerRef.current.destroy();
    };
  }, [videoId, isHost, onNextSinger, audioUrl]);

  const handleStartRecord = () => {
    if (!window.confirm("Vui lòng đảm bảo bạn đang ĐEO TAI NGHE để mic không thu âm lại nhạc từ video. Bắt đầu?")) return;
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

  const handlePlayPreview = () => {
    if (!audioUrl) return;
    if (playerRef.current && typeof playerRef.current.seekTo === "function") {
      playerRef.current.seekTo(0);
      playerRef.current.playVideo();
    }
  };

  const handleSelectVideo = (id: string, title: string) => {
    onAddQueue(id, title);
    toast.success("Đã đăng ký hát thành công!");
  };

  const isMyTurn = currentSinger?._id === currentUser?._id;

  return (
    <div className="flex flex-col md:flex-row gap-4 h-full bg-background/50 backdrop-blur-md rounded-2xl p-4 border shadow-xl">
      {/* Left: Player & Current Singer Info */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center gap-2 mb-2">
          <Mic className="text-red-500 animate-pulse w-6 h-6" />
          <h2 className="text-xl font-bold font-display">Sân Khấu Karaoke</h2>
        </div>

        {/* Video Player */}
        <div className="w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border relative flex items-center justify-center">
          {!videoId ? (
            <div className="flex flex-col items-center justify-center text-muted-foreground p-8 text-center animate-in fade-in">
              <Mic className="w-16 h-16 mb-4 opacity-30" />
              <p>Chưa có ai biểu diễn.</p>
              <p className="text-sm">Hãy đăng ký bài hát ở danh sách bên cạnh!</p>
            </div>
          ) : (
            <div id="room-karaoke-player" className="absolute inset-0 w-full h-full" />
          )}
        </div>

        {/* Current Singer Info */}
        {currentSinger && (
          <div className="flex items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
             <div className="flex items-center gap-3">
               <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary">
                 <img src={currentSinger.avatar || "/default-avatar.png"} alt={currentSinger.fullName} className="w-full h-full object-cover" />
               </div>
               <div>
                 <p className="text-sm text-muted-foreground">Đang biểu diễn</p>
                 <p className="font-bold text-lg">{currentSinger.fullName}</p>
               </div>
             </div>
             
             {isMyTurn && (
               <div className="flex items-center gap-2">
                 {!isRecording && !audioUrl && (
                   <Button onClick={handleStartRecord} className="gap-2 bg-red-500 hover:bg-red-600 text-white rounded-full">
                     <Mic className="w-4 h-4" /> Bắt đầu hát
                   </Button>
                 )}
                 {isRecording && (
                   <Button onClick={handleStopRecord} className="gap-2 bg-white text-red-500 hover:bg-gray-100 rounded-full animate-pulse">
                     <Square className="w-4 h-4" /> Dừng & Lưu
                   </Button>
                 )}
                 {audioUrl && !isRecording && (
                   <>
                     <Button onClick={handlePlayPreview} variant="outline" className="gap-2 rounded-full">
                       <Play className="w-4 h-4" /> Nghe lại
                     </Button>
                     <Button onClick={() => { clearRecording(); handleStartRecord(); }} variant="ghost" size="icon" className="rounded-full" title="Thu âm lại">
                       <RefreshCcw className="w-4 h-4" />
                     </Button>
                     <Button onClick={() => toast.info("Tính năng chia sẻ đang phát triển")} className="gap-2 rounded-full bg-primary text-primary-foreground">
                       <Upload className="w-4 h-4" /> Chia sẻ
                     </Button>
                     <audio ref={previewAudioRef} src={audioUrl} className="hidden" />
                   </>
                 )}
               </div>
             )}
             
             {isHost && !isMyTurn && (
               <Button variant="secondary" onClick={onNextSinger} className="gap-2 shrink-0">
                 <FastForward className="w-4 h-4" /> Next Singer
               </Button>
             )}
          </div>
        )}
      </div>

      {/* Right: Queue & Add */}
      <div className="w-full md:w-[350px] flex flex-col gap-4">
        {/* Add Form */}
        <div className="flex flex-col gap-3 p-4 rounded-xl border bg-card/80">
          <h3 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Đăng ký bài hát</h3>
          <div className="relative z-50">
            <KaraokeYoutubeSearch 
              onSelectVideo={handleSelectVideo} 
              placeholder="Tìm kiếm bài hát..." 
            />
          </div>
        </div>

        {/* Queue */}
        <div className="flex-1 flex flex-col rounded-xl border bg-card/80 overflow-hidden">
          <div className="p-3 border-b flex items-center justify-between bg-muted/30">
            <h3 className="font-semibold flex items-center gap-2"><ListMusic className="w-4 h-4" /> Danh sách chờ</h3>
            <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full font-bold">{karaokeQueue.length}</span>
          </div>
          <ScrollArea className="flex-1 p-2">
            {karaokeQueue.length === 0 ? (
               <div className="text-center text-sm text-muted-foreground mt-8">
                 Chưa có ai đăng ký bài tiếp theo.
               </div>
            ) : (
              <div className="flex flex-col gap-2">
                {karaokeQueue.map((item, index) => (
                  <div key={item._id || index} className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{item.youtubeTitle}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                         <User2 className="w-3 h-3" /> {item.user?.fullName}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};
