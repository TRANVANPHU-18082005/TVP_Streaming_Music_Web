import { ITrack } from "@/features/track/types";
import { useDispatch, useSelector } from "react-redux";
import {
  selectPlayer,
  setIsPlaying,
  jumpToIndex,
  nextTrack,
  prevTrack,
} from "@/features/player/slice/playerSlice";
import { Heart, Share2, Play, ChevronUp, ChevronDown, MoreHorizontal, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ForMeProgressBar } from "./ForMeProgressBar";
import { useCallback } from "react";
import { useImageColor } from "@/hooks/useImageColor";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { useContextSheet } from "@/app/provider/SheetProvider";
import { ForMeLyrics } from "./ForMeLyrics";
import { useState } from "react";
import { MarqueeText } from "@/features/player/components/MarqueeText";
import ArtistDisplay from "@/features/artist/components/ArtistDisplay";
import { useNavigate } from "react-router-dom";
import { useInteraction } from "@/features/interaction/hooks/useInteraction";
import { selectIsInteracted } from "@/features/interaction/slice/interactionSlice";

interface FeedItemProps {
  track: ITrack;
  index: number;
  isActive: boolean;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n || 0);
}

interface ActionBtnProps {
  icon: React.ReactNode;
  label?: string;
  active?: boolean;
  activeColor?: string;
  onClick?: (e: React.MouseEvent) => void;
}

const ActionBtn = ({ icon, label, active, activeColor, onClick }: ActionBtnProps) => (
  <motion.button
    type="button"
    whileTap={{ scale: 0.85 }}
    onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
    className="flex flex-col items-center gap-[5px] cursor-pointer outline-none select-none"
  >
    <div
      className={cn(
        "w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center",
        "transition-all duration-200",
        active
          ? cn("scale-105", activeColor ?? "bg-white/25")
          : "bg-black/30 hover:bg-white/20 hover:scale-105 border border-white/10",
      )}
    >
      {icon}
    </div>
    {label && (
      <span className="text-[10px] md:text-xs font-semibold text-white drop-shadow-lg leading-none tracking-wide">
        {label}
      </span>
    )}
  </motion.button>
);

