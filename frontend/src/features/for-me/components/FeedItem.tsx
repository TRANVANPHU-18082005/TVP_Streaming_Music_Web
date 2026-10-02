import type { MouseEvent, ReactNode } from "react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ban, Captions, CheckCheck, ChevronDown, ChevronUp, Heart, MoreHorizontal, Play, Share2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ForMeProgressBar } from "./ForMeProgressBar";
import { ForMeLyrics } from "./ForMeLyrics";
import { useImageColor } from "@/hooks/useImageColor";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { useContextSheet } from "@/app/provider/SheetProvider";
import { MarqueeText } from "@/features/player/components/MarqueeText";
import ArtistDisplay from "@/features/artist/components/ArtistDisplay";
import { useInteraction } from "@/features/interaction/hooks/useInteraction";
import { selectIsInteracted } from "@/features/interaction/slice/interactionSlice";
import { useAppSelector } from "@/store/hooks";
import type { ITrack } from "@/features/track/types";

interface FeedItemProps {
  track: ITrack;
  isPlaying: boolean;
  lyricsOpen: boolean;
  onTogglePlay: () => void;
  onToggleLyrics: () => void;
  onPrev: () => void;
  onNext: () => void;
  onDismiss: () => void;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n || 0);
}

interface ActionBtnProps {
  icon: ReactNode;
  label?: string;
  pressed?: boolean;
  onClick?: (event: MouseEvent) => void;
  labelText: string;
}

const ActionBtn = ({ icon, label, pressed, onClick, labelText }: ActionBtnProps) => (
  <motion.button
    type="button"
    aria-label={labelText}
    aria-pressed={pressed}
    whileTap={{ scale: 0.85 }}
    onClick={(event) => {
      event.stopPropagation();
      onClick?.(event);
    }}
    className="flex cursor-pointer select-none flex-col items-center gap-[5px] outline-none"
  >
    <div
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 md:h-12 md:w-12",
        pressed
          ? "scale-105 bg-white/25"
          : "border border-white/10 bg-black/30 hover:scale-105 hover:bg-white/20",
      )}
    >
      {icon}
    </div>
    {label && (
      <span className="text-[10px] font-semibold leading-none tracking-wide text-white drop-shadow-lg md:text-xs">
        {label}
      </span>
    )}
  </motion.button>
);

