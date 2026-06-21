import { memo, useState } from "react";
import { Sparkles, Wand2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import AiHubModal from "./AiHubModal";
import AiPlaylistModal from "./AiPlaylistModal";
import AiTrackAnalysisModal from "./AiTrackAnalysisModal";
import { useAppSelector } from "@/store/hooks";
import { toast } from "sonner";

export const AiHubButton = memo(() => {
  const [isHubOpen, setIsHubOpen] = useState(false);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);

  const currentTrackId = useAppSelector((state) => state.player.currentTrackId);
  const trackMetadataCache = useAppSelector((state) => state.player.trackMetadataCache);
  const currentTrack = currentTrackId ? trackMetadataCache[currentTrackId] : null;

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
