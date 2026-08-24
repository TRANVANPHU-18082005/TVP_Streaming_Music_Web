import { memo, useState } from "react";
import { Sparkles, Wand2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import AiHubModal from "./AiHubModal";
import AiPlaylistModal from "./AiPlaylistModal";
import AiTrackAnalysisModal from "./AiTrackAnalysisModal";
import { useAppSelector } from "@/store/hooks";
import { toast } from "sonner";
import trackApi from "@/features/track/api/trackApi";
import { mashupApi } from "@/features/mashup/api/mashupApi";
import { setQueue, setIsPlaying } from "@/features/player/slice/playerSlice";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

export const AiHubButton = memo(() => {
  const [isHubOpen, setIsHubOpen] = useState(false);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);

  const currentTrackId = useAppSelector((state) => state.player.currentTrackId);
  const trackMetadataCache = useAppSelector((state) => state.player.trackMetadataCache);
  const currentTrack = currentTrackId ? trackMetadataCache[currentTrackId] : null;

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handlePlayRandomTrack = async () => {
    setIsHubOpen(false);
    const loadingToast = toast.loading("Đang tìm một bài hát ngẫu nhiên...");
    try {
      const res = await trackApi.getRandomTrack();
      if (res.isSuccess && res.data) {
        toast.success(`Đang phát: ${res.data.title}`, { id: loadingToast });
        dispatch(setQueue({
          trackIds: [res.data._id],
          initialMetadata: [res.data],
          startIndex: 0,
          source: { id: "random", type: "suggestions", title: "Ai Hub" }
        }));
        dispatch(setIsPlaying(true));
      }
    } catch (error) {
      toast.error("Không tìm thấy bài hát nào!", { id: loadingToast });
    }
  };

  const handleGenerateMashup = async () => {
    setIsHubOpen(false);
    const loadingToast = toast.loading("AI đang chọn lọc và ghép nối bài hát...", { duration: 10000 });
    try {
      const res = await mashupApi.aiGenerateMashup();
      if (res.success && res.data && res.data.length > 0) {
        toast.dismiss(loadingToast);
        navigate("/mashup/create", { state: { aiGeneratedShorts: res.data } });
      }
    } catch (error) {
      toast.error("Không thể tạo Mashup lúc này, vui lòng thử lại sau!", { id: loadingToast });
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsHubOpen(true)}
        className="hidden md:flex items-center gap-1.5 rounded-full h-9 px-3 text-primary bg-primary/10 hover:bg-primary/20 hover:text-primary transition-colors focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <Sparkles className="size-4" />
        <span className="font-semibold text-[13px]">AI Copilot</span>
      </Button>

      {/* Mobile Icon Only */}
      <button
        type="button"
        onClick={() => setIsHubOpen(true)}
        className="md:hidden flex items-center justify-center size-9 rounded-full text-primary hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <Sparkles className="size-[18px]" />
      </button>

      {/* Ai Hub Modal */}
      <AiHubModal 
        isOpen={isHubOpen} 
        onClose={() => setIsHubOpen(false)} 
        onOpenPlaylist={() => {
          setIsHubOpen(false);
          setIsPlaylistOpen(true);
        }}
        onOpenAnalysis={() => {
          if (!currentTrack) {
            toast.error("Vui lòng phát một bài hát để AI có thể phân tích!");
            return;
          }
          setIsHubOpen(false);
          setIsAnalysisOpen(true);
        }}
        onPlayRandomTrack={handlePlayRandomTrack}
        onGenerateMashup={handleGenerateMashup}
      />

      {/* Ai Playlist Modal */}
      <AiPlaylistModal 
        isOpen={isPlaylistOpen} 
        onClose={() => setIsPlaylistOpen(false)} 
      />

      {/* Ai Track Analysis Modal */}
      <AiTrackAnalysisModal
        isOpen={isAnalysisOpen}
        onClose={() => setIsAnalysisOpen(false)}
        track={currentTrack || null}
      />
    </>
  );
});

AiHubButton.displayName = "AiHubButton";
export default AiHubButton;
