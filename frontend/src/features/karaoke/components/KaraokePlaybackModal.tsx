import React, { useEffect, useRef, useState } from "react";
import { X, Mic2, Play, Pause, Loader2, Volume2, Maximize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { IKaraokeRecording } from "../types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface KaraokePlaybackModalProps {
  recording: IKaraokeRecording | null;
  onClose: () => void;
  onEnded?: () => void;
}

export const KaraokePlaybackModal = ({ recording, onClose, onEnded }: KaraokePlaybackModalProps) => {
  const ytPlayerRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Khởi tạo Youtube Player
  useEffect(() => {
    if (!recording) return;

    const initPlayer = () => {
      if (ytPlayerRef.current) ytPlayerRef.current.destroy();

      ytPlayerRef.current = new window.YT.Player("playback-youtube-player", {
        height: "100%",
        width: "100%",
        videoId: recording.youtubeVideoId,
        playerVars: {
          controls: 0,
          rel: 0,
          modestbranding: 1,
          autoplay: 1, // Tự động phát khi tải xong
          disablekb: 1,
        },
        events: {
          onReady: () => {
            setIsReady(true);
            // Có thể video tự động play, onStateChange sẽ xử lý sync
          },
          onStateChange: (event: any) => {
            if (!audioRef.current) return;
            
            if (event.data === window.YT.PlayerState.PLAYING) {
              audioRef.current.play().catch(e => console.error("Audio play error", e));
              setIsPlaying(true);
            } else if (
              event.data === window.YT.PlayerState.PAUSED ||
              event.data === window.YT.PlayerState.BUFFERING
            ) {
              audioRef.current.pause();
              setIsPlaying(false);
            } else if (event.data === window.YT.PlayerState.ENDED) {
              audioRef.current.pause();
              setIsPlaying(false);
              if (onEnded) onEnded();
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (ytPlayerRef.current) ytPlayerRef.current.destroy();
    };
  }, [recording]);

  // Sync thời gian liên tục nếu bị lệch
  useEffect(() => {
    if (!isPlaying || !audioRef.current || !ytPlayerRef.current || !ytPlayerRef.current.getCurrentTime) return;

    const interval = setInterval(() => {
      if (!audioRef.current || !ytPlayerRef.current.getCurrentTime) return;
      const ytTime = ytPlayerRef.current.getCurrentTime();
      const audioTime = audioRef.current.currentTime;
      
      // Nếu lệch quá 0.5s thì sync lại (có thể xảy ra do lag/buffering)
      if (Math.abs(ytTime - audioTime) > 0.5) {
        audioRef.current.currentTime = ytTime;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const togglePlay = () => {
    if (!ytPlayerRef.current) return;
    if (isPlaying) {
      ytPlayerRef.current.pauseVideo();
    } else {
      ytPlayerRef.current.playVideo();
    }
  };

  if (!recording) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-12">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
          onClick={onClose} 
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl bg-background rounded-3xl overflow-hidden shadow-2xl flex flex-col z-10 border border-border/50"
        >
          {/* Header */}
          <div className="p-3 md:p-6 border-b flex items-start justify-between gap-3 md:gap-4 bg-muted/30">
            <div className="flex items-center gap-3 md:gap-4">
              <Avatar className="w-10 h-10 md:w-14 md:h-14 border-2 border-primary">
                <AvatarImage src={recording.user?.avatar} />
                <AvatarFallback>{recording.user?.username?.slice(0,2)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col justify-center">
                <h2 className="text-base md:text-xl font-bold line-clamp-1">{recording.title}</h2>
                <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Mic2 className="w-3 h-3 md:w-3.5 md:h-3.5" /> <span className="hidden sm:inline">Biểu diễn bởi</span> <strong className="text-foreground">{recording.user?.fullName}</strong>
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 md:p-2 rounded-full hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>

          {/* Video Container */}
          <div className="relative w-full aspect-video bg-black group flex-shrink-0">
            {!isReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground z-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-2" />
                <p>Đang chuẩn bị sân khấu...</p>
              </div>
            )}
            <div id="playback-youtube-player" className="absolute inset-0 w-full h-full pointer-events-none" />
            
            {/* Custom overlay controls */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 md:p-6">
              <div className="flex items-center justify-between">
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={togglePlay}
                  className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/20 text-primary hover:bg-primary hover:text-white"
                >
                  {isPlaying ? <Pause className="w-5 h-5 md:w-6 md:h-6" /> : <Play className="w-5 h-5 md:w-6 md:h-6 ml-1" />}
                </Button>
                
                <div className="flex items-center gap-2 md:gap-4">
                  <div className="flex items-center gap-1.5 md:gap-2 text-white/80 bg-black/40 px-2 py-1 md:px-3 md:py-1.5 rounded-full text-xs md:text-sm">
                    <Volume2 className="w-3 h-3 md:w-4 md:h-4" /> Bản thu gốc
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Audio track (Hidden) */}
          <audio 
            ref={audioRef} 
            src={recording.audioUrl} 
            className="hidden" 
            controlsList="nodownload" 
            preload="auto"
          />
          
          {/* Description */}
          {recording.description && (
            <div className="p-3 md:p-6 bg-muted/10 text-xs md:text-sm">
              <p className="whitespace-pre-wrap">{recording.description}</p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
