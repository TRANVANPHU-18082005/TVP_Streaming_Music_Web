import { useEffect, useRef, useState, type FormEvent } from "react";
import { Headphones, Loader2, Mic, Pause, Play, RotateCcw, Square, Upload, Youtube } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useMyKaraokePermission } from "../hooks/useKaraokeQueries";
import { useSubmitForReview, useUpdateRecording, useUploadRecording } from "../hooks/useKaraokeMutations";
import { useKaraokeRecorder } from "../hooks/useKaraokeRecorder";
import { clampSyncOffset, formatClock, loadYoutubeIframeApi, readApiError, syncVoiceElement, type YoutubePlayerHandle } from "../utils/mixSync";
import { acquirePlayback, bindPlaybackOwner, releasePlayback } from "@/features/player/utils/playbackSession";
import { KaraokeOffsetSlider, KaraokeVolumeSlider } from "./KaraokeMixControls";
import { KaraokeYoutubeSearch } from "./KaraokeYoutubeSearch";

type StudioPhase = "pick" | "ready" | "countdown" | "recording" | "review";

const STEPS = [
  { id: "pick", label: "Chọn beat" },
  { id: "ready", label: "Chuẩn bị" },
  { id: "recording", label: "Thu" },
  { id: "review", label: "Nghe lại" },
] as const;

const applyBackingVolume = (player: YoutubePlayerHandle | null, volume: number) => {
  if (!player) return;
  player.setVolume(volume);
  if (volume > 0) player.unMute();
};

