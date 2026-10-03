import type { MouseEvent, ReactNode } from "react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ban, Captions, CheckCheck, Heart, MoreHorizontal, Play, Share2, SkipBack, SkipForward, Coffee, Minimize2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ForMeProgressBar } from "./ForMeProgressBar";
import { ForMeLyrics } from "./ForMeLyrics";
import { ForMeSheet } from "./ForMeSheet";
import { useImageColor } from "@/hooks/useImageColor";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { MarqueeText } from "@/features/player/components/MarqueeText";
import ArtistDisplay from "@/features/artist/components/ArtistDisplay";
import { useInteraction } from "@/features/interaction/hooks/useInteraction";
import { selectIsInteracted } from "@/features/interaction/slice/interactionSlice";
import { useAppSelector } from "@/store/hooks";
import type { ITrack } from "@/features/track/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FeedItemProps {
  track: ITrack;
  isPlaying: boolean;
  lyricsOpen: boolean;
  onTogglePlay: () => void;
  onToggleLyrics: () => void;
  onPrev: () => void;
  onNext: () => void;
  onDismiss: () => void;
  trackIds: string[];
  onAppend: (tracks: ITrack[]) => void;
  relaxMode: boolean;
  controlsVisible: boolean;
  onToggleRelaxMode: () => void;
  onToggleControls: () => void;
}

