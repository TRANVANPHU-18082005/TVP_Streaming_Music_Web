import { useState, useRef, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TrackSelector } from "@/features/track";
import { MoodVideoPicker } from "@/features/mood-video/components/MoodVideoPicker";
import { Slider } from "@/components/ui/slider";
import {
  Play, Pause, Scissors, Type, Info, Video, Music,
  ChevronRight, ChevronLeft, Check, AlertTriangle, Sparkles,
  Clock, Zap
} from "lucide-react";
import { ITrackShort } from "../types";
import { useAdminTrackDetail } from "@/features/track/hooks/useTracksQuery";
import { useMoodVideosQuery } from "@/features/mood-video/hooks/useMoodVideoQuery";
import { VideoMoodEngine } from "@/features/player/components/VideoMoodEngine";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";

interface ShortEditorProps {
  initialData?: Partial<ITrackShort>;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const STEPS = [
  {
    id: 1,
    label: "Chọn Media",
    icon: Music,
    description: "Bài hát & Video nền",
  },
  {
    id: 2,
    label: "Cắt đoạn",
    icon: Scissors,
    description: "Chọn highlight",
  },
  {
    id: 3,
    label: "Xuất bản",
    icon: Zap,
    description: "Thông tin & Publish",
  },
];

// Stepper Header
const StepperHeader = ({
  currentStep,
  completedSteps,
}: {
  currentStep: number;
  completedSteps: Set<number>;
}) => (
  <div className="flex items-center px-6 py-5 border-b border-border/50 bg-background/40 gap-0 flex-shrink-0">
    {STEPS.map((step, idx) => {
      const isActive = step.id === currentStep;
      const isDone = completedSteps.has(step.id);
      const StepIcon = step.icon;
      return (
        <div key={step.id} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${
                isDone
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                  : isActive
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-4 ring-primary/20"
                  : "bg-muted text-muted-foreground border border-border"
              }`}
            >
              {isDone ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
            </div>
            <div className="text-center hidden sm:block">
              <p className={`text-xs font-semibold transition-colors ${isActive ? "text-primary" : isDone ? "text-emerald-500" : "text-muted-foreground"}`}>
                {step.label}
              </p>
              <p className="text-[10px] text-muted-foreground/60 hidden md:block">{step.description}</p>
            </div>
          </div>
          {idx < STEPS.length - 1 && (
            <div className="flex-1 mx-3 h-[2px] rounded-full overflow-hidden bg-border">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: isDone ? "100%" : "0%" }}
              />
            </div>
          )}
        </div>
      );
    })}
  </div>
);

// Step 1: Media Selection
const Step1Media = ({
  control,
  errors,
}: {
  control: any;
  errors: any;
}) => (
  <motion.div
    key="step1"
    initial={{ opacity: 0, x: 30 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -30 }}
    transition={{ duration: 0.25 }}
    className="space-y-6"
  >
    <div className="space-y-2">
      <Label className="text-sm font-semibold flex items-center gap-2">
        <Music className="w-4 h-4 text-primary" />
        Bài hát gốc <span className="text-destructive">*</span>
      </Label>
      <p className="text-xs text-muted-foreground">Chọn bài hát để cắt đoạn highlight</p>
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
            {errors.track && (
              <p className="text-destructive text-xs mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {errors.track.message as string}
              </p>
            )}
          </div>
        )}
      />
    </div>

    <Separator />

    <div className="space-y-2">
      <Label className="text-sm font-semibold flex items-center gap-2">
        <Video className="w-4 h-4 text-primary" />
        Video nền (Mood Video) <span className="text-destructive">*</span>
      </Label>
      <p className="text-xs text-muted-foreground">Video nền sẽ phát khi người dùng xem Short này</p>
      <Controller
        name="moodVideo"
        control={control}
        rules={{ required: "Vui lòng chọn video nền" }}
        render={({ field }) => (
          <div>
            <div className="p-3 border border-border rounded-xl overflow-hidden bg-black/10 shadow-inner">
              <MoodVideoPicker
                value={field.value}
                onChange={field.onChange}
                variant="picker"
              />
            </div>
            {errors.moodVideo && (
              <p className="text-destructive text-xs mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {errors.moodVideo.message as string}
              </p>
            )}
          </div>
        )}
      />
    </div>
  </motion.div>
);

// Step 2: Audio Cutting
const Step2Cut = ({
  control,
  watch,
  setValue,
  selectedTrack,
  selectedMoodVideo,
  audioRef,
  isPlaying,
  setIsPlaying,
  currentTime,
}: any) => {
  const startTime = watch("startTime");
  const endTime = watch("endTime");
  const duration = endTime - startTime;
  const isValid = duration >= 10 && duration <= 60;

  const activeLyric = selectedTrack?.lyricPreview?.find(
    (line: any) =>
      currentTime * 1000 >= line.startTime && currentTime * 1000 <= line.endTime
  )?.text;

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

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-8"
    >
      {/* Left: Controls */}
      <div className="space-y-6">
        <div>
          <h3 className="font-semibold text-base flex items-center gap-2 mb-1">
            <Scissors className="w-4 h-4 text-primary" /> Chọn đoạn highlight
          </h3>
          <p className="text-sm text-muted-foreground">
            Kéo 2 đầu slider để chọn đoạn nhạc hay nhất (10–60 giây).
          </p>
        </div>

        {/* Duration indicator */}
        <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
          isValid ? "bg-emerald-500/10 border-emerald-500/30" : "bg-destructive/10 border-destructive/30"
        }`}>
          <Clock className={`w-5 h-5 flex-shrink-0 ${isValid ? "text-emerald-400" : "text-destructive"}`} />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Thời lượng đoạn cắt</p>
            <p className={`text-xl font-bold font-mono ${isValid ? "text-emerald-400" : "text-destructive"}`}>
              {duration.toFixed(1)}s
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground font-mono">
              {formatTime(startTime)} → {formatTime(endTime)}
            </p>
            <p className={`text-xs font-medium ${isValid ? "text-emerald-400" : "text-destructive"}`}>
              {isValid ? "✓ Hợp lệ" : "✗ Phải 10–60s"}
            </p>
          </div>
        </div>

        {/* Slider */}
        <div className="space-y-4">
          <Controller
            name="startTime"
            control={control}
            render={({ field: { value, onChange } }) => (
              <div className="space-y-3">
                <Slider
                  value={[value, endTime]}
                  min={0}
                  max={selectedTrack?.duration || 300}
                  step={0.5}
                  minStepsBetweenThumbs={20}
                  onValueChange={([start, end]) => {
                    onChange(start);
                    setValue("endTime", end);
                    if (audioRef.current) audioRef.current.currentTime = start;
                  }}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground font-mono px-1">
                  <span>0:00</span>
                  <span className="text-center text-muted-foreground/60">Track: {formatTime(selectedTrack?.duration || 0)}</span>
                  <span>{formatTime(selectedTrack?.duration || 0)}</span>
                </div>
              </div>
            )}
          />
        </div>

        {/* Play/Pause preview */}
        <audio ref={audioRef} src={selectedTrack?.hlsUrl || selectedTrack?.trackUrl} />
        <div className="flex items-center gap-4 p-4 rounded-xl bg-black/60 border border-white/10">
          <Button
            type="button"
            variant="default"
            size="icon"
            className="rounded-full w-12 h-12 flex-shrink-0 shadow-lg"
            onClick={togglePreview}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </Button>
          <div>
            <p className="text-sm font-semibold text-foreground">{selectedTrack?.title}</p>
            <p className="text-xs text-muted-foreground">{selectedTrack?.artist?.name}</p>
          </div>
          {isPlaying && (
            <div className="ml-auto flex items-end gap-0.5 h-5">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-1 rounded-full bg-primary"
                  style={{
                    height: `${Math.random() * 60 + 40}%`,
                    animation: `pulse ${0.4 + i * 0.1}s ease-in-out infinite alternate`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Phone Preview */}
      <div className="flex justify-center items-start pt-2">
        <div className="relative w-[200px] h-[356px] sm:w-[220px] sm:h-[392px] bg-black rounded-[2.5rem] border-[5px] border-border overflow-hidden shadow-2xl flex-shrink-0">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-border rounded-b-xl z-20" />
          
          {/* Background Video */}
          <div className="absolute inset-0 z-0 bg-muted">
            <VideoMoodEngine
              src={selectedMoodVideo?.videoUrl || null}
              isPlaying={isPlaying}
              blur={0}
            />
          </div>

          {/* Gradient */}
          <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/40 via-transparent to-black/80" />

          {/* Right side fake actions */}
          <div className="absolute right-2 bottom-16 flex flex-col gap-2.5 z-20">
            {["❤", "↗", "⋯"].map((icon) => (
              <div key={icon} className="w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white text-xs">
                {icon}
              </div>
            ))}
          </div>

          {/* Content overlay */}
          <div className="absolute inset-x-0 bottom-5 p-3 z-20">
            {/* Lyric */}
            <AnimatePresence mode="wait">
              {activeLyric && isPlaying && (
                <motion.p
                  key={activeLyric}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="text-white font-bold text-sm text-center mb-2 drop-shadow-lg"
                  style={{ textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}
                >
                  {activeLyric}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Track chip */}
            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur px-2 py-1 rounded-full w-fit">
              <Music className="w-3 h-3 text-white/70" />
              <span className="text-white/80 text-[10px] font-medium truncate max-w-[120px]">
                {selectedTrack?.title}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-2 h-0.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white w-1/3 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Step 3: Publish Settings
const Step3Publish = ({ control, watch }: { control: any; watch: any }) => (
  <motion.div
    key="step3"
    initial={{ opacity: 0, x: 30 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -30 }}
    transition={{ duration: 0.25 }}
    className="space-y-6 max-w-2xl"
  >
    <div className="space-y-2">
      <Label className="text-sm font-semibold flex items-center gap-2">
        <Type className="w-4 h-4 text-primary" />
        Tiêu đề Short <span className="text-muted-foreground text-xs font-normal">(Tùy chọn)</span>
      </Label>
      <Input
        {...control.register("title")}
        placeholder="VD: Đoạn điệp khúc cực cháy 🔥"
        className="bg-background/50 border-white/10 focus-visible:ring-primary"
        maxLength={80}
      />
      <p className="text-xs text-muted-foreground">Hiển thị nổi bật trên video Short</p>
    </div>

    <div className="space-y-2">
      <Label className="text-sm font-semibold">
        Mô tả (Caption)
        <span className="text-muted-foreground text-xs font-normal ml-1">(Tùy chọn)</span>
      </Label>
      <Textarea
        {...control.register("caption")}
        placeholder="Thêm mô tả hấp dẫn để thu hút người xem..."
        className="bg-background/50 border-white/10 resize-none"
        rows={3}
        maxLength={200}
      />
    </div>

    <Separator />

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Priority */}
      <div className="space-y-2 p-4 rounded-xl bg-muted/30 border border-border/50">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          Độ ưu tiên
        </Label>
        <Input
          type="number"
          {...control.register("priority", { valueAsNumber: true })}
          className="bg-background/50 border-white/10 w-full"
          min={0}
          max={100}
        />
        <p className="text-xs text-muted-foreground">Số lớn → hiển thị sớm hơn trong feed</p>
      </div>

      {/* Publish toggle */}
      <div className="p-4 rounded-xl bg-muted/30 border border-border/50 flex flex-col justify-between gap-3">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Xuất bản ngay
        </Label>
        <Controller
          name="isPublished"
          control={control}
          render={({ field }) => (
            <div className="flex items-center gap-3">
              <Switch checked={field.value} onCheckedChange={field.onChange} />
              <div>
                <p className="text-sm font-medium">
                  {field.value ? "🟢 Đang hiển thị" : "⚪ Đang ẩn"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {field.value ? "Người dùng có thể xem ngay" : "Chỉ admin mới thấy"}
                </p>
              </div>
            </div>
          )}
        />
      </div>
    </div>

    {/* Summary card */}
    <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-1">
      <p className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1.5">
        <Check className="w-3 h-3" /> Tóm tắt Short
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground mt-2">
        {watch("title") && <span>📝 {watch("title")}</span>}
        <span>🎯 Priority: {watch("priority") || 0}</span>
        <span>{watch("isPublished") ? "✅ Sẽ được xuất bản" : "🔒 Sẽ để ẩn"}</span>
      </div>
    </div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
export const ShortEditor = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
}: ShortEditorProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialData?.startTime || 0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      track: initialData?.track?._id || "",
      moodVideo: initialData?.moodVideo?._id || "",
      startTime: initialData?.startTime || 0,
      endTime: initialData?.endTime || 30,
      title: initialData?.title || "",
      caption: initialData?.caption || "",
      isPublished: initialData?.isPublished ?? false,
      priority: initialData?.priority || 0,
    },
  });

  const trackId = watch("track");
  const moodVideoId = watch("moodVideo");
  const startTime = watch("startTime");
  const endTime = watch("endTime");

  const { data: trackData } = useAdminTrackDetail(trackId);
  const selectedTrack = trackData?.data || initialData?.track;

  const { data: moodVideosData } = useMoodVideosQuery({ limit: 100 });
  const selectedMoodVideo =
    moodVideosData?.videos.find((v: any) => v._id === moodVideoId) ||
    initialData?.moodVideo;

  // Auto-stop khi preview chạm endTime
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.currentTime >= endTime) {
        audio.pause();
        setIsPlaying(false);
        audio.currentTime = startTime;
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    return () => audio.removeEventListener("timeupdate", handleTimeUpdate);
  }, [endTime, startTime]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  // Set default endTime khi chọn track mới
  useEffect(() => {
    if (selectedTrack && !initialData?.track) {
      setValue("endTime", Math.min(30, selectedTrack.duration || 30));
    }
  }, [selectedTrack, initialData?.track, setValue]);

  // ── Validation per step ───────────────────────────────────────────────────
  const canGoToStep2 = !!trackId && !!moodVideoId;
  const canGoToStep3 = canGoToStep2 && (endTime - startTime) >= 10 && (endTime - startTime) <= 60;

  const handleNext = async () => {
    if (currentStep === 1 && !canGoToStep2) return;
    if (currentStep === 2 && !canGoToStep3) return;

    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    setCurrentStep((s) => Math.min(s + 1, 3));
  };

  const handleBack = () => {
    setCurrentStep((s) => Math.max(s - 1, 1));
    // Stop audio khi back
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleFinalSubmit = handleSubmit(onSubmit);

  // Stop audio khi rời step 2
  useEffect(() => {
    if (currentStep !== 2 && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [currentStep]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Stepper */}
      <StepperHeader currentStep={currentStep} completedSteps={completedSteps} />

      {/* Step content */}
      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <Step1Media key="step1" control={control} errors={errors} />
          )}
          {currentStep === 2 && (
            <Step2Cut
              key="step2"
              control={control}
              watch={watch}
              setValue={setValue}
              selectedTrack={selectedTrack}
              selectedMoodVideo={selectedMoodVideo}
              audioRef={audioRef}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              currentTime={currentTime}
            />
          )}
          {currentStep === 3 && (
            <Step3Publish key="step3" control={control} watch={watch} />
          )}
        </AnimatePresence>
      </div>

      {/* Footer Navigation */}
      <div className="border-t border-border bg-background/80 backdrop-blur-md px-6 py-4 flex items-center justify-between gap-4 flex-shrink-0">
        <Button
          type="button"
          variant="ghost"
          onClick={currentStep === 1 ? onCancel : handleBack}
          className="gap-2 min-w-[100px]"
          disabled={isLoading}
        >
          {currentStep === 1 ? (
            "Hủy bỏ"
          ) : (
            <><ChevronLeft className="w-4 h-4" /> Quay lại</>
          )}
        </Button>

        {/* Step indicator (mobile) */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((step) => (
            <div
              key={step.id}
              className={`rounded-full transition-all duration-300 ${
                step.id === currentStep
                  ? "w-6 h-2 bg-primary"
                  : completedSteps.has(step.id)
                  ? "w-2 h-2 bg-emerald-500"
                  : "w-2 h-2 bg-border"
              }`}
            />
          ))}
        </div>

        {currentStep < 3 ? (
          <Button
            type="button"
            onClick={handleNext}
            disabled={
              (currentStep === 1 && !canGoToStep2) ||
              (currentStep === 2 && !canGoToStep3)
            }
            className="gap-2 min-w-[130px]"
          >
            Tiếp theo <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleFinalSubmit}
            disabled={isLoading}
            className="gap-2 min-w-[160px] shadow-lg"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {initialData?.track ? "Lưu thay đổi" : "Tạo Short ngay!"}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
