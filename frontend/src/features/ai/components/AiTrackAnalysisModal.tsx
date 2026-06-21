import { memo, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Sparkles, AudioWaveform, Heart, Music2, Info, Loader2, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAiTrackAnalysis } from "../hooks/useAiTrackAnalysis";
import { ITrack } from "@/features/track";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { usePlayCollection } from "@/features/player/hooks/usePlayCollection";
import { useAppSelector } from "@/store/hooks";

interface AiTrackAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: ITrack | null;
}

const AiTrackAnalysisModal = memo(({ isOpen, onClose, track }: AiTrackAnalysisModalProps) => {
  const { mutate: analyzeTrack, isPending, data, reset } = useAiTrackAnalysis();
  const { play } = usePlayCollection();
  const currentTrackId = useAppSelector((state) => state.player.currentTrackId);

  useEffect(() => {
    if (isOpen) {
      reset(); // Xóa data cũ khi mở modal
    }
  }, [isOpen, track?._id]);

  const handleAnalyze = () => {
    if (track?._id) {
      analyzeTrack(track._id);
    }
  };

  // Tự động đóng modal nếu người dùng phát một bài hát khác
  useEffect(() => {
    if (isOpen && track && currentTrackId && currentTrackId !== track._id) {
      onClose();
      setTimeout(() => reset(), 300);
    }
  }, [isOpen, track?._id, currentTrackId]);

  const handleClose = () => {
    onClose();
    // Đợi animation đóng xong mới reset data để tránh chớp giật UI
    setTimeout(() => {
      reset();
    }, 300);
  };

  const handlePlayTrack = (targetTrack: ITrack) => {
    play({
      queryKey: ["ai-similar", targetTrack._id],
      fetchFn: async () => ({ tracks: [targetTrack], total: 1 }),
      sourceType: "similar",
      startIndex: 0,
      collectionName: `Gợi ý từ ${track?.title}`,
      shuffle: false,
    });
  };

  if (!track) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className={cn(
              "relative w-full max-w-4xl bg-background border border-border/50 rounded-2xl shadow-2xl overflow-hidden",
              "flex flex-col max-h-[85vh]"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative size-10 rounded-md overflow-hidden shrink-0">
                  <ImageWithFallback src={track.coverImage} className="object-cover size-full" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <AudioWaveform className="size-4 text-primary" />
                    Phân tích bài hát
                  </h2>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-[400px]">
                    {track.title} - {typeof track.artist === 'object' ? (track.artist as any).name : 'Nghệ sĩ'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex flex-col p-4 sm:p-6 gap-6 overflow-y-auto custom-scrollbar">

              {!data && !isPending && (
                <div className="flex flex-col items-center justify-center py-12 sm:py-16 gap-6 animate-in fade-in zoom-in duration-300">
                  <div className="relative flex items-center justify-center size-20 sm:size-24 bg-primary/10 rounded-full">
                    <Sparkles className="size-8 sm:size-10 text-primary" />
                  </div>
                  <div className="text-center space-y-2 max-w-md">
                    <p className="text-base font-semibold text-foreground">
                      Khám phá "{track.title}" cùng AI
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Hệ thống sẽ phân tích giai điệu, cảm xúc, ý nghĩa lời bài hát và tìm ra những ca khúc có phong cách tương đồng nhất.
                    </p>
                  </div>
                  <Button 
                    onClick={handleAnalyze} 
                    className="gap-2 shadow-lg shadow-primary/20 px-8"
                    size="lg"
                  >
                    <Sparkles className="size-4" />
                    Bắt đầu phân tích
                  </Button>
                </div>
              )}

              {isPending && !data && (
                <div className="flex flex-col items-center justify-center py-16 gap-6">
                  <div className="relative flex items-center justify-center size-24">
                    {/* Ripple effects */}
                    <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping"></div>
                    <div className="absolute inset-2 rounded-full border-2 border-primary/50 animate-ping" style={{ animationDelay: '0.2s' }}></div>
                    <div className="absolute inset-4 rounded-full border-2 border-primary/70 animate-ping" style={{ animationDelay: '0.4s' }}></div>
                    <Sparkles className="size-8 text-primary animate-pulse z-10" />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-base font-semibold text-foreground animate-pulse">
                      Gemini đang nghe và phân tích "{track.title}"...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Quá trình này có thể mất vài giây để tìm hiểu lời bài hát và phong cách âm nhạc.
                    </p>
                  </div>
                </div>
              )}

              {data && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col lg:flex-row gap-6"
                >
                  {/* Cột trái: Phân tích */}
                  <div className="flex-1 flex flex-col gap-4">
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-3">
                      <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                        <Info className="size-4" /> Ý nghĩa & Thông điệp
                      </h3>
                      <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                        {data.analysis.meaning}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10 space-y-2">
                        <h3 className="text-sm font-bold text-rose-500 flex items-center gap-2">
                          <Heart className="size-4" /> Cảm xúc chủ đạo
                        </h3>
                        <p className="text-sm font-medium text-foreground">
                          {data.analysis.emotion}
                        </p>
                      </div>

                      <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 space-y-2">
                        <h3 className="text-sm font-bold text-amber-500 flex items-center gap-2">
                          <Music2 className="size-4" /> Phong cách & Nhịp điệu
                        </h3>
                        <p className="text-sm font-medium text-foreground">
                          {data.analysis.musicalStyle}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Cột phải: Đề xuất tương tự */}
                  <div className="w-full lg:w-[320px] flex flex-col gap-3 shrink-0">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border/50 pb-2">
                      <Sparkles className="size-4 text-primary" /> Có thể bạn sẽ thích
                    </h3>

                    <div className="flex flex-col gap-2 overflow-y-auto max-h-[35vh] md:max-h-full pr-1 custom-scrollbar">
                      {data.similarTracks.length > 0 ? (
                        data.similarTracks.map((t) => (
                          <div key={t._id} className="group flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="relative size-12 rounded-md overflow-hidden shrink-0">
                              <ImageWithFallback src={t.coverImage} className="object-cover size-full" />
                              <button
                                onClick={() => handlePlayTrack(t)}
                                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Play className="size-5 text-white fill-white" />
                              </button>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{t.title}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {typeof t.artist === 'object' ? (t.artist as any).name : 'Nghệ sĩ'}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground italic p-2">
                          Hệ thống chưa tìm thấy bài hát nào có phong cách tương tự trong lúc này.
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});

AiTrackAnalysisModal.displayName = "AiTrackAnalysisModal";
export default AiTrackAnalysisModal;
