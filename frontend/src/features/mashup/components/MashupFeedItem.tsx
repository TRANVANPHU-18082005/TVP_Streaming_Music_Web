import { IMashup } from "../types";
import { useMashupPlayer } from "../hooks/useMashupPlayer";
import { VideoMoodEngine } from "@/features/player/components/VideoMoodEngine";
import { Play, Heart, Share2, MoreHorizontal, Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { MarqueeText } from "@/features/player/components/MarqueeText";
import { useNavigate } from "react-router-dom";
import { useCallback, useState } from "react";
import { mashupApi } from "../api/mashupApi";

interface MashupFeedItemProps {
  mashup: IMashup;
  isActive: boolean;
}

export const MashupFeedItem = ({ mashup, isActive }: MashupFeedItemProps) => {
  const navigate = useNavigate();
  const { isPlaying, progress, currentIndex, togglePlay } = useMashupPlayer(
    mashup,
    isActive
  );

  const [likeCount, setLikeCount] = useState(mashup.likeCount || 0);
  const [isLiked, setIsLiked] = useState(false); // In real app, check if user liked this
  const [shareCount, setShareCount] = useState(mashup.shareCount || 0);

  const currentShort = mashup.shorts[currentIndex]?.short;

  const handleLike = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // optimistic update
      setIsLiked(prev => !prev);
      setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
      // It's a POST request but we mapped it to toggleLike in service
      await mashupApi.likeMashup(mashup._id); // We need to add this to mashupApi
    } catch (error) {
      console.error("Like failed", error);
    }
  }, [mashup._id, isLiked]);

  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setShareCount(prev => prev + 1);
      await mashupApi.shareMashup(mashup._id); // We need to add this to mashupApi
      if (navigator.share) {
        navigator.share({
          title: mashup.title,
          url: `${window.location.origin}/mashups/${mashup._id}`
        });
      }
    } catch (error) {
      console.error("Share failed", error);
    }
  }, [mashup._id, mashup.title]);

  const handleNavigateDetail = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/mashups/${mashup._id}`);
  }, [navigate, mashup._id]);

  return (
    <div 
      className="relative w-full bg-black snap-start snap-always overflow-hidden" 
      style={{ height: "100%" }}
      onClick={togglePlay}
    >
      
      {/* ── Background Mood Video from current short ─────────────────────── */}
      <div className="absolute inset-0 z-0">
        <VideoMoodEngine
          src={currentShort?.moodVideo?.videoUrl || null}
          isPlaying={isPlaying}
          blur={0}
        />
      </div>

      <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/40 via-transparent to-black/80 pointer-events-none" />

      {/* ── Main Content Area ────────────────────────────────────────────── */}
      <div className="relative z-20 w-full h-full flex flex-col justify-end px-4 pb-6 md:px-8 md:pb-12 pointer-events-none">
        
        {/* Play/Pause Indicator (Center tap feedback) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <AnimatePresence>
            {!isPlaying && isActive && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="w-20 h-20 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center"
              >
                <Play className="w-10 h-10 text-white opacity-80" fill="white" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-end justify-between gap-4 w-full max-w-7xl mx-auto pointer-events-auto">
          
          {/* Info Section (Left) */}
          <div className="flex-1 flex flex-col gap-1 md:gap-2">
            
            {/* Tag & Progress Indicator */}
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1 px-2 py-1 bg-primary/80 backdrop-blur-sm rounded-md text-[10px] font-bold text-white uppercase tracking-wider">
                <Layers className="w-3 h-3" /> Mashup
              </span>
              
              {/* Dot indicators for tracks in mashup */}
              <div className="flex gap-1 ml-2">
                {mashup.shorts.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 rounded-full transition-all duration-300 ${i === currentIndex ? 'w-4 bg-primary' : 'w-1.5 bg-white/30'}`} 
                  />
                ))}
              </div>
            </div>

            {/* Title - Click to go to detail page */}
            <div className="cursor-pointer group" onClick={handleNavigateDetail}>
              <MarqueeText
                text={mashup.title}
                className="text-xl md:text-2xl font-bold text-white drop-shadow-md group-hover:text-primary transition-colors"
                speed={30}
              />
              <p className="text-sm text-white/70 max-w-[280px] drop-shadow-md line-clamp-2 mt-1">
                {mashup.description || `Mashup ${mashup.shorts.length} bài hát`}
              </p>
            </div>
            
            {/* Current Track Info */}
            <div className="mt-2 flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md p-1.5 pr-3 rounded-full w-fit transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/tracks/${currentShort?.track?._id}`) }}>
              <ImageWithFallback src={currentShort?.track?.coverImage} className="w-6 h-6 rounded-full object-cover" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white/90 truncate max-w-[160px] leading-tight">
                  {currentShort?.track?.title}
                </span>
                <span className="text-[10px] text-white/60 truncate max-w-[160px] leading-tight">
                  {currentShort?.track?.artist?.name}
                </span>
              </div>
            </div>
          </div>

          {/* Social Interaction Column (Right) */}
          <div className="flex flex-col items-center gap-6 pb-2">
            {/* Like */}
            <button className="flex flex-col items-center gap-1 group" onClick={handleLike}>
              <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center transition-transform group-active:scale-90">
                <Heart className={`w-6 h-6 ${isLiked ? 'fill-primary text-primary' : 'text-white'}`} />
              </div>
              <span className="text-xs text-white font-medium drop-shadow-md">{likeCount}</span>
            </button>
            
            {/* Share */}
            <button className="flex flex-col items-center gap-1 group" onClick={handleShare}>
              <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center transition-transform group-active:scale-90">
                <Share2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs text-white font-medium drop-shadow-md">{shareCount}</span>
            </button>

            {/* View Detail */}
            <button className="flex flex-col items-center gap-1 group" onClick={handleNavigateDetail}>
              <div className="w-12 h-12 rounded-full bg-primary/20 backdrop-blur-md border border-primary/40 flex items-center justify-center transition-transform group-active:scale-90 relative overflow-hidden">
                <ImageWithFallback src={mashup.coverImage || mashup.shorts[0]?.short?.track?.coverImage} className="absolute inset-0 w-full h-full object-cover opacity-50" />
                <div className="relative z-10 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                  <Play className="w-3 h-3 text-white fill-white ml-0.5" />
                </div>
              </div>
              <span className="text-xs text-white font-medium drop-shadow-md">Full</span>
            </button>
          </div>
        </div>

        {/* ── Global Mashup Progress Bar ─────────────────────────────────── */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
          <div
            className="h-full bg-primary transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

      </div>
    </div>
  );
};
