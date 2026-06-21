import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Sparkles, ListMusic, AudioWaveform } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPlaylist: () => void;
  onOpenAnalysis: () => void;
}

const AiHubModal = memo(({ isOpen, onClose, onOpenPlaylist, onOpenAnalysis }: AiHubModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className={cn(
              "relative w-full max-w-lg bg-background border border-border/50 rounded-2xl shadow-2xl overflow-hidden",
              "flex flex-col"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/30">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="size-5" />
                <h2 className="text-lg font-bold">AI Copilot Hub</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 grid grid-cols-1 gap-4">
              <p className="text-sm text-muted-foreground mb-2">
                Khám phá các tính năng AI thông minh giúp nâng cao trải nghiệm âm nhạc của bạn.
              </p>

              {/* Feature 1: AI Playlist */}
              <button
                onClick={onOpenPlaylist}
                className={cn(
                  "flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-card hover:bg-accent/50 transition-colors text-left",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                )}
              >
                <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10 shrink-0">
                  <ListMusic className="size-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Tạo Playlist bằng AI</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Nhập câu lệnh bất kỳ (ví dụ: "Nhạc lofi buồn"), AI sẽ tự động phân tích và tạo ra playlist phù hợp nhất cho bạn.
                  </p>
                </div>
              </button>

              {/* Feature 2: Track Analysis */}
              <button
                onClick={onOpenAnalysis}
                className={cn(
                  "flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-card hover:bg-accent/50 transition-colors text-left",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                )}
              >
                <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10 shrink-0">
                  <AudioWaveform className="size-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    Phân tích bài hát
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Phân tích ý nghĩa sâu sắc của lời bài hát đang phát, phân loại cảm xúc và gợi ý các bài hát tương tự.
                  </p>
                </div>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});

AiHubModal.displayName = "AiHubModal";
export default AiHubModal;
