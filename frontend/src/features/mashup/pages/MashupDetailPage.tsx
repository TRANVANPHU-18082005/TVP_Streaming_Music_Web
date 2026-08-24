import { useParams, useNavigate } from "react-router-dom";
import { useMashupDetail } from "../hooks/useMashups";
import { ForMeHeader } from "@/features/for-me/components/ForMeHeader";
import { Play, Pause, Music2, Share2, Heart, Info, ArrowLeft, Disc3, Settings2 } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { useMashupPlayer } from "../hooks/useMashupPlayer";
import { PremiumMusicVisualizer } from "@/components/MusicVisualizer";
import { useState, useCallback, useEffect } from "react";
import { mashupApi } from "../api/mashupApi";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import { setIsPlaying, selectPlayer } from "@/features/player/slice/playerSlice";

export const MashupDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const player = useSelector(selectPlayer);

  useEffect(() => {
    if (player.isPlaying) dispatch(setIsPlaying(false));
  }, [dispatch, player.isPlaying]);

  const { data, isLoading, isError } = useMashupDetail(id || "");
  const mashup = data?.data;

  // The second argument 'false' is the initial 'shouldPlay' state.
  // Wait, useMashupPlayer expects (mashup, shouldPlay)
  // Actually, useMashupPlayer uses shouldPlay as a prop to sync external play state.
  // We can just pass a local state.
  const [shouldPlay, setShouldPlay] = useState(false);
  const { isPlaying, progress, currentIndex, togglePlay, skipTo } = useMashupPlayer(mashup || null, shouldPlay);

  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [shareCount, setShareCount] = useState(0);

  useEffect(() => {
    if (mashup) {
      setLikeCount(mashup.likeCount || 0);
      setShareCount(mashup.shareCount || 0);
    }
  }, [mashup]);

  // Sync internal player state to our shouldPlay state if it was toggled from within the hook
  useEffect(() => {
    setShouldPlay(isPlaying);
  }, [isPlaying]);

  const handleTogglePlay = useCallback(() => {
    setShouldPlay(prev => !prev);
    // togglePlay() is also returned, but changing shouldPlay is cleaner to trigger the effect in the hook
  }, []);

  const handleLike = useCallback(async () => {
    if (!mashup) return;
    try {
      setIsLiked(prev => !prev);
      setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
      await mashupApi.likeMashup(mashup._id);
    } catch (error) {
      console.error("Like failed", error);
    }
  }, [mashup, isLiked]);

  const handleShare = useCallback(async () => {
    if (!mashup) return;
    try {
      setShareCount(prev => prev + 1);
      await mashupApi.shareMashup(mashup._id);
      if (navigator.share) {
        navigator.share({
          title: mashup.title,
          url: window.location.href
        });
      } else {
        navigator.clipboard.writeText(window.location.href);
        toast.success("Đã copy link");
      }
    } catch (error) {
      console.error("Share failed", error);
    }
  }, [mashup]);

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center">
        <PremiumMusicVisualizer active={true} />
        <p className="text-white/60 mt-4 font-display">Đang tải chi tiết Mashup...</p>
      </div>
    );
  }

  if (isError || !mashup) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center">
        <Music2 className="w-16 h-16 text-white/20 mb-4" />
        <p className="text-white/60 font-display">Không tìm thấy Mashup.</p>
        <button onClick={() => navigate("/mashups/feed")} className="mt-4 px-6 py-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
          Quay lại Feed
        </button>
      </div>
    );
  }

  const currentShort = mashup.shorts[currentIndex]?.short;
  const coverUrl = mashup.coverImage || mashup.shorts[0]?.short?.track?.coverImage;

  const totalDurationStr = `${Math.floor(mashup.totalDuration / 60)}:${String(mashup.totalDuration % 60).padStart(2, '0')}`;

  return (
    <div className="w-full min-h-screen bg-neutral-950 text-white pb-32 overflow-x-hidden relative">
      <ForMeHeader />
      
      {/* Background Ambient Blur */}
      <div className="absolute top-0 left-0 right-0 h-[500px] opacity-30 pointer-events-none overflow-hidden">
        <ImageWithFallback src={coverUrl} className="w-full h-full object-cover blur-[100px] saturate-200 transform scale-150" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neutral-950/80 to-neutral-950" />
      </div>

      <div className="max-w-5xl mx-auto pt-24 px-6 relative z-10">
        
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/60 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Quay lại</span>
        </button>

        <div className="flex flex-col md:flex-row gap-8 items-start lg:items-end">
          
          {/* Cover Art */}
          <div className="w-full md:w-64 lg:w-72 aspect-square relative rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] group shrink-0">
            <ImageWithFallback 
              src={coverUrl} 
              className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-105' : 'scale-100 group-hover:scale-105'}`} 
            />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
            
            {/* Play Button Overlay */}
            <button 
              onClick={handleTogglePlay}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className={`w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center backdrop-blur-md shadow-xl transition-all duration-300 ${isPlaying ? 'scale-100 opacity-100' : 'scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100'}`}>
                {isPlaying ? <Pause className="w-7 h-7 text-white" /> : <Play className="w-7 h-7 text-white ml-1" fill="white" />}
              </div>
            </button>

            {isPlaying && (
              <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-md p-2 rounded-lg pointer-events-none">
                 <PremiumMusicVisualizer active={true} />
              </div>
            )}
          </div>
          
          {/* Info */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 bg-primary/20 text-primary border border-primary/30 rounded-md text-xs font-bold uppercase tracking-wider">
                Mashup
              </span>
              <span className="text-sm text-white/50 font-medium">{mashup.shorts.length} tracks • {totalDurationStr}</span>
              {mashup.status === 'draft' && (
                <span className="px-2.5 py-1 bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 rounded-md text-xs font-bold uppercase tracking-wider">
                  Bản nháp
                </span>
              )}
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black font-display tracking-tight leading-tight">
              {mashup.title}
            </h1>
            
            {mashup.description && (
              <p className="text-white/70 text-base lg:text-lg leading-relaxed max-w-2xl">
                {mashup.description}
              </p>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-2 pt-2">
              {mashup.dominantMoods.map(mood => (
                <span key={mood} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-sm font-medium hover:bg-white/10 transition-colors cursor-pointer">
                  #{mood}
                </span>
              ))}
            </div>
            
            <div className="flex items-center gap-6 pt-4 text-white/60">
              <div className="flex items-center gap-2">
                <ImageWithFallback src={mashup.createdBy?.avatar} className="w-8 h-8 rounded-full" />
                <span className="text-sm font-medium text-white/80">{mashup.createdBy?.name || "Unknown Author"}</span>
              </div>
              <div className="w-1 h-1 bg-white/20 rounded-full" />
              <div className="flex items-center gap-2" title="Compatibility Score">
                <Info className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-medium text-sm">{mashup.compatibilityScore}% Match</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button 
                onClick={handleTogglePlay}
                className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-full font-bold text-sm flex items-center gap-2 transition-transform active:scale-95"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                {isPlaying ? 'Tạm Dừng' : 'Phát Toàn Bộ'}
              </button>
              
              <button onClick={handleLike} className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all ${isLiked ? 'border-primary bg-primary/10 text-primary' : 'border-white/20 hover:border-white/40 hover:bg-white/5 text-white'}`}>
                <Heart className={`w-5 h-5 ${isLiked ? 'fill-primary' : ''}`} />
              </button>
              
              <button onClick={handleShare} className="w-12 h-12 rounded-full border border-white/20 hover:border-white/40 hover:bg-white/5 text-white flex items-center justify-center transition-all">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Timeline Flow */}
        <div className="mt-16 max-w-3xl">
          <h2 className="text-xl font-bold font-display mb-8 flex items-center gap-2">
            <Disc3 className="w-6 h-6 text-primary" />
            Mashup Timeline
          </h2>
          
          <div className="relative space-y-2">
            {/* Timeline Line */}
            <div className="absolute left-6 top-6 bottom-6 w-px bg-white/10" />

            {mashup.shorts.map((item, index) => {
              const isItemActive = index === currentIndex;
              return (
                <div 
                  key={index} 
                  className="relative flex items-center gap-6 group cursor-pointer"
                  onClick={() => skipTo(index)}
                >
                  {/* Node */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center relative z-10 transition-colors duration-300 ${isItemActive ? 'bg-primary text-white shadow-[0_0_15px_rgba(var(--primary),0.5)]' : 'bg-neutral-900 border border-white/10 text-white/50 group-hover:bg-neutral-800'}`}>
                    {isItemActive && isPlaying ? (
                      <div className="w-4 h-4 bg-white rounded-sm animate-pulse" />
                    ) : (
                      <span className="font-bold text-sm">{index + 1}</span>
                    )}
                  </div>
                  
                  {/* Content Card */}
                  <div className={`flex-1 flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all duration-300 ${isItemActive ? 'bg-primary/5 border-primary/40' : 'bg-white/5 border-white/5 group-hover:bg-white/10'}`}>
                    <div className="flex items-center gap-4">
                      <ImageWithFallback src={item.short.track.coverImage} className="w-12 h-12 rounded-lg object-cover shadow-sm" />
                      <div>
                        <h3 className={`font-bold text-base line-clamp-1 transition-colors ${isItemActive ? 'text-primary' : 'text-white/90'}`}>
                          {item.short.track.title}
                        </h3>
                        <p className="text-sm text-white/60 line-clamp-1">
                          {item.short.track.artist?.name}
                        </p>
                      </div>
                    </div>

                    {/* Transition Info */}
                    {index < mashup.shorts.length - 1 && (
                      <div className="hidden sm:flex items-center gap-2 text-xs text-white/40 mt-3 sm:mt-0 bg-black/40 px-3 py-1.5 rounded-full">
                        <Settings2 className="w-3 h-3" />
                        <span>{item.transitionType} ({item.transitionDuration / 1000}s)</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* ── Global Bottom Player Bar ──────────────────────────────────────── */}
      <div className={`fixed bottom-0 left-0 right-0 bg-neutral-950/90 backdrop-blur-xl border-t border-white/10 px-4 md:px-8 h-20 flex items-center justify-between z-50 transition-transform duration-500 ${isPlaying || progress > 0 ? 'translate-y-0' : 'translate-y-full'}`}>
        
        {/* Progress Bar (Absolute top) */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 cursor-pointer">
          <div className="h-full bg-primary transition-all duration-75 ease-linear" style={{ width: `${progress}%` }} />
        </div>

        {/* Current Track Info */}
        <div className="flex items-center gap-3 w-1/3 min-w-0">
          <ImageWithFallback src={currentShort?.track?.coverImage} className="w-12 h-12 rounded object-cover" />
          <div className="min-w-0 hidden sm:block">
            <h4 className="text-sm font-bold text-white truncate">{currentShort?.track?.title}</h4>
            <p className="text-xs text-white/60 truncate">{currentShort?.track?.artist?.name}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex-1 flex justify-center">
           <button 
             onClick={handleTogglePlay}
             className="w-12 h-12 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg"
           >
             {isPlaying ? <Pause className="w-5 h-5 text-black" /> : <Play className="w-5 h-5 text-black ml-1" fill="black" />}
           </button>
        </div>

        {/* Right empty space for balance */}
        <div className="w-1/3 flex justify-end">
           {/* Add volume control later if needed */}
        </div>

      </div>

    </div>
  );
};
