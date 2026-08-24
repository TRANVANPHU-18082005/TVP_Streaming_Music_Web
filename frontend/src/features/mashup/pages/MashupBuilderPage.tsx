import { useState, useRef, useEffect } from "react";
import { useMashupBuilder } from "../hooks/useMashupBuilder";
import { useCreateMashup, useSuggestShorts } from "../hooks/useMashups";
import { useShorts } from "@/features/shorts/hooks/useShorts";
import { useMashupPreview } from "../hooks/useMashupPreview";
import { Plus, GripVertical, Play, Pause, X, Music, Sparkles, Search, Layers, Loader2, Settings2, Disc3, Square, Save, Upload, Activity } from "lucide-react";
import { ITrackShort } from "@/features/shorts/types";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";

// dnd-kit imports
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Extracted Sortable Item Component
const SortableTimelineItem = ({ 
  item, 
  index, 
  isPlaying, 
  isCurrentlyPreviewing, 
  isSettingsOpen, 
  setActiveSettingsIndex, 
  handlePlayShort, 
  removeShort, 
  updateTransition, 
  stopPreview 
}: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.short._id }); // Using short._id as unique ID for sorting

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`flex flex-col border rounded-xl shadow-sm transition-all overflow-hidden group relative ${isCurrentlyPreviewing ? 'bg-primary/5 border-primary shadow-[0_0_15px_rgba(var(--primary),0.2)]' : 'bg-surface-2/40 border-border/30 hover:border-primary/30'} ${isDragging ? 'shadow-2xl border-primary scale-[1.02]' : ''}`}>
      <div className="flex items-center gap-4 p-3">
        {/* Drag Handle */}
        <div {...attributes} {...listeners} className="cursor-grab p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing touch-none">
          <GripVertical className="w-5 h-5" />
        </div>
        
        <div className="relative w-12 h-12 rounded-lg overflow-hidden shadow-sm shrink-0">
          <ImageWithFallback src={item.short.track?.coverImage} className="w-full h-full object-cover" />
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if(isCurrentlyPreviewing) stopPreview();
              handlePlayShort(e, item.short);
            }}
            className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${(isPlaying || isCurrentlyPreviewing) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          >
            {(isPlaying || isCurrentlyPreviewing) ? (
              isCurrentlyPreviewing ? <Disc3 className="w-5 h-5 text-white animate-spin-slow" /> : <Pause className="w-5 h-5 text-white" />
            ) : <Play className="w-5 h-5 text-white ml-0.5" />}
          </button>
        </div>
        
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm truncate ${(isPlaying || isCurrentlyPreviewing) ? 'text-primary' : ''}`}>{item.short.track?.title}</p>
          <p className="text-xs text-muted-foreground truncate">{item.short.track?.artist?.name}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveSettingsIndex(isSettingsOpen ? null : index)}
            className={`p-1.5 rounded-lg transition-colors ${isSettingsOpen ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-surface-3/50'}`}
            title="Cấu hình chuyển cảnh"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => removeShort(index)} 
            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            title="Xóa"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Advanced Transition Settings Panel */}
      {isSettingsOpen && (
        <div className="bg-background/80 p-4 border-t border-border/30 flex items-center gap-6 animate-in slide-in-from-top-2">
           <div className="flex flex-col gap-1.5">
             <label className="text-xs text-muted-foreground font-medium">Hiệu ứng vào</label>
             <select 
                className="bg-surface-2/50 text-xs py-1.5 px-3 rounded-lg outline-none border border-border/50 focus:border-primary/50 text-foreground cursor-pointer"
                value={item.transitionType}
                onChange={(e) => updateTransition(index, e.target.value as any, item.transitionDuration)}
              >
                <option value="crossfade">Crossfade</option>
                <option value="cut">Hard Cut</option>
                <option value="beatmatch">Beat Match</option>
              </select>
           </div>
           
           {item.transitionType !== 'cut' && (
             <div className="flex-1 flex flex-col gap-1.5">
               <div className="flex justify-between items-center">
                 <label className="text-xs text-muted-foreground font-medium">Thời lượng (ms)</label>
                 <span className="text-xs font-mono text-primary">{item.transitionDuration}ms</span>
               </div>
               <input 
                 type="range" 
                 min="500" 
                 max="5000" 
                 step="100"
                 value={item.transitionDuration}
                 onChange={(e) => updateTransition(index, item.transitionType, parseInt(e.target.value))}
                 className="w-full accent-primary h-1.5 bg-border rounded-lg appearance-none cursor-pointer"
               />
               <div className="flex justify-between text-[10px] text-muted-foreground/60">
                 <span>0.5s</span>
                 <span>5.0s</span>
               </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
};


export const MashupBuilderPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { shorts, title, setTitle, description, setDescription, removeShort, reorderShorts, addShort, updateTransition, setShorts } = useMashupBuilder();
  const createMashup = useCreateMashup();
  const suggestShorts = useSuggestShorts();
  
  const [suggestions, setSuggestions] = useState<ITrackShort[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(true);
  
  // Audio Playback State for single short
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingShortId, setPlayingShortId] = useState<string | null>(null);
  
  // Full Mashup Preview State
  const { isPlaying: isPreviewing, currentIndex: previewIndex, togglePlay: togglePreview, stop: stopPreview } = useMashupPreview(shorts);

  const [activeSettingsIndex, setActiveSettingsIndex] = useState<number | null>(null);
  const [hasInitializedAi, setHasInitializedAi] = useState(false);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Auto-dismiss onboarding if user has items
  useEffect(() => {
    if (shorts.length > 0) setShowOnboarding(false);
  }, [shorts.length]);

  useEffect(() => {
    if (!hasInitializedAi && location.state?.aiGeneratedShorts) {
      const aiShorts = location.state.aiGeneratedShorts;
      const initialShorts = aiShorts.map((short: ITrackShort, i: number) => ({
        short, order: i, transitionType: 'crossfade' as const, transitionDuration: 2000
      }));
      setShorts(initialShorts);
      setHasInitializedAi(true);
      toast.success("AI đã tạo xong! Nhấn Play để nghe thử bản Mashup này.");
    }
  }, [location.state, hasInitializedAi, setShorts]);

  const { data: shortsData, isLoading: isLoadingShorts } = useShorts({ limit: 50, search: searchQuery });
  const availableShorts = shortsData?.data?.data || [];
  
  useEffect(() => {
    if (shorts.length === 0) {
      setSuggestions([]);
      return;
    }
    const timeoutId = setTimeout(async () => {
      try {
        const res = await suggestShorts.mutateAsync(shorts.map(s => s.short._id));
        if (res.success) setSuggestions(res.data);
      } catch (err) {}
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [shorts]);

  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
      stopPreview();
    };
  }, [stopPreview]);

  const handlePlayShort = (e: React.MouseEvent, short: ITrackShort) => {
    e.stopPropagation();
    if (isPreviewing) stopPreview();
    if (playingShortId === short._id) {
      if (audioRef.current) audioRef.current.pause();
      setPlayingShortId(null);
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    audio.pause();
    audio.src = short.track?.trackUrl || "";
    
    const startSec = (short.startTime > 10000) ? short.startTime / 1000 : short.startTime;
    const endSec = (short.endTime > 10000) ? short.endTime / 1000 : short.endTime;
    audio.currentTime = startSec || 0;
    
    audio.ontimeupdate = () => { if (endSec && audio.currentTime >= endSec) { audio.pause(); setPlayingShortId(null); } };
    audio.onended = () => setPlayingShortId(null);
    audio.play().then(() => setPlayingShortId(short._id)).catch(() => { toast.error("Lỗi phát audio"); setPlayingShortId(null); });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = shorts.findIndex((s) => s.short._id === active.id);
      const newIndex = shorts.findIndex((s) => s.short._id === over.id);
      reorderShorts(oldIndex, newIndex);
    }
  };

  const handleSave = async (isPublished: boolean) => {
    if (!title) return toast.error("Vui lòng nhập tiêu đề Mashup");
    if (shorts.length < 2) return toast.error("Mashup cần ít nhất 2 shorts");
    
    try {
      await createMashup.mutateAsync({
        title, description, isPublished,
        shorts: shorts.map(s => ({
          short: s.short._id, order: s.order,
          transitionType: s.transitionType, transitionDuration: s.transitionDuration
        }))
      });
      toast.success(isPublished ? "Đã đăng Mashup!" : "Đã lưu bản nháp!");
      navigate("/mashups/feed");
    } catch (err) {
      toast.error("Lỗi khi lưu Mashup");
    }
  };

  return (
    <div className="relative w-full h-full p-4 lg:p-6 text-foreground overflow-y-auto bg-background/50 custom-scrollbar pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold font-display tracking-tight flex items-center gap-3">
          <Layers className="w-8 h-8 text-primary" /> Tạo Mashup Mới
        </h1>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => handleSave(false)}
            disabled={createMashup.isPending || shorts.length < 2}
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 hover:bg-surface-2/50 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> Lưu Bản Nháp
          </button>
          <button 
            onClick={() => handleSave(true)}
            disabled={createMashup.isPending || shorts.length < 2}
            className="flex items-center gap-2 px-6 py-2 rounded-full bg-primary text-primary-foreground font-bold hover:brightness-110 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
          >
            <Upload className="w-4 h-4" /> Đăng Lên
          </button>
        </div>
      </div>
      
      {/* Onboarding Banner */}
      {showOnboarding && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-primary/20 via-background to-background border border-primary/20 flex items-start gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 opacity-10 blur-[50px] bg-primary w-64 h-64 rounded-full" />
          <div className="p-3 bg-primary/20 rounded-xl text-primary"><Disc3 className="w-6 h-6" /></div>
          <div className="flex-1">
            <h3 className="font-bold font-display text-lg">Chào mừng đến với Mashup Builder!</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">Tạo bản mix của riêng bạn bằng cách chọn các đoạn shorts từ thư viện, kéo thả để sắp xếp, điều chỉnh hiệu ứng chuyển cảnh và để AI gợi ý bài hát tiếp theo phù hợp nhất.</p>
          </div>
          <button onClick={() => setShowOnboarding(false)} className="p-2 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-[calc(100vh-200px)]">
        
        {/* LEFT PANEL: Kho Shorts (Library) */}
        <div className="xl:col-span-3 flex flex-col bg-surface-1/60 backdrop-blur-xl border border-border/40 rounded-2xl overflow-hidden shadow-sm max-h-[700px]">
          <div className="p-4 border-b border-border/40 bg-surface-2/30">
            <h2 className="text-lg font-semibold font-display mb-3">Kho Shorts</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" placeholder="Tìm kiếm..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-background/50 border border-border/50 text-sm rounded-lg pl-9 pr-4 py-2 outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {isLoadingShorts ? (
              <div className="flex justify-center h-32 items-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : availableShorts.map((short: ITrackShort) => {
                const isPlaying = playingShortId === short._id;
                return (
                  <div key={short._id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-2/50 transition-colors group cursor-pointer" onClick={() => addShort(short)}>
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 shadow-sm">
                      <ImageWithFallback src={short.track?.coverImage} className="w-full h-full object-cover" />
                      <button onClick={(e) => handlePlayShort(e, short)} className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
                      </button>
                      <div className="absolute -top-1 -right-1 bg-primary text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity scale-75"><Plus className="w-4 h-4" /></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm truncate ${isPlaying ? 'text-primary' : ''}`}>{short.track?.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{short.track?.artist?.name}</p>
                    </div>
                  </div>
                );
            })}
          </div>
        </div>

        {/* CENTER PANEL: Timeline Editor */}
        <div className="xl:col-span-6 flex flex-col bg-surface-1/60 backdrop-blur-xl border border-border/40 rounded-2xl overflow-hidden shadow-sm max-h-[700px]">
          <div className="p-6 border-b border-border/40 space-y-4 bg-surface-2/20">
            <input type="text" placeholder="Tên Mashup..." value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-transparent text-2xl font-bold font-display outline-none border-b border-transparent focus:border-primary/50 pb-2 transition-colors placeholder:text-muted-foreground/50" />
            <textarea placeholder="Mô tả mashup của bạn..." value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-background/50 border border-border/40 rounded-xl p-3 text-sm outline-none focus:border-primary/50 transition-all resize-none h-20 placeholder:text-muted-foreground" />
          </div>

          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Music className="w-5 h-5 text-primary" /> Timeline ({shorts.length}/8)
              </h2>
              {/* Energy Curve Mini Visualizer (Mock) */}
              {shorts.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-surface-2/30 px-3 py-1.5 rounded-full">
                  <Activity className="w-3 h-3 text-primary" />
                  <div className="flex items-end gap-0.5 h-3">
                    {shorts.map((_, i) => (
                      <div key={i} className="w-1 bg-primary rounded-t-sm opacity-80" style={{ height: `${30 + (i % 3) * 30}%` }} />
                    ))}
                  </div>
                  Năng lượng
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={shorts.map(s => s.short._id)} strategy={verticalListSortingStrategy}>
                  {shorts.map((item, index) => (
                    <SortableTimelineItem 
                      key={item.short._id}
                      item={item}
                      index={index}
                      isPlaying={playingShortId === item.short._id}
                      isCurrentlyPreviewing={isPreviewing && previewIndex === index}
                      isSettingsOpen={activeSettingsIndex === index}
                      setActiveSettingsIndex={setActiveSettingsIndex}
                      handlePlayShort={handlePlayShort}
                      removeShort={removeShort}
                      updateTransition={updateTransition}
                      stopPreview={stopPreview}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              
              {shorts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed border-border/40 rounded-xl bg-surface-2/10">
                  <Music className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm">Chọn shorts từ kho bên trái để bắt đầu</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: AI Gợi ý */}
        <div className="xl:col-span-3 flex flex-col bg-surface-1/60 backdrop-blur-xl border border-border/40 rounded-2xl overflow-hidden shadow-sm max-h-[700px]">
          <div className="p-4 border-b border-border/40 bg-surface-2/30 flex items-center gap-2">
            <Sparkles className={`w-5 h-5 ${suggestShorts.isPending ? 'text-muted-foreground animate-pulse' : 'text-brand-glow'}`} />
            <h2 className="text-lg font-semibold font-display">AI Gợi Ý Tự Động</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 relative">
            {suggestShorts.isPending && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
              </div>
            )}
            {suggestions.length > 0 ? (
              suggestions.map(short => {
                const isPlaying = playingShortId === short._id;
                return (
                <div key={short._id} className="flex items-center gap-3 bg-surface-2/30 border border-border/30 p-2.5 rounded-xl hover:bg-surface-2/60 transition-all group">
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 cursor-pointer" onClick={(e) => handlePlayShort(e, short)}>
                    <ImageWithFallback src={short.track?.coverImage} className="w-full h-full object-cover" />
                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm truncate ${isPlaying ? 'text-primary' : ''}`}>{short.track?.title}</p>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded-md border border-emerald-500/20">{(short as any).compatibilityScore || 90}% Match</span>
                  </div>
                  <button onClick={() => addShort(short)} className="p-1.5 bg-background hover:bg-primary hover:text-white border border-border/50 rounded-lg transition-colors"><Plus className="w-4 h-4" /></button>
                </div>
              )})
            ) : (
              <div className="text-center flex flex-col items-center justify-center h-full text-muted-foreground text-xs px-4 opacity-70">
                <Sparkles className="w-8 h-8 mb-2 opacity-20" />
                Thêm short vào Timeline để AI gợi ý.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* GLOBAL PLAYER BAR FOR FULL PREVIEW */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${shorts.length > 0 ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
        <div className="bg-background/90 backdrop-blur-xl border border-border/50 shadow-2xl rounded-full px-6 py-3 flex items-center gap-6">
           <div className="flex items-center gap-3">
             <div className="bg-primary/20 p-2 rounded-full"><Disc3 className={`w-5 h-5 text-primary ${isPreviewing ? 'animate-spin' : ''}`} /></div>
             <div className="hidden sm:block">
               <p className="text-sm font-semibold text-foreground">Nghe thử Mashup</p>
               <p className="text-xs text-muted-foreground">{shorts.length} tracks sẵn sàng</p>
             </div>
           </div>
           <div className="h-8 w-px bg-border/50 mx-2"></div>
           <button 
             onClick={() => { if(playingShortId) { audioRef.current?.pause(); setPlayingShortId(null); } togglePreview(); }}
             className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-full font-medium hover:brightness-110 transition-all"
           >
             {isPreviewing ? <><Square className="w-4 h-4 fill-current" /> Dừng</> : <><Play className="w-4 h-4 fill-current" /> Phát Toàn Bộ</>}
           </button>
        </div>
      </div>
      
    </div>
  );
};
