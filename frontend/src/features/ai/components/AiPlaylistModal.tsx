import { memo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Sparkles, Play, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAiPlaylist } from "../hooks/useAiPlaylist";
import { ITrack } from "@/features/track";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { usePlayCollection } from "@/features/player/hooks/usePlayCollection";
import { usePlaylistMutations } from "@/features/playlist";
import { useAppSelector } from "@/store/hooks";
import { toast } from "sonner";

interface AiPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AiPlaylistModal = memo(({ isOpen, onClose }: AiPlaylistModalProps) => {
  const [prompt, setPrompt] = useState("");
  const { mutate: generatePlaylist, isPending, data, reset } = useAiPlaylist();
  const { play } = usePlayCollection();
  const { createPlaylist, isCreating, addTracks } = usePlaylistMutations();
  const { user } = useAppSelector((state) => state.auth);

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error("Vui lòng nhập yêu cầu tạo playlist!");
      return;
    }
    if (!user) {
      toast.error("Vui lòng đăng nhập để tạo playlist!");
      return;
    }
    generatePlaylist(prompt);
  };

  const handleClose = () => {
    setPrompt("");
    reset();
    onClose();
  };

  const tracks = data?.tracks || [];

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    play({
      queryKey: ["ai-playlist"],
      fetchFn: async () => ({
        tracks,
        trackIds: tracks.map(t => t._id),
        total: tracks.length
      }),
      sourceType: "playlist",
      startIndex: 0,
      collectionName: "AI Playlist",
      shuffle: false,
    });
  };

  const handleSavePlaylist = async () => {
    if (!user) {
      return toast.error("Vui lòng đăng nhập để lưu playlist!");
    }
    if (tracks.length === 0) return;

    const formData = new FormData();
    formData.append("title", `AI: ${prompt.slice(0, 30)}${prompt.length > 30 ? '...' : ''}`);
    formData.append("description", `Playlist được tạo tự động bởi AI với từ khóa: "${prompt}"`);
    formData.append("visibility", "private");

    // Nếu có coverImage từ Pollinations URL, tải nó về và đính kèm thành File
    if (data?.coverImage) {
      try {
        const response = await fetch(data.coverImage);
        const blob = await response.blob();
        formData.append("coverImage", blob, "ai-cover.jpg");
      } catch (err) {
        console.error("Lỗi khi tải ảnh từ Pollinations:", err);
      }
    }

    createPlaylist(
      formData,
      {
        onSuccess: (newPlaylist) => {
          // Ghi chú: Thêm danh sách bài hát vào playlist ngay sau khi tạo
          if (newPlaylist.data?._id && tracks.length > 0) {
            addTracks(newPlaylist.data._id, tracks.map(t => t._id));
            toast.success("Đã tạo playlist và thêm bài hát thành công!");
          } else {
            toast.success("Đã tạo playlist thành công!");
          }
          handleClose();
        }
      }
    );
  };

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
              "relative w-full max-w-2xl bg-background border border-border/50 rounded-2xl shadow-2xl overflow-hidden",
              "flex flex-col max-h-[85vh]"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/30 shrink-0">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="size-5" />
                <h2 className="text-lg font-bold">Tạo Playlist bằng AI</h2>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex flex-col p-4 sm:p-6 gap-4 overflow-y-auto">
              {!data && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Hãy miêu tả danh sách phát bạn muốn nghe. AI của chúng tôi sẽ tìm kiếm các bài hát phù hợp nhất với yêu cầu của bạn.
                  </p>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ví dụ: Nhạc lofi chill để làm việc buổi tối, nhẹ nhàng không lời..."
                    className="w-full h-32 p-4 rounded-xl bg-muted/30 border border-border/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                  <div className="flex justify-end mt-2">
                    <Button
                      onClick={handleGenerate}
                      disabled={isPending || !prompt.trim()}
                      className="gap-2 shadow-lg shadow-primary/20"
                    >
                      {isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                      {isPending ? "Đang tạo..." : "Tạo danh sách"}
                    </Button>
                  </div>
                </>
              )}

              {isPending && !data && (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                  <div className="relative flex items-center justify-center size-16">
                    <span className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin"></span>
                    <Sparkles className="size-6 text-primary animate-pulse" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground animate-pulse">
                    AI đang phân tích và tìm kiếm bài hát...
                  </p>
                </div>
              )}

              {data && (
                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex flex-col gap-1">
                    <h3 className="font-bold text-lg text-foreground">Kết quả cho: "{prompt}"</h3>
                    <p className="text-xs text-muted-foreground">
                      Tìm thấy {tracks.length} bài hát phù hợp. Thể loại nhận diện: {data.analyzed?.genres?.join(", ") || "Không rõ"}
                    </p>
                  </div>

                  {data.coverImage && (
                    <div className="flex justify-center my-2">
                      <div className="relative group overflow-hidden rounded-xl shadow-lg border border-border/50">
                        <img
                          src={data.coverImage}
                          alt="AI Generated Cover"
                          className="w-40 h-40 object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                        <span className="absolute bottom-2 left-2 text-[10px] font-bold text-white bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
                          <Sparkles className="size-3 inline-block mr-1" />
                          AI Cover
                        </span>
                      </div>
                    </div>
                  )}

                  {tracks.length > 0 ? (
                    <div className="flex flex-col gap-2 max-h-[50vh] md:max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                      {tracks.map((track: ITrack) => (
                        <div key={track._id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                          <ImageWithFallback src={track.coverImage} className="size-10 rounded-md object-cover" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{track.title}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {typeof track.artist === 'object' ? (track.artist as any).name : 'Nghệ sĩ'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-10 text-center">
                      <p className="text-muted-foreground">Không tìm thấy bài hát nào phù hợp với yêu cầu của bạn.</p>
                      <Button variant="outline" className="mt-4" onClick={reset}>Thử lại</Button>
                    </div>
                  )}

                  {tracks.length > 0 && (
                    <div className="flex items-center gap-3 mt-auto pt-4 border-t border-border/50">
                      <Button onClick={handlePlayAll} className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                        <Play className="size-4" />
                        Phát toàn bộ
                      </Button>
                      <Button onClick={handleSavePlaylist} disabled={isCreating} variant="outline" className="flex-1 gap-2">
                        {isCreating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                        Lưu thành Playlist
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});

AiPlaylistModal.displayName = "AiPlaylistModal";
export default AiPlaylistModal;
