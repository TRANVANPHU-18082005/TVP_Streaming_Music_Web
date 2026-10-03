import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { KaraokePlayer } from "@/features/karaoke/components/KaraokePlayer";
import { KaraokeCommunityFeed } from "@/features/karaoke/components/KaraokeCommunityFeed";
import { KaraokeMyRecordings } from "@/features/karaoke/components/KaraokeMyRecordings";
import { Mic2, Music4, Globe, User2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "studio", label: "Phòng thu", icon: Mic2 },
  { id: "my-recordings", label: "Bản thu của tôi", icon: User2 },
  { id: "community", label: "Cộng đồng", icon: Globe },
] as const;

type TabId = typeof TABS[number]["id"];

const KaraokePage = () => {
  const [activeTab, setActiveTab] = useState<TabId>("studio");
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || undefined;

  return (
    <div className="flex flex-col min-h-screen bg-background relative overflow-hidden pb-32">
      <div className="absolute top-0 left-0 w-full h-[500px] overflow-hidden -z-10 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[100%] rounded-full bg-primary/10 blur-[120px] mix-blend-screen" />
        <div className="absolute top-[10%] -right-[10%] w-[40%] h-[80%] rounded-full bg-primary/10 blur-[100px] mix-blend-screen" />
      </div>

      {/* Hero Section */}
      <div className="relative w-full pt-16 pb-8 flex flex-col items-center justify-center overflow-hidden shrink-0">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-10 flex flex-col items-center text-center space-y-5 px-4"
        >
          <div className="relative flex items-center justify-center p-4 md:p-6 bg-primary rounded-3xl md:rounded-[2rem] shadow-2xl shadow-primary/25 mb-4 border border-white/20">
            <Mic2 className="w-8 h-8 md:w-12 md:h-12 text-primary-foreground drop-shadow-lg" />
            <Sparkles className="absolute -top-3 -right-3 w-6 h-6 md:w-8 md:h-8 text-yellow-400 animate-pulse drop-shadow-md" />
          </div>
          
          <h1 className="text-3xl md:text-6xl font-black font-display tracking-tight text-primary">
            Karaoke Studio
          </h1>
          <p className="text-muted-foreground max-w-xl text-sm md:text-lg">
            Thỏa sức đam mê ca hát. Tìm kiếm mọi bài hát từ YouTube, ghi âm và chia sẻ những khoảnh khắc âm nhạc tuyệt vời nhất của bạn.
          </p>
        </motion.div>
        
        {/* Decorative elements */}
        <motion.div 
          animate={{ y: [0, -15, 0], rotate: [-10, -5, -10] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-10 left-[10%] opacity-20 dark:opacity-10 pointer-events-none"
        >
          <Music4 className="w-24 h-24 text-primary" />
        </motion.div>
        
        <motion.div 
          animate={{ y: [0, 20, 0], rotate: [10, 15, 10] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-10 right-[15%] opacity-20 dark:opacity-10 pointer-events-none"
        >
          <Mic2 className="w-32 h-32 text-primary" />
        </motion.div>
      </div>

      {/* Custom Animated Tabs */}
      <div className="section-container relative z-10 pt-4">
        <div className="flex justify-center mb-8 md:mb-12 w-full px-2 sm:px-0">
          <div className="flex w-full md:w-auto items-center p-1 md:p-1.5 bg-background/50 dark:bg-card/50 backdrop-blur-xl rounded-full border border-border/50 shadow-sm">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative flex-1 md:flex-none flex justify-center items-center gap-1.5 md:gap-2 px-1 md:px-8 py-2.5 md:py-3.5 rounded-full text-[11px] md:text-sm font-bold transition-all outline-none",
                    isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="karaoke-active-tab"
                      className="absolute inset-0 bg-primary rounded-full shadow-lg shadow-primary/20"
                      initial={false}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5 md:gap-2">
                    <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content with AnimatePresence */}
        <div className="relative min-h-[500px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -15, filter: "blur(4px)" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="w-full"
            >
              {activeTab === "studio" && (
                <div className="bg-white/40 dark:bg-card/20 backdrop-blur-3xl rounded-[2.5rem] border border-white/20 dark:border-white/5 shadow-2xl overflow-hidden p-2 md:p-4">
                  <KaraokePlayer initialQuery={initialQuery} />
                </div>
              )}
              {activeTab === "my-recordings" && (
                <div className="bg-white/40 dark:bg-card/20 backdrop-blur-3xl rounded-[2.5rem] border border-white/20 dark:border-white/5 shadow-2xl overflow-hidden p-4 md:p-8">
                  <KaraokeMyRecordings />
                </div>
              )}
              {activeTab === "community" && (
                <div className="bg-white/40 dark:bg-card/20 backdrop-blur-3xl rounded-[2.5rem] border border-white/20 dark:border-white/5 shadow-2xl overflow-hidden p-4 md:p-8">
                  <KaraokeCommunityFeed />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default KaraokePage;