export const FeedItem = ({
  track,
  isPlaying,
  lyricsOpen,
  onTogglePlay,
  onToggleLyrics,
  onPrev,
  onNext,
  onDismiss,
}: FeedItemProps) => {
  const { openTrackSheet } = useContextSheet();
  const navigate = useNavigate();
  const { color: accentColor } = useImageColor(track.coverImage);
  const { handleToggle } = useInteraction();
  const isLiked = useAppSelector((state) => selectIsInteracted(state, track._id, "track"));
  const isPending = useAppSelector((state) => Boolean(state.interaction.loadingIds[`track:${track._id}`]));
  const [shared, setShared] = useState(false);

  const handleLikeClick = useCallback((event: MouseEvent) => {
    event.stopPropagation();
    if (isPending) return;
    handleToggle(track._id, "track");
  }, [handleToggle, track._id, isPending]);

  const handleShare = useCallback(async (event: MouseEvent) => {
    event.stopPropagation();
    const url = `${window.location.origin}/tracks/${track.slug || track._id}`;
    const title = track.title;
    const text = `Nghe "${title}" trên TVP Music`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        window.setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // Người dùng đóng hộp chia sẻ.
    }
  }, [track]);

  const artistSlug = typeof track.artist === "object" ? track.artist?.slug : undefined;
  const artistAvatar = typeof track.artist === "object" ? track.artist?.avatar : undefined;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <div
        className="absolute inset-0 z-0 scale-110"
        style={{
          backgroundImage: `url(${track.coverImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(40px) brightness(0.35) saturate(1.2)",
        }}
      />
      <div className="relative z-10 flex h-full items-center justify-center px-4 pb-16 pt-16 md:px-10">
        <div className="flex w-full max-w-xl flex-col items-center">
          {track.reason && (
            <p className="mb-4 max-w-full truncate rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs font-medium text-white/90">
              {track.reason}
            </p>
          )}
          <div className="mb-6 max-w-[420px] text-center">
            <MarqueeText
              text={track.title}
              className="text-2xl font-bold leading-tight tracking-tight text-white md:text-3xl"
              speed={38}
              pauseMs={1600}
            />
            <ArtistDisplay
              mainArtist={track.artist}
              featuringArtists={track.featuringArtists}
              className="mt-1 flex items-center justify-center gap-1 text-base text-white/80 md:text-lg"
            />
          </div>

          <div className="flex items-center gap-6 md:gap-8">
            <motion.button
              type="button"
              aria-label={isPlaying ? "Tạm dừng" : "Phát"}
              animate={isPlaying ? { scale: 1 } : { scale: 0.96 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative cursor-pointer"
              onClick={onTogglePlay}
            >
              <div className="absolute inset-0 scale-105 rounded-2xl bg-white/10 opacity-60 blur-2xl" />
              <div className="relative h-[220px] w-[220px] overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/20 sm:h-[280px] sm:w-[280px] md:h-[320px] md:w-[320px]">
                <ImageWithFallback src={track.coverImage} className="h-full w-full object-cover" />
                <AnimatePresence>
                  {!isPlaying && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      className="absolute inset-0 flex items-center justify-center bg-black/30"
                    >
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-black/50">
                        <Play fill="white" className="ml-1 h-8 w-8 text-white" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.button>

            <div className="flex flex-col gap-3">
              <ActionBtn
                labelText={isLiked ? "Bỏ thích" : "Thích"}
                pressed={isLiked}
                icon={<Heart className={cn("h-5 w-5 md:h-6 md:w-6", isLiked ? "fill-[hsl(var(--error))] text-[hsl(var(--error))]" : "text-white")} strokeWidth={2.5} />}
                label={formatCount((track.likeCount || 0) + (isLiked ? 1 : 0))}
                onClick={handleLikeClick}
              />
              <ActionBtn
                labelText={shared ? "Đã chép liên kết" : "Chia sẻ"}
                icon={shared
                  ? <CheckCheck className="h-5 w-5 text-emerald-400 md:h-6 md:w-6" strokeWidth={2.5} />
                  : <Share2 className="h-5 w-5 text-white md:h-6 md:w-6" strokeWidth={2.5} />}
                label={shared ? "Đã chép" : "Chia sẻ"}
                onClick={(event) => { void handleShare(event); }}
              />
              <ActionBtn
                labelText={lyricsOpen ? "Ẩn lời" : "Hiện lời"}
                pressed={lyricsOpen}
                icon={<Captions className="h-5 w-5 text-white md:h-6 md:w-6" strokeWidth={2.5} />}
                label="Lời"
                onClick={onToggleLyrics}
              />
              <ActionBtn
                labelText="Không quan tâm"
                icon={<Ban className="h-5 w-5 text-white md:h-6 md:w-6" strokeWidth={2.5} />}
                label="Ẩn"
                onClick={onDismiss}
              />
              <ActionBtn
                labelText="Thêm"
                icon={<MoreHorizontal className="h-5 w-5 text-white md:h-6 md:w-6" strokeWidth={2.5} />}
                onClick={() => openTrackSheet(track)}
              />
              {artistSlug && (
                <motion.button
                  type="button"
                  aria-label="Xem nghệ sĩ"
                  whileTap={{ scale: 0.85 }}
                  className="mt-1 h-10 w-10 overflow-hidden rounded-full border-2 border-white/80 shadow-lg md:h-12 md:w-12"
                  onClick={() => navigate(`/artists/${artistSlug}`)}
                >
                  <ImageWithFallback src={artistAvatar || track.coverImage} className="h-full w-full bg-black object-cover" />
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {lyricsOpen && (
          <motion.div
            data-lyrics
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="absolute inset-x-0 bottom-16 top-20 z-20 bg-black/55 backdrop-blur-md"
          >
            <ForMeLyrics track={track} isActive isPlaying={isPlaying} accentColor={accentColor} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-4 left-1/2 z-30 flex w-[min(100%-2rem,36rem)] -translate-x-1/2 items-center gap-3">
        <button
          type="button"
          aria-label="Bài trước"
          onClick={onPrev}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <ForMeProgressBar duration={track.duration || 0} />
        </div>
        <button
          type="button"
          aria-label="Bài sau"
          onClick={onNext}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
