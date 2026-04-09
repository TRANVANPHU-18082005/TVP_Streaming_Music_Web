"use client";

import { useCallback, useMemo, memo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Play, Pause, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { IAlbum } from "..";
import { AlbumLikeButton } from "@/features/interaction/components/LikeButton";
import { useAlbumPlayback } from "@/features/player/hooks/useAlbumPlayback";
import {
  PremiumMusicVisualizer,
  WaveformBars,
} from "@/components/MusicVisualizer";

interface PublicAlbumCardProps {
  album: IAlbum;
  className?: string;
}

const PublicAlbumCard = memo<PublicAlbumCardProps>(
  function PublicAlbumCard({ album, className }) {
    const navigate = useNavigate();

    // 1. Sử dụng Hook vạn năng đã đóng gói logic Source Context
    const {
      togglePlayAlbum,
      isThisAlbumActive,
      isThisAlbumPlaying,
      isFetching,
    } = useAlbumPlayback(album);

    const releaseYear = useMemo(
      () => album.releaseYear || new Date().getFullYear(),
      [album.releaseYear],
    );

    const handleNavigate = useCallback(() => {
      navigate(`/albums/${album.slug || album._id}`);
    }, [navigate, album.slug, album._id]);

    const stopProp = useCallback(
      (e: React.MouseEvent) => e.stopPropagation(),
      [],
    );

    return (
      <article
        onClick={handleNavigate}
        className={cn(
          "group cursor-pointer flex flex-col gap-3 relative",
          "album-card !overflow-visible p-2 rounded-2xl transition-all duration-300",
          "hover:bg-muted/10",
          isThisAlbumActive && "bg-primary/5 shadow-brand-soft", // Highlight vùng card
          className,
        )}
      >
        {/* ── ARTWORK CONTAINER ── */}
        <div
          className={cn(
            "album-card aspect-square relative isolate overflow-hidden rounded-xl transition-all duration-500",
            isThisAlbumActive
              ? "ring-2 ring-primary shadow-glow-md"
              : "ring-1 ring-border/50",
          )}
        >
          <ImageWithFallback
            src={album.coverImage}
            alt={album.title}
            className={cn(
              "img-cover transition-transform duration-1000",
              "group-hover:scale-110",
              isThisAlbumPlaying && "blur-[2px] opacity-70 scale-105", // Làm mờ nhẹ khi đĩa than hiện lên
            )}
          />
          {/* Premium Visualizer - Chỉ hiện khi đang ACTIVE (kể cả pause) */}
          <AnimatePresence>
            {isThisAlbumActive && (
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
                  active={isThisAlbumPlaying}
                  size="md" // Nâng size lên md nếu đặt ở giữa card cho rõ nét
                  barCount={10}
                  className="drop-shadow-brand-glow" // Thêm glow để trông Neural hơn
                />
              </motion.div>
            )}
          </AnimatePresence>
          {/* Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

          {/* Like Button */}
          <div className="absolute top-2.5 right-2.5 z-20 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <AlbumLikeButton id={album._id} variant="card" />
          </div>

          {/* ── Play Button ── */}
          <div
            className={cn(
              "absolute right-3 bottom-3 z-20 transition-all duration-300 ease-out",
              isThisAlbumActive || isFetching
                ? "translate-y-0 opacity-100 scale-100"
                : "translate-y-3 opacity-0 scale-90 group-hover:translate-y-0 group-hover:opacity-100 group-hover:scale-100",
            )}
          >
            <button
              type="button"
              onClick={(e) => togglePlayAlbum(e)}
              disabled={isFetching}
              className={cn(
                "control-btn control-btn--primary size-12 sm:size-14 shadow-glow-sm",
                isThisAlbumActive && "bg-primary text-white",
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
                ) : isThisAlbumPlaying ? (
                  <motion.div
                    key="pause"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                  >
                    <Pause className="size-5 fill-current" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="play"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                  >
                    <Play className="size-5 ml-0.5 fill-current" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>

          {/* Active Glow Ring khi đang tải */}
          {isFetching && (
            <div className="absolute inset-0 rounded-xl ring-2 ring-primary animate-glow-pulse pointer-events-none" />
          )}
        </div>

        {/* ── INFO SECTION ── */}
        <div className="px-1 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <h3
              className={cn(
                "text-track-title truncate transition-colors duration-200 flex-1",
                isThisAlbumActive
                  ? "text-primary"
                  : "text-foreground group-hover:text-primary",
              )}
            >
              {album.title}
            </h3>

            {/* Sóng nhạc mini cạnh tiêu đề - Chỉ hiện khi Active */}
            {isThisAlbumActive && (
              <WaveformBars active={isThisAlbumPlaying} bars={3} />
            )}
          </div>
          <div className="flex items-center gap-2 text-track-meta truncate">
            <Link
              to={`/artists/${album.artist?.slug || album.artist?._id}`}
              onClick={stopProp}
              className="hover:text-primary hover:underline transition-colors"
            >
              {album?.artist?.name ? album?.artist?.name : ""}
            </Link>
            {album?.artist?.name && (
              <span className="text-[10px] opacity-30">•</span>
            )}
            <span className="text-duration">{releaseYear}</span>
          </div>
        </div>
      </article>
    );
  },
  (p, n) =>
    p.album._id === n.album._id &&
    p.album.coverImage === n.album.coverImage &&
    p.album.title === n.album.title,
);

export default PublicAlbumCard;
