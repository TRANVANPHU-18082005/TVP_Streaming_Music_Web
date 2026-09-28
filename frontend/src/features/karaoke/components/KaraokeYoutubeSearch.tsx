import React, { useState, useRef, useEffect } from "react";
import { Search, Loader2, Youtube, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import { useYoutubeSearch } from "../hooks/useKaraokeQueries";
import { cn } from "@/lib/utils";

interface KaraokeYoutubeSearchProps {
  onSelectVideo: (videoId: string, title: string) => void;
  placeholder?: string;
  className?: string;
}

export const KaraokeYoutubeSearch = ({
  onSelectVideo,
  placeholder = "Tìm kiếm bài hát karaoke trên Youtube...",
  className,
}: KaraokeYoutubeSearchProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 600);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isFetching } = useYoutubeSearch(debouncedSearch);

  // Xử lý click ra ngoài để đóng dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (videoId: string, title: string) => {
    onSelectVideo(videoId, title);
    setIsOpen(false);
    setSearchTerm(""); // Reset hoặc giữ nguyên tuỳ UX, ở đây chọn reset
  };

  const showDropdown = isOpen && debouncedSearch.length > 0;
  const results = data?.data || [];

  return (
    <div className={cn("relative w-full max-w-2xl mx-auto", className)} ref={containerRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Youtube className="w-5 h-5 text-red-500" />
        </div>
        <Input
          type="text"
          className="w-full pl-10 pr-10 h-10 md:h-12 text-sm md:text-base rounded-full border-muted-foreground/30 focus-visible:ring-primary shadow-sm bg-background/50 backdrop-blur-sm"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          {(isLoading || isFetching) ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <Search className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {showDropdown && (
        <div className="absolute z-50 w-full mt-2 bg-background border rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm">Đang tìm kiếm trên Youtube...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>Không tìm thấy kết quả phù hợp cho "{debouncedSearch}"</p>
            </div>
          ) : (
            <div className="max-h-[300px] md:max-h-[400px] overflow-y-auto custom-scrollbar">
              <div className="p-1.5 md:p-2 flex flex-col gap-1">
                {results.map((video: any) => (
                  <button
                    key={video.videoId}
                    onClick={() => handleSelect(video.videoId, video.title)}
                    className="flex items-start gap-2.5 md:gap-3 p-1.5 md:p-2 rounded-lg hover:bg-muted/60 transition-colors text-left group"
                  >
                    <div className="relative w-24 md:w-32 aspect-video flex-shrink-0 rounded-md overflow-hidden bg-muted">
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 rounded text-[9px] md:text-[10px] font-medium text-white flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" />
                        {video.duration}
                      </div>
                    </div>
                    <div className="flex flex-col py-0.5 md:py-1 flex-1 min-w-0">
                      <h4 className="font-medium text-xs md:text-sm line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                        {video.title}
                      </h4>
                      <p className="text-[10px] md:text-xs text-muted-foreground mt-1 truncate flex items-center gap-1">
                        {video.channelName}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