export const KaraokePlayer = ({ initialQuery }: { initialQuery?: string }) => {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [backingVolume, setBackingVolume] = useState(100);
  const [voiceVolume, setVoiceVolume] = useState(100);
  const [syncOffsetMs, setSyncOffsetMs] = useState(0);
  const [startAtSec, setStartAtSec] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [awaitingBlob, setAwaitingBlob] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const playerRef = useRef<YoutubePlayerHandle | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const mixRef = useRef({ backingVolume, voiceVolume, syncOffsetMs, startAtSec });
  const startAtSecRef = useRef(0);
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);
  const previewingRef = useRef(false);
  const intentionalStopRef = useRef(false);
  const awaitingLatencyRef = useRef(false);
  const armedAtRef = useRef(0);
  const sessionRef = useRef(0);
  const countdownTimerRef = useRef<number | null>(null);
  const handleYtStateRef = useRef<(state: number) => void>(() => undefined);

  const {
    isRecording,
    isPaused,
    audioBlob,
    audioUrl,
    recordingTime,
    micLevel,
    micReady,
    monitorVolume,
    setMonitorVolume,
    enableMic,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
    error: micError,
  } = useKaraokeRecorder();

  const { data: permissionData, isLoading: permissionLoading } = useMyKaraokePermission();
  const uploadAudio = useUploadRecording();
  const updateDraft = useUpdateRecording();
  const submitReview = useSubmitForReview();
  const permission = permissionData?.data;
  const maxDuration = permission?.maxDuration ?? 0;

  mixRef.current = { backingVolume, voiceVolume, syncOffsetMs, startAtSec };
  startAtSecRef.current = startAtSec;
  isRecordingRef.current = isRecording;
  isPausedRef.current = isPaused;

  const phase: StudioPhase = !videoId
    ? "pick"
    : countdown !== null
      ? "countdown"
      : isRecording || awaitingBlob
        ? "recording"
        : audioBlob
          ? "review"
          : "ready";

  const activeStep = phase === "countdown" ? "ready" : phase === "review" ? "review" : phase;

  const resetTake = (announceDraft: boolean) => {
    sessionRef.current += 1;
    if (countdownTimerRef.current !== null) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    intentionalStopRef.current = true;
    previewingRef.current = false;
    awaitingLatencyRef.current = false;
    isRecordingRef.current = false;
    isPausedRef.current = false;
    if (isRecording) stopRecording();
    playerRef.current?.pauseVideo?.();
    setCountdown(null);
    setAwaitingBlob(false);
    setIsPlayingPreview(false);
    setSyncOffsetMs(0);
    clearRecording();
    if (announceDraft && savedId) {
      toast.info("Bản nháp trước vẫn nằm trong Bản thu của tôi");
    }
    setSavedId(null);
    setSubmitted(false);
  };

  const handleSelectVideo = (id: string, selectedTitle: string) => {
    if (id === videoId && !audioBlob && !isRecording) {
      setVideoTitle(selectedTitle);
      setTitle(selectedTitle);
      return;
    }
    resetTake(Boolean(savedId));
    setVideoId(id);
    setVideoTitle(selectedTitle);
    setTitle(selectedTitle);
    setStartAtSec(0);
  };

  useEffect(() => {
    const suspend = () => {
      playerRef.current?.pauseVideo?.();
      previewAudioRef.current?.pause();
      setIsPlayingPreview(false);
    };
    const unbind = bindPlaybackOwner("karaoke", suspend);
    acquirePlayback("karaoke", suspend);
    return () => {
      unbind();
      releasePlayback("karaoke", suspend);
    };
  }, []);

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    let player: YoutubePlayerHandle | undefined;

    const init = () => {
      if (cancelled || !window.YT?.Player) return;
      const mount = document.getElementById("youtube-player");
      if (!mount) return;
      const created = new window.YT.Player(mount, {
        width: "100%",
        height: "100%",
        videoId,
        playerVars: {
          controls: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event: { target: YoutubePlayerHandle }) => {
            if (cancelled) return;
            playerRef.current = event.target;
            setPlayerReady(true);
            applyBackingVolume(event.target, mixRef.current.backingVolume);
          },
          onStateChange: (event: { data: number }) => {
            handleYtStateRef.current(event.data);
          },
        },
      }) as YoutubePlayerHandle;
      player = created;
      playerRef.current = created;
    };

    void loadYoutubeIframeApi().then(() => {
      if (!cancelled) init();
    });

    return () => {
      cancelled = true;
      setPlayerReady(false);
      playerRef.current = null;
      try {
        player?.destroy();
      } catch {
        /* Player có thể đã bị gỡ khỏi DOM khi đổi video. */
      }
    };
  }, [videoId]);

  useEffect(() => {
    handleYtStateRef.current = (state: number) => {
      const playing = state === window.YT?.PlayerState?.PLAYING;
      const paused = state === window.YT?.PlayerState?.PAUSED;
      const buffering = state === window.YT?.PlayerState?.BUFFERING;
      const ended = state === window.YT?.PlayerState?.ENDED;
      const player = playerRef.current;

      if (playing && isRecordingRef.current && awaitingLatencyRef.current && player) {
        const wallMs = performance.now() - armedAtRef.current;
        const progressMs = (player.getCurrentTime() - startAtSecRef.current) * 1000;
        if (progressMs >= -300 && progressMs <= wallMs + 500) {
          awaitingLatencyRef.current = false;
          setSyncOffsetMs(clampSyncOffset(wallMs - progressMs));
        }
      }

      if (playing && isRecordingRef.current && isPausedRef.current) {
        isPausedRef.current = false;
        resumeRecording();
      }

      if (paused && isRecordingRef.current && !isPausedRef.current && !intentionalStopRef.current) {
        isPausedRef.current = true;
        pauseRecording();
      }

      if (ended && isRecordingRef.current) {
        intentionalStopRef.current = true;
        isRecordingRef.current = false;
        setAwaitingBlob(true);
        stopRecording();
      }

      const audio = previewAudioRef.current;
      if (buffering && previewingRef.current) {
        audio?.pause();
        return;
      }

      if (!previewingRef.current || !audio || !player) {
        if (paused || ended) audio?.pause();
        return;
      }

      if (playing) {
        setIsPlayingPreview(true);
        audio.volume = mixRef.current.voiceVolume / 100;
        const action = syncVoiceElement(audio, player.getCurrentTime(), mixRef.current);
        if (action === "play") void audio.play().catch(() => undefined);
        return;
      }

      audio.pause();
      setIsPlayingPreview(false);
      if (ended) previewingRef.current = false;
    };
  }, [pauseRecording, resumeRecording, stopRecording]);

  useEffect(() => {
    applyBackingVolume(playerRef.current, backingVolume);
  }, [backingVolume, playerReady]);

  useEffect(() => {
    if (audioBlob) setAwaitingBlob(false);
  }, [audioBlob]);

  useEffect(() => {
    if (!isRecording || maxDuration <= 0) return;
    if (recordingTime < maxDuration) return;
    intentionalStopRef.current = true;
    isRecordingRef.current = false;
    setAwaitingBlob(true);
    stopRecording();
    playerRef.current?.pauseVideo?.();
    toast.info("Đã dừng vì hết thời lượng cho phép");
  }, [isRecording, maxDuration, recordingTime, stopRecording]);

  useEffect(() => {
    if (!isPlayingPreview) return;
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      const audio = previewAudioRef.current;
      if (!previewingRef.current || !player || !audio) return;
      if (player.getPlayerState() !== window.YT?.PlayerState?.PLAYING) return;
      const action = syncVoiceElement(audio, player.getCurrentTime(), mixRef.current);
      if (action === "play" && audio.paused) void audio.play().catch(() => undefined);
    }, 400);
    return () => window.clearInterval(timer);
  }, [isPlayingPreview]);

  useEffect(() => {
    const audio = previewAudioRef.current;
    const player = playerRef.current;
    if (!audio || !isPlayingPreview || !player) return;
    audio.volume = voiceVolume / 100;
    const action = syncVoiceElement(
      audio,
      player.getCurrentTime(),
      mixRef.current,
      { force: true },
    );
    if (action === "play") void audio.play().catch(() => undefined);
  }, [syncOffsetMs, voiceVolume, isPlayingPreview]);

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current !== null) window.clearInterval(countdownTimerRef.current);
    };
  }, []);

  const beginRecording = async (token: number) => {
    const player = playerRef.current;
    if (!player) {
      setCountdown(null);
      toast.error("Video chưa sẵn sàng. Hãy đợi một chút.");
      return;
    }

    const started = await startRecording();
    if (sessionRef.current !== token) {
      if (started) stopRecording();
      return;
    }
    if (!started) {
      setCountdown(null);
      return;
    }

    isRecordingRef.current = true;
    isPausedRef.current = false;
    intentionalStopRef.current = false;
    previewingRef.current = false;
    player.seekTo(startAtSecRef.current, true);
    applyBackingVolume(player, mixRef.current.backingVolume);
    armedAtRef.current = performance.now();
    awaitingLatencyRef.current = true;
    player.playVideo();
    setCountdown(null);
  };

  const handleStart = async () => {
    if (!playerRef.current) {
      toast.error("Video chưa sẵn sàng. Hãy đợi một chút.");
      return;
    }
    const micOk = micReady || (await enableMic());
    if (!micOk) return;

    const token = sessionRef.current + 1;
    sessionRef.current = token;
    let left = 3;
    setCountdown(left);
    countdownTimerRef.current = window.setInterval(() => {
      if (sessionRef.current !== token) return;
      left -= 1;
      if (left <= 0) {
        if (countdownTimerRef.current !== null) {
          window.clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        setCountdown(0);
        void beginRecording(token);
      } else {
        setCountdown(left);
      }
    }, 1000);
  };

  const handleCancelCountdown = () => {
    sessionRef.current += 1;
    if (countdownTimerRef.current !== null) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
  };

  const finishTake = () => {
    intentionalStopRef.current = true;
    isRecordingRef.current = false;
    isPausedRef.current = false;
    setAwaitingBlob(true);
    stopRecording();
    playerRef.current?.pauseVideo?.();
  };

  const handlePauseToggle = () => {
    if (isPausedRef.current) {
      isPausedRef.current = false;
      resumeRecording();
      playerRef.current?.playVideo?.();
      return;
    }
    isPausedRef.current = true;
    pauseRecording();
    playerRef.current?.pauseVideo?.();
  };

  const handleTogglePreview = () => {
    const player = playerRef.current;
    const audio = previewAudioRef.current;
    if (!player || !audio) return;

    if (isPlayingPreview) {
      player.pauseVideo();
      audio.pause();
      setIsPlayingPreview(false);
      return;
    }

    audio.volume = voiceVolume / 100;
    applyBackingVolume(player, backingVolume);
    previewingRef.current = true;
    intentionalStopRef.current = false;
    player.seekTo(startAtSec, true);
    setIsPlayingPreview(true);
    player.playVideo();
  };

  const handleUseCurrentTime = () => {
    const current = playerRef.current?.getCurrentTime?.();
    if (typeof current !== "number" || Number.isNaN(current)) return;
    setStartAtSec(Math.max(0, Math.round(current * 10) / 10));
  };

  const handleSaveDraft = async (event: FormEvent) => {
    event.preventDefault();
    if (!audioBlob || !videoId) {
      toast.error("Chưa có bản thu nào");
      return;
    }
    if (!title.trim()) {
      toast.error("Vui lòng nhập tiêu đề");
      return;
    }
    if (recordingTime < 1) {
      toast.error("Bản thu quá ngắn");
      return;
    }
    if (!savedId && !permission?.hasPermission) {
      toast.error("Bạn chưa được cấp quyền upload hoặc đã hết số lượt. Vui lòng liên hệ Admin.");
      return;
    }
    if (permission?.maxFileSize && audioBlob.size > permission.maxFileSize) {
      const maxMb = Math.floor(permission.maxFileSize / 1024 / 1024);
      toast.error(`Kích thước file vượt quá giới hạn cho phép (${maxMb}MB).`);
      return;
    }

    const mix = {
      backingVolume: Math.round(backingVolume),
      voiceVolume: Math.round(voiceVolume),
      syncOffsetMs,
      startAtSec,
    };

    try {
      if (!savedId) {
        const result = await uploadAudio.mutateAsync({
          audio: audioBlob,
          title: title.trim(),
          youtubeVideoId: videoId,
          youtubeTitle: videoTitle || "Karaoke Video",
          description: description.trim() || undefined,
          audioDuration: recordingTime,
          ...mix,
        });
        setSavedId(result.data._id);
        toast.success("Đã lưu bản nháp");
        return;
      }

      await updateDraft.mutateAsync({
        id: savedId,
        payload: {
          title: title.trim(),
          description,
          ...mix,
        },
      });
      toast.success("Đã cập nhật bản nháp");
    } catch (err: unknown) {
      toast.error(readApiError(err, "Lỗi khi lưu bản nháp"));
    }
  };

  const handleSubmitReview = async () => {
    if (!savedId || submitted) return;
    try {
      await submitReview.mutateAsync(savedId);
      setSubmitted(true);
      toast.success("Đã gửi duyệt");
    } catch (err: unknown) {
      toast.error(readApiError(err, "Không gửi duyệt được"));
    }
  };

  const saving = uploadAudio.isPending || updateDraft.isPending;

  return (
    <div className="flex w-full flex-col gap-6 p-4 md:p-6">
      <ol className="flex flex-wrap items-center justify-center gap-2 md:gap-4 mb-2">
        {STEPS.map((step, index) => {
          const current = STEPS.findIndex((item) => item.id === activeStep);
          const done = index < current;
          const active = step.id === activeStep;
          return (
            <li
              key={step.id}
              className={cn(
                "flex items-center justify-center rounded-full px-4 py-1.5 md:py-2 text-xs md:text-sm font-bold transition-all shadow-sm",
                active && "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105",
                done && !active && "bg-primary/10 text-primary border border-primary/20",
                !done && !active && "bg-muted/50 text-muted-foreground border border-border/50 backdrop-blur-sm",
              )}
            >
              {index + 1}. {step.label}
            </li>
          );
        })}
      </ol>

      {phase !== "recording" && phase !== "countdown" && (
        <KaraokeYoutubeSearch onSelectVideo={handleSelectVideo} initialQuery={initialQuery} />
      )}

      <div className="relative w-full aspect-video overflow-hidden rounded-3xl md:rounded-[2rem] border border-white/20 dark:border-white/10 bg-black/90 shadow-2xl ring-4 ring-background/50">
        {!videoId ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground bg-gradient-to-br from-neutral-900 to-black">
            <Youtube className="mb-4 h-16 w-16 opacity-50 drop-shadow-md" />
            <p className="font-medium">Tìm bài karaoke trên YouTube để bắt đầu.</p>
          </div>
        ) : (
          <div className={cn("absolute inset-0", phase !== "ready" && phase !== "pick" && "pointer-events-none")}>
            <div key={videoId} id="youtube-player" className="h-full w-full" />
          </div>
        )}
        {countdown !== null && countdown > 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.span 
              key={countdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="text-8xl md:text-9xl font-black text-primary drop-shadow-lg"
            >
              {countdown}
            </motion.span>
          </div>
        )}
      </div>

      {videoId && (
        <div className="flex flex-col gap-6 rounded-[2rem] border border-white/20 dark:border-white/5 bg-white/50 dark:bg-card/40 p-6 md:p-8 backdrop-blur-2xl shadow-xl relative overflow-hidden">
          <div className="min-w-0 relative z-10">
            <p className="truncate font-bold text-lg md:text-xl text-foreground drop-shadow-sm">{videoTitle || "Beat đã chọn"}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {playerReady ? "Video đã sẵn sàng" : "Đang tải video..."}
            </p>
          </div>

          {(phase === "ready" || phase === "countdown" || phase === "recording") && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm shadow-inner relative z-10">
              <Headphones className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
              <p className="font-medium text-amber-900 dark:text-amber-200">Hãy đeo tai nghe. Mic chỉ ghi giọng của bạn, không ghi nhạc từ loa.</p>
            </div>
          )}

          {phase === "ready" && (
            <div className="grid gap-6 md:grid-cols-2 relative z-10">
              <div className="bg-background/50 rounded-2xl p-4 shadow-sm border border-border/50">
                <KaraokeVolumeSlider label="Nhạc nền" value={backingVolume} onChange={setBackingVolume} />
              </div>
              <div className="bg-background/50 rounded-2xl p-4 shadow-sm border border-border/50">
                <KaraokeVolumeSlider label="Giọng nghe tai" value={monitorVolume} onChange={setMonitorVolume} />
              </div>
              <div className="space-y-3 md:col-span-2 bg-background/50 rounded-2xl p-4 shadow-sm border border-border/50">
                <Label htmlFor="start-at" className="font-bold">Bắt đầu từ (giây)</Label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    id="start-at"
                    type="number"
                    min={0}
                    step={0.1}
                    value={startAtSec}
                    onChange={(event) => setStartAtSec(Math.max(0, Number(event.target.value) || 0))}
                    className="rounded-xl border-border/50 bg-background/50"
                  />
                  <Button type="button" variant="outline" className="rounded-xl border-border/50 hover:bg-muted font-semibold" onClick={handleUseCurrentTime} disabled={!playerReady}>
                    Dùng thời điểm này
                  </Button>
                </div>
              </div>
              <div className="space-y-2 md:col-span-2 bg-background/50 rounded-2xl p-4 shadow-sm border border-border/50">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold">Mức mic</span>
                  <span className="text-muted-foreground font-medium">{micReady ? "Đã bật" : "Chưa bật"}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted shadow-inner border border-border/50">
                  <div
                    className="h-full bg-primary transition-[width] duration-100"
                    style={{ width: `${Math.round(micLevel * 100)}%` }}
                  />
                </div>
                {micError && <p className="text-sm text-destructive font-semibold">{micError}</p>}
              </div>
            </div>
          )}

          {phase === "recording" && (
            <div className="grid gap-6 md:grid-cols-2 relative z-10">
              <div className="bg-background/50 rounded-2xl p-4 shadow-sm border border-border/50">
                <KaraokeVolumeSlider label="Nhạc nền" value={backingVolume} onChange={setBackingVolume} />
              </div>
              <div className="bg-background/50 rounded-2xl p-4 shadow-sm border border-border/50">
                <KaraokeVolumeSlider label="Giọng nghe tai" value={monitorVolume} onChange={setMonitorVolume} />
              </div>
            </div>
          )}

          {phase === "review" && (
            <div className="grid gap-6 relative z-10">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="bg-background/50 rounded-2xl p-4 shadow-sm border border-border/50">
                  <KaraokeVolumeSlider label="Nhạc nền" value={backingVolume} onChange={setBackingVolume} />
                </div>
                <div className="bg-background/50 rounded-2xl p-4 shadow-sm border border-border/50">
                  <KaraokeVolumeSlider label="Giọng bản thu" value={voiceVolume} onChange={setVoiceVolume} />
                </div>
              </div>
              <div className="bg-background/50 rounded-2xl p-4 shadow-sm border border-border/50">
                <KaraokeOffsetSlider value={syncOffsetMs} onChange={setSyncOffsetMs} />
                <p className="text-xs text-muted-foreground mt-2 font-medium">
                  Nghe lại từ {formatClock(startAtSec)}. Kéo lệch nhịp nếu giọng chưa khớp beat. Ngưỡng tự kéo lại là 250 ms.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 relative z-10 pt-2">
            {phase === "ready" && (
              <Button onClick={() => void handleStart()} className="gap-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8 py-6 shadow-lg shadow-primary/30 text-base font-bold transition-transform hover:scale-105 border-none" disabled={!playerReady}>
                <Mic className="h-5 w-5" /> Bắt đầu thu
              </Button>
            )}
            {phase === "countdown" && (
              <Button variant="outline" className="rounded-full px-8 py-6 font-bold bg-background/80 backdrop-blur" onClick={handleCancelCountdown}>Hủy</Button>
            )}
            {phase === "recording" && (
              <>
                <Button variant="outline" className="gap-2 border-primary/50 bg-primary/10 hover:bg-primary/20 text-primary rounded-full px-6 shadow-sm" onClick={finishTake} disabled={awaitingBlob}>
                  <Square className="h-4 w-4" /> Dừng thu
                </Button>
                <Button variant="outline" className="rounded-full px-6 shadow-sm font-semibold bg-background/80" onClick={handlePauseToggle} disabled={awaitingBlob}>
                  {isPaused ? "Tiếp tục" : "Tạm dừng"}
                </Button>
                <span className="flex items-center gap-2 font-mono text-lg font-bold text-primary bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20 shadow-sm ml-2">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
                  {formatClock(recordingTime)}
                  {maxDuration > 0 ? <span className="text-primary/50">/ {formatClock(maxDuration)}</span> : ""}
                </span>
                {awaitingBlob && <Loader2 className="h-5 w-5 animate-spin text-primary ml-2" />}
              </>
            )}
            {phase === "review" && (
              <>
                <Button variant="secondary" className="gap-2 rounded-full px-6 shadow-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleTogglePreview}>
                  {isPlayingPreview ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                  Nghe lại
                </Button>
                <Button variant="outline" className="gap-2 rounded-full px-6 shadow-sm font-semibold bg-background/80" onClick={() => resetTake(Boolean(savedId))}>
                  <RotateCcw className="h-4 w-4" /> Thu lại
                </Button>
                {audioBlob && (
                  <span className="font-mono text-sm font-bold text-foreground/80 bg-background/50 px-4 py-1.5 rounded-full border border-border/50 ml-2 shadow-sm">
                    {formatClock(recordingTime)} <span className="text-muted-foreground mx-1">·</span> {(audioBlob.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                )}
              </>
            )}
          </div>

          {phase === "ready" && (
            <p className="text-xs md:text-sm text-muted-foreground/80 font-medium bg-background/40 p-3 rounded-xl border border-border/30 relative z-10 text-center md:text-left">
              {permissionLoading
                ? "Đang kiểm tra quyền tải lên..."
                : permission?.hasPermission
                  ? `Còn ${permission.uploadsRemaining === -1 ? "không giới hạn" : permission.uploadsRemaining} lượt tải lên${maxDuration > 0 ? ` · Tối đa ${Math.floor(maxDuration / 60)} phút/bản` : ""}.`
                  : "Bạn chưa có quyền tải lên hoặc đã hết lượt. Vẫn có thể thu để nghe thử."}
            </p>
          )}
        </div>
      )}

      {audioUrl && <audio ref={previewAudioRef} src={audioUrl} preload="metadata" className="hidden" />}

      {phase === "review" && (
        <form onSubmit={(event) => void handleSaveDraft(event)} className="flex flex-col gap-6 rounded-[2rem] border border-white/20 dark:border-white/5 bg-white/50 dark:bg-card/40 p-6 md:p-8 backdrop-blur-2xl shadow-xl mt-4">
          <div>
            <h3 className="font-display text-2xl font-bold flex items-center gap-2"><Upload className="w-6 h-6 text-primary" /> Lưu bản thu</h3>
            <p className="text-sm text-muted-foreground mt-1 font-medium">Lưu nháp trước. Gửi duyệt là bước riêng sau khi bạn đã lưu nháp thành công.</p>
          </div>
          <div className="space-y-3">
            <Label htmlFor="take-title" className="font-bold">Tên bản thu</Label>
            <Input
              id="take-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={saving || submitted}
              required
              className="rounded-xl border-border/50 bg-background/50 h-11"
              placeholder="VD: Mashup tuyệt vời..."
            />
          </div>
          <div className="space-y-3">
            <Label htmlFor="take-desc" className="font-bold">Mô tả (Tuỳ chọn)</Label>
            <Textarea
              id="take-desc"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={saving || submitted}
              rows={3}
              className="rounded-xl border-border/50 bg-background/50 resize-none"
              placeholder="Cảm nghĩ của bạn về bản thu này..."
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row pt-2">
            <Button type="submit" className="gap-2 rounded-full px-8 h-11 shadow-md shadow-primary/20 font-bold" disabled={saving || submitted || (!savedId && !permission?.hasPermission)}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {savedId ? "Cập nhật bản nháp" : "Lưu bản nháp"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="rounded-full px-8 h-11 shadow-sm font-bold bg-background border border-border hover:bg-muted"
              disabled={!savedId || submitted || submitReview.isPending}
              onClick={() => void handleSubmitReview()}
            >
              {submitReview.isPending ? "Đang gửi..." : submitted ? "Đã gửi duyệt" : "Gửi duyệt cho Admin"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
