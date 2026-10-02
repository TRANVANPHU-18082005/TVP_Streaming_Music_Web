import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Mic2, Pause, Play, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { IKaraokeRecording } from "../types";
import { loadYoutubeIframeApi, mixFromRecording, syncVoiceElement, type YoutubePlayerHandle } from "../utils/mixSync";

interface KaraokePlaybackModalProps {
  recording: IKaraokeRecording | null;
  onClose: () => void;
  onEnded?: () => void;
}

export const KaraokePlaybackModal = ({ recording, onClose, onEnded }: KaraokePlaybackModalProps) => {
  const ytPlayerRef = useRef<YoutubePlayerHandle | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onEndedRef = useRef(onEnded);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);

  onEndedRef.current = onEnded;
  const mix = useMemo(
    () => (recording ? mixFromRecording(recording) : null),
    [recording],
  );
  const mixRef = useRef(mix);
  mixRef.current = mix;

  useEffect(() => {
    if (!recording || !mix) return;
    let cancelled = false;
    let player: YoutubePlayerHandle | undefined;

    const initPlayer = () => {
      if (cancelled || !window.YT?.Player) return;
      const mount = document.getElementById("playback-youtube-player");
      if (!mount) return;

      const created = new window.YT.Player(mount, {
        height: "100%",
        width: "100%",
        videoId: recording.youtubeVideoId,
        playerVars: {
          controls: 0,
          rel: 0,
          modestbranding: 1,
          autoplay: 0,
          disablekb: 1,
        },
        events: {
          onReady: (event: { target: YoutubePlayerHandle }) => {
            if (cancelled) return;
            ytPlayerRef.current = event.target;
            setIsReady(true);
            const currentMix = mixRef.current;
            if (!currentMix) return;
            event.target.setVolume(currentMix.backingVolume);
            if (currentMix.backingVolume > 0) event.target.unMute();
            event.target.seekTo(currentMix.startAtSec, true);
            event.target.playVideo();
          },
          onStateChange: (event: { data: number }) => {
            const audio = audioRef.current;
            const currentMix = mixRef.current;
            const currentPlayer = ytPlayerRef.current;
            if (!audio || !currentMix || !currentPlayer) return;

            if (event.data === window.YT.PlayerState.PLAYING) {
              audio.volume = currentMix.voiceVolume / 100;
              const action = syncVoiceElement(audio, currentPlayer.getCurrentTime(), currentMix);
              if (action === "play") void audio.play().catch(() => undefined);
              setIsPlaying(true);
              return;
            }

            if (
              event.data === window.YT.PlayerState.PAUSED
              || event.data === window.YT.PlayerState.BUFFERING
            ) {
              audio.pause();
              setIsPlaying(false);
              return;
            }

            if (event.data === window.YT.PlayerState.ENDED) {
              audio.pause();
              setIsPlaying(false);
              onEndedRef.current?.();
            }
          },
        },
      }) as YoutubePlayerHandle;
      player = created;
      ytPlayerRef.current = created;
    };

    void loadYoutubeIframeApi().then(() => {
      if (!cancelled) initPlayer();
    });

    return () => {
      cancelled = true;
      setIsReady(false);
      setIsPlaying(false);
      ytPlayerRef.current = null;
      try {
        player?.destroy();
      } catch {
        /* Modal đóng trước khi player gắn xong. */
      }
    };
  }, [recording, mix]);

  useEffect(() => {
    if (!isPlaying || !mix) return;
    const timer = window.setInterval(() => {
      const audio = audioRef.current;
      const player = ytPlayerRef.current;
      const currentMix = mixRef.current;
      if (!audio || !currentMix || !player) return;
      if (player.getPlayerState() !== window.YT?.PlayerState?.PLAYING) return;
      const action = syncVoiceElement(audio, player.getCurrentTime(), currentMix);
      if (action === "play" && audio.paused) void audio.play().catch(() => undefined);
    }, 400);
    return () => window.clearInterval(timer);
  }, [isPlaying, mix]);

  const togglePlay = () => {
    const player = ytPlayerRef.current;
    if (!player) return;
    if (isPlaying) player.pauseVideo();
    else player.playVideo();
  };

  if (!recording || !mix) return null;

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
          className="relative z-10 flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border/50 bg-background shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3 border-b bg-muted/30 p-3 md:gap-4 md:p-6">
            <div className="flex items-center gap-3 md:gap-4">
              <Avatar className="h-10 w-10 border-2 border-primary md:h-14 md:w-14">
                <AvatarImage src={recording.user?.avatar} />
                <AvatarFallback>{recording.user?.username?.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col justify-center">
                <h2 className="line-clamp-1 text-base font-bold md:text-xl">{recording.title}</h2>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground md:text-sm">
                  <Mic2 className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  <span className="hidden sm:inline">Biểu diễn bởi</span>
                  <strong className="text-foreground">{recording.user?.fullName}</strong>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground md:p-2"
            >
              <X className="h-5 w-5 md:h-6 md:w-6" />
            </button>
          </div>

          <div className="group relative aspect-video w-full shrink-0 bg-black">
            {!isReady && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-muted-foreground">
                <Loader2 className="mb-2 h-10 w-10 animate-spin text-primary" />
                <p>Đang chuẩn bị sân khấu...</p>
              </div>
            )}
            <div id="playback-youtube-player" className="pointer-events-none absolute inset-0 h-full w-full" />

            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-transparent to-black/20 p-4 opacity-0 transition-opacity group-hover:opacity-100 md:p-6">
              <Button
                size="icon"
                variant="ghost"
                onClick={togglePlay}
                className="h-10 w-10 rounded-full bg-primary/20 text-primary hover:bg-primary hover:text-white md:h-12 md:w-12"
              >
                {isPlaying ? <Pause className="h-5 w-5 md:h-6 md:w-6" /> : <Play className="ml-1 h-5 w-5 md:h-6 md:w-6" />}
              </Button>
            </div>
          </div>

          <audio
            ref={audioRef}
            src={recording.audioUrl}
            className="hidden"
            controlsList="nodownload"
            preload="auto"
          />

          {recording.description && (
            <div className="bg-muted/10 p-3 text-xs md:p-6 md:text-sm">
              <p className="whitespace-pre-wrap">{recording.description}</p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