export const FeedItem = ({ track, index, isActive }: FeedItemProps) => {
  const dispatch = useDispatch();
  const { duration, isPlaying, currentTrackId } = useSelector(selectPlayer);
  const { openTrackSheet } = useContextSheet();
  const navigate = useNavigate();
  const isCurrentTrack = currentTrackId === track._id;
  const { color: accentColor } = useImageColor(track.coverImage);

  // --- LIKE LOGIC ---
  const { handleToggle } = useInteraction();
  const isLiked = useSelector((state: any) => selectIsInteracted(state, track._id, "track"));
  const isPending = useSelector((state: any) => state.interaction.loadingIds[`track:${track._id}`]);

  const handleLikeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPending) return;
    handleToggle(track._id, "track");
  }, [handleToggle, track._id, isPending]);

  // --- SHARE LOGIC ---
  const [shared, setShared] = useState(false);
  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/tracks/${track._id || track.slug}`;
    const title = track.title;
    const text = `Nghe "${title}" trên TVP Music`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // ignore
    }
  }, [track]);

  const togglePlay = useCallback(() => {
    if (!isCurrentTrack) {
      dispatch(jumpToIndex(index));
    } else {
      dispatch(setIsPlaying(!isPlaying));
    }
  }, [isCurrentTrack, dispatch, index, isPlaying]);

  const handlePrev = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const el = (e.currentTarget as HTMLElement).closest(".snap-start");
      if (el?.previousElementSibling) {
        el.previousElementSibling.scrollIntoView({ behavior: "smooth" });
      }
    },
    [],
  );

  const handleNext = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const el = (e.currentTarget as HTMLElement).closest(".snap-start");
      if (el?.nextElementSibling) {
        el.nextElementSibling.scrollIntoView({ behavior: "smooth" });
      }
    },
    [],
  );


  const artistAvatar = typeof track.artist === "object" ? track.artist?.avatar : undefined;

  return (
    <div
      className="
        relative w-full h-screen
        bg-black snap-start snap-always overflow-hidden
      "
    >
      {/* ── Background Blurred Image ── */}
      <div
        className="absolute inset-0 z-0 scale-110"
        style={{
          backgroundImage: `url(${track.coverImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(40px) brightness(0.35) saturate(1.2)",
        }}
      />



      {/* ── Layout Container (Pointer events auto to allow scrolling/clicking on inner elements) ── */}
      <div className="relative z-30 w-full h-full pointer-events-none flex items-center justify-center">

        <div className="w-full max-w-7xl px-2 md:px-8 py-4 md:py-12 flex flex-col md:flex-row items-center md:items-stretch justify-center gap-6 md:gap-16 h-full">

          {/* LEFT COLUMN / TOP MOBILE: Metadata, Cover, Actions */}
          <div className="flex flex-col items-center justify-center md:justify-center shrink-0 mt-10 md:mt-0">

            {/* Title & Artist */}
            <div className="text-center mb-6 md:mb-8 w-[300px] sm:w-full lg:w-full justify-center align-center pointer-events-auto cursor-pointer" >
              <MarqueeText
                text={track.title}
                className="text-2xl md:text-3xl font-bold text-white truncate leading-tight tracking-tight"
                speed={38}
                pauseMs={1600}
              />
              <ArtistDisplay
                mainArtist={track.artist}
                featuringArtists={track.featuringArtists}
                className="text-md justify-center align-center md:text-lg flex gap-1 items-center text-white/80 mt-1"
              />
            </div>

            {/* Cover Image & Action Bar Wrapper */}
            <div className="flex justify-center items-center gap-10 md:gap-4 relative">

              {/* Cover Image (Square, glowing) */}
              <motion.div
                animate={isPlaying ? { scale: 1 } : { scale: 0.96 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="relative pointer-events-auto cursor-pointer"
                onClick={(e) => { e.stopPropagation(); togglePlay(); }} // Allow play/pause on cover tap too
              >
                {/* Glow effect */}
                <div className="absolute inset-0 scale-105 rounded-xl md:rounded-2xl bg-white/10 blur-xl md:blur-2xl opacity-60" />

                <div className="flex justify-center items-center relative w-[200px] h-[200px] sm:w-[250px] sm:h-[250px] md:w-[300px] md:h-[300px] lg:w-[350px] lg:h-[350px] rounded-xl md:rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/20">
                  <ImageWithFallback src={track.coverImage} className="w-full h-full object-cover" />

                  {/* Play/Pause tap feedback overlay INSIDE cover */}
                  <AnimatePresence>
                    {!isPlaying && isCurrentTrack && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        transition={{ duration: 0.16, type: "spring", stiffness: 500, damping: 28 }}
                        className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none bg-black/30"
                      >
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-xl">
                          <Play fill="white" className="w-8 h-8 md:w-10 md:h-10 text-white ml-1.5" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Vertical Action Bar */}
              <div className="flex flex-col gap-2 md:gap-4 pb-2 pointer-events-auto">
                <ActionBtn
                  icon={<Heart className={cn("w-4 h-4 md:w-6 md:h-6 transition-colors", isLiked ? "fill-[hsl(var(--error))] text-[hsl(var(--error))]" : "text-white")} strokeWidth={2.5} />}
                  label={formatCount((track.likeCount || 0) + (isLiked ? 1 : 0))}
                  onClick={handleLikeClick}
                />
                <ActionBtn
                  icon={shared ? <CheckCheck className="w-4 h-4 md:w-6 md:h-6 text-emerald-500" strokeWidth={2.5} /> : <Share2 className="w-4 h-4 md:w-6 md:h-6 text-white" strokeWidth={2.5} />}
                  label={formatCount(0)}
                  onClick={handleShare}
                />
                <ActionBtn
                  icon={<MoreHorizontal className="w-4 h-4 md:w-6 md:h-6 text-white" strokeWidth={2.5} />}
                  onClick={(e) => {
                    e?.stopPropagation();
                    openTrackSheet(track);
                  }}
                />
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-white/80 shadow-lg mt-1"
                  onClick={(e) => { e.stopPropagation(); navigate(`/artists/${track.artist.slug}`); }}
                >
                  <ImageWithFallback src={artistAvatar || track.coverImage} className="w-full h-full object-cover bg-black" />
                </motion.button>
              </div>

            </div>

          </div>

          {/* RIGHT COLUMN / BOTTOM MOBILE: Lyrics View */}
          <div className="flex-1 w-full md:max-w-lg lg:max-w-xl flex flex-col justify-center h-[35vh] md:h-full relative overflow-hidden pb-10 md:pb-0 pointer-events-none mt-2 md:mt-0">
            <div className="relative z-10 w-full h-full">
              <ForMeLyrics track={track} isActive={isActive} isPlaying={isPlaying} accentColor={accentColor} />
            </div>
          </div>

        </div>

      </div>

      {/* ── Desktop Right Edge Navigation ── */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex-col gap-4 hidden md:flex z-30 pointer-events-auto">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handlePrev}
          className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/80 hover:text-white shadow-xl"
        >
          <ChevronUp className="w-6 h-6" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleNext}
          className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/80 hover:text-white shadow-xl"
        >
          <ChevronDown className="w-6 h-6" />
        </motion.button>
      </div>
    </div>
  );
};