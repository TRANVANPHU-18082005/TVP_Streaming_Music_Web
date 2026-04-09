import { useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Pause, ListMusic, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { IPlaylist } from "../types";
import { PlaylistLikeButton } from "@/features/interaction/components/LikeButton";
import { usePlaylistPlayback } from "@/features/player/hooks/usePlaylistPlayback";
import {
  PremiumMusicVisualizer,
  WaveformBars,
} from "@/components/MusicVisualizer";
interface PublicPlaylistCardProps {
  playlist: IPlaylist;
  className?: string;
}

const PublicPlaylistCard = memo<PublicPlaylistCardProps>(
  function PublicPlaylistCard({ playlist, className }) {
    const navigate = useNavigate();

    // 1. Hook Playback với đầy đủ trạng thái
    const {
      togglePlayPlaylist,
      isThisPlaylistActive,
      isThisPlaylistPlaying,
      isFetching,
    } = usePlaylistPlayback(playlist);

    const handleNavigate = useCallback(() => {
      navigate(`/playlists/${playlist.slug || playlist._id}`);
    }, [navigate, playlist.slug, playlist._id]);

    const creatorName = playlist.isSystem
      ? "MusicHub"
      : playlist.user?.fullName || "Ẩn danh";

    return (
      <article
        onClick={handleNavigate}
        role="button"
        tabIndex={0}
        className={cn(
          "group cursor-pointer flex flex-col gap-3 relative",
          "album-card !overflow-visible p-2 rounded-2xl transition-all duration-300",
          "hover:bg-muted/10",
          isThisPlaylistActive && "bg-primary/5 shadow-brand-soft", // Highlight vùng card
          className,
        )}
      >
        {/* ═══════════════════ ARTWORK CONTAINER ═══════════════════ */}
        <div
          className={cn(
            "relative aspect-square overflow-hidden rounded-[18px] transition-all duration-500",
            "bg-muted border border-border/10 shadow-raised group-hover:shadow-elevated",
            isThisPlaylistActive
              ? "ring-2 ring-primary shadow-glow-md"
              : "ring-1 ring-border/50",
          )}
        >
          {/* B. ẢNH BÌA */}
          {playlist.coverImage ? (
            <ImageWithFallback
              src={playlist.coverImage}
              alt={playlist.title}
              className={cn(
                "size-full object-cover transition-transform duration-1000 ease-out",
                "group-hover:scale-105 [will-change:transform]",
                isThisPlaylistPlaying && "blur-[2px] opacity-70 scale-110", // Zoom nhẹ & mờ khi có đĩa than
              )}
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted via-muted to-accent">
              <ListMusic className="size-12 text-muted-foreground/25" />
            </div>
          )}

          {/* C. OVERLAYS */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

          {/* D. PREMIUM VISUALIZER (Hiện dải sóng rộng ở đáy Card khi ACTIVE) */}
          <AnimatePresence>
            {isThisPlaylistActive && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }} // Thay đổi hiệu ứng một chút cho sang
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                /* Thay đổi chính ở đây: 
         - inset-0: Phủ toàn bộ diện tích card
         - h-full: Chiều cao 100%
         - background: Sử dụng radial-gradient để tối ở tâm, giúp visualizer nổi bật hơn 
      */
                className="absolute inset-0 h-full flex items-center justify-center z-20 pointer-events-none bg-black/20 backdrop-blur-[2px]"
              >
                {/* Visualizer bây giờ sẽ căn giữa tuyệt đối nhờ Flexbox của div cha
                 */}
                <PremiumMusicVisualizer
                  active={isThisPlaylistPlaying}
                  size="md" // Nâng size lên md nếu đặt ở giữa card cho rõ nét
                  barCount={10}
                  className="drop-shadow-brand-glow" // Thêm glow để trông Neural hơn
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* E. NÚT PLAY CHÍNH (Morphing Icon) */}
          <div
            className={cn(
              "absolute right-3 bottom-3 z-30 transition-all duration-300 ease-out",
              isThisPlaylistActive || isFetching
                ? "translate-y-0 opacity-100 scale-100"
                : "translate-y-3 opacity-0 scale-90 group-hover:translate-y-0 group-hover:opacity-100 group-hover:scale-100",
            )}
          >
            <button
              type="button"
              disabled={isFetching}
              onClick={(e) => togglePlayPlaylist(e)}
              className={cn(
                "control-btn control-btn--primary size-12 sm:size-14 shadow-glow-sm",
                isThisPlaylistActive && "bg-primary text-white",
              )}
            >
              <AnimatePresence mode="wait">
                {isFetching ? (
                  <motion.div
                    key="loader"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Loader2 className="size-5 animate-spin" />
                  </motion.div>
                ) : isThisPlaylistPlaying ? (
                  <motion.div
                    key="pause"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.5 }}
                  >
                    <Pause className="size-5 fill-current" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="play"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.5 }}
                  >
                    <Play className="size-5 ml-0.5 fill-current" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>

          {/* F. LIKE BUTTON */}
          <div className="absolute top-2.5 right-2.5 z-30 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <PlaylistLikeButton id={playlist._id} variant="card" />
          </div>
        </div>

        {/* ═══════════════════ INFO SECTION ═══════════════════ */}
        <div className="flex flex-col gap-0.5 px-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3
              className={cn(
                "text-sm font-bold truncate transition-colors duration-200 flex-1",
                isThisPlaylistActive
                  ? "text-primary"
                  : "text-foreground group-hover:text-primary",
              )}
            >
              {playlist.title}
            </h3>

            {/* Sóng nhạc mini cạnh tiêu đề - Đồng bộ trạng thái Playing */}
            {isThisPlaylistActive && (
              <WaveformBars active={isThisPlaylistPlaying} bars={3} />
            )}
          </div>

          <p className="text-[11.5px] text-muted-foreground flex items-center gap-1.5">
            <span className="truncate max-w-[120px]">{creatorName}</span>
            <span className="size-0.5 rounded-full bg-border shrink-0" />
            <span>{playlist.totalTracks || 0} bài</span>
          </p>
        </div>
      </article>
    );
  },
  (p, n) =>
    p.playlist._id === n.playlist._id &&
    p.playlist.title === n.playlist.title &&
    p.playlist.coverImage === n.playlist.coverImage,
);

export default PublicPlaylistCard;
