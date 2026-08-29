import { memo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { mashupApi } from "../../mashup/api/mashupApi";
import { toast } from "sonner";

interface AiMashupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AiMashupModal = memo(({ isOpen, onClose }: AiMashupModalProps) => {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const navigate = useNavigate();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Vui lòng nhập yêu cầu tạo Mashup!");
      return;
    }
    
    setIsGenerating(true);
    const loadingToast = toast.loading("AI đang phân tích và tìm nhạc phù hợp nhất...", { duration: 20000 });
    
    try {
      const res = await mashupApi.aiGenerateMashup(prompt);
      if (res.success && res.data && res.data.length > 0) {
        toast.dismiss(loadingToast);
        onClose();
        setPrompt("");
        navigate("/mashups/create", { state: { aiGeneratedShorts: res.data } });
      } else {
        toast.error("Không đủ đoạn nhạc phù hợp cho yêu cầu này.", { id: loadingToast });
      }
    } catch (error) {
      toast.error("Không thể tạo Mashup lúc này, vui lòng thử lại sau!", { id: loadingToast });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />

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
            <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/30 shrink-0">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="size-5" />
                <h2 className="text-lg font-bold">Auto DJ: AI Mashup</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                disabled={isGenerating}
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex flex-col p-4 sm:p-6 gap-4">
              <p className="text-sm text-muted-foreground">
                Hãy cho AI biết bạn muốn tạo một bản Mashup như thế nào. AI sẽ chọn ra các đoạn nhạc tương thích nhất để hòa trộn lại.
              </p>
              
              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isGenerating}
                  placeholder='Ví dụ: "Một bản mashup EDM quẩy nhiệt tình cuối tuần" hoặc "Nhạc Lofi nhẹ nhàng dễ ngủ"...'
                  className="w-full h-32 p-4 rounded-xl bg-muted/30 border border-border/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm disabled:opacity-50 transition-all"
                />
              </div>

              <div className="flex justify-end mt-2">
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="rounded-full shadow-lg shadow-primary/20 w-full sm:w-auto min-w-[140px]"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Đang phân tích...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4 mr-2" />
                      Tạo Mashup ngay
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});

AiMashupModal.displayName = "AiMashupModal";
export default AiMashupModal;