export const FeedItem = ({
  track,
  isPlaying,
  lyricsOpen,
  onTogglePlay,
  onToggleLyrics,
  onPrev,
  onNext,
  onDismiss,
  trackIds,
  onAppend,
  relaxMode,
  controlsVisible,
  onToggleRelaxMode,
  onToggleControls,
}: FeedItemProps) => {
  const navigate = useNavigate();
  const { color: accentColor } = useImageColor(track.coverImage);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const artistSlug = typeof track.artist === "object" ? track.artist?.slug : undefined;
  const artistAvatar = typeof track.artist === "object" ? track.artist?.avatar : undefined;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black flex flex-col">
      {/* BACKGROUND */}
      <div
        className="absolute inset-0 z-0 scale-110 opacity-60"
        style={{
          backgroundImage: `url(${track.coverImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(60px) saturate(1.5)",
        }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/40 via-black/20 to-black/95" />

      {/* FULL SCREEN LYRICS (z-40) */}
      <AnimatePresence>
        {lyricsOpen && (
          <motion.div
            data-lyrics
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-black/70 backdrop-blur-2xl pointer-events-auto"
            onClick={onToggleControls}
          >
            <ForMeLyrics track={track} isActive isPlaying={isPlaying} accentColor={accentColor} />

            <AnimatePresence>
              {controlsVisible && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLyrics();
                  }}
                  className="absolute right-4 top-[72px] z-50 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 shadow-lg md:right-8"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>



      {/* RELAX MODE EXIT BUTTON */}
      <AnimatePresence>
        {relaxMode && !lyricsOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={onToggleRelaxMode}
            className="absolute right-4 md:right-8 top-[72px] z-50 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 shadow-lg pointer-events-auto"
            aria-label="Thoát thư giãn"
          >
            <Minimize2 className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* FOREGROUND CONTENT */}
      <div className={cn("relative z-10 flex flex-1 flex-col px-4 pt-[110px] pb-6 md:px-12 md:pb-10 pointer-events-none w-full h-full transition-opacity duration-300",
        (lyricsOpen && !controlsVisible) ? "opacity-0" : "opacity-100"
      )}>

        {/* CENTER: COVER IMAGE & RELAX INFO */}
        <div className={cn("flex flex-1 items-center pointer-events-auto", relaxMode ? "flex-col justify-start pt-8 md:pt-16 gap-6" : "justify-center")}>
          <motion.button
            type="button"
            aria-label={isPlaying ? "Tạm dừng" : "Phát"}
            animate={isPlaying ? { scale: 1 } : { scale: 0.95 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="group relative cursor-pointer outline-none"
            onClick={onTogglePlay}
          >
            <div className="absolute inset-0 scale-105 rounded-2xl bg-white/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-40" />
            <motion.div
              layout
              transition={{ type: "spring", bounce: 0.15, duration: 0.6 }}
              className={cn("relative overflow-hidden shadow-2xl",
                 relaxMode 
                   ? "h-40 w-40 sm:h-48 sm:w-48 rounded-full ring-1 ring-white/10" 
                   : "h-[260px] w-[260px] sm:h-[320px] sm:w-[320px] lg:h-[420px] lg:w-[420px] rounded-2xl ring-1 ring-white/20"
              )}
            >
              <ImageWithFallback src={track.coverImage} className={cn("h-full w-full object-cover transition-transform duration-1000", relaxMode && isPlaying ? "animate-[spin_10s_linear_infinite]" : "")} />
              <AnimatePresence>
                {!isPlaying && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
                  >
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-md shadow-lg">
                      <Play fill="white" className="ml-1.5 h-10 w-10 text-white" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.button>

          {/* RELAX MODE INFO */}
          <AnimatePresence>
            {relaxMode && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="flex flex-col items-center text-center px-4 w-full max-w-[500px]">
                <div className="w-full overflow-hidden">
                  <MarqueeText
                    text={track.title}
                    className="text-2xl font-bold text-white md:text-3xl w-full text-center"
                    speed={30}
                    pauseMs={1600}
                  />
                </div>
                <ArtistDisplay mainArtist={track.artist} featuringArtists={track.featuringArtists} className="mt-1 text-base font-medium text-white/70" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* RELAX MODE LYRICS */}
          <AnimatePresence>
            {relaxMode && !lyricsOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full flex-1 relative pointer-events-none mt-2 pb-6">
                <ForMeLyrics track={track} isActive isPlaying={isPlaying} accentColor={accentColor} mini />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* BOTTOM SECTION (Info + Progress) */}
        {!relaxMode && (
          <div className="relative mx-auto mt-6 flex w-full max-w-[500px] lg:max-w-[700px] flex-col gap-6 md:gap-8 pointer-events-none">

          {/* Metadata & Actions */}
          <div className="flex items-end justify-between gap-4">
            {/* LEFT: Track Info (z-10, will be covered by lyrics) */}
            <div className="relative z-10 flex min-w-0 flex-1 flex-col items-start overflow-hidden pointer-events-auto">
              {track.reason && (
                <span className="mb-2 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/90 backdrop-blur-md shadow-sm">
                  {track.reason}
                </span>
              )}
              <div className="w-full">
                <MarqueeText
                  text={track.title}
                  className="text-2xl font-bold tracking-tight text-white md:text-3xl lg:text-4xl"
                  speed={38}
                  pauseMs={1600}
                />
              </div>
              <div className="mt-1 flex items-center gap-3 w-full">
                {artistAvatar && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/artists/${artistSlug}`);
                    }}
                    className="shrink-0 overflow-hidden rounded-full border border-white/20 shadow-sm transition-transform active:scale-95"
                  >
                    <ImageWithFallback src={artistAvatar} className="h-6 w-6 object-cover" />
                  </button>
                )}
                <ArtistDisplay
                  mainArtist={track.artist}
                  featuringArtists={track.featuringArtists}
                  className="truncate text-base font-medium text-white/70 hover:text-white md:text-lg"
                />
              </div>
            </div>

            {/* RIGHT: Actions (z-30) */}
            {!relaxMode && (
              <div className="relative z-50 flex shrink-0 items-center gap-2 md:gap-3 pointer-events-auto">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsSheetOpen(true);
                        }}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/80 backdrop-blur-sm transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-90 md:h-12 md:w-12 pointer-events-auto"
                      >
                        <MoreHorizontal className="h-5 w-5 md:h-6 md:w-6" strokeWidth={2.5} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-black/90 text-white border-white/10 rounded-lg text-xs font-medium">
                      <p>Thêm</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>

          {/* Progress Bar & Prev/Next (z-30) */}
          {!relaxMode && (
            <div className="relative z-50 flex items-center gap-4 pointer-events-auto w-full">
              <button onClick={onPrev} className="text-white/60 transition-colors hover:text-white active:scale-95">
                <SkipBack className="h-6 w-6 fill-current" />
              </button>
              <div className="flex-1">
                <ForMeProgressBar duration={track.duration || 0} />
              </div>
              <button onClick={onNext} className="text-white/60 transition-colors hover:text-white active:scale-95">
                <SkipForward className="h-6 w-6 fill-current" />
              </button>
            </div>
          )}

          </div>
        )}
      </div>

      <ForMeSheet
        track={track}
        trackIds={trackIds}
        onAppend={onAppend}
        onDismiss={onDismiss}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onToggleRelaxMode={onToggleRelaxMode}
        onToggleLyrics={onToggleLyrics}
        lyricsOpen={lyricsOpen}
        relaxMode={relaxMode}
      />
    </div>
  );
};
