import React, { useState, useEffect } from "react";
import { Search, Loader2, Music, Check, Send } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { searchApi } from "@/features/search";
import type { SearchTrack } from "@/features/search/types";
import { APP_CONFIG } from "@/config/constants";
import { cn } from "@/lib/utils";

interface Props {
  roomCode: string;
  onRequestTrack: (trackId: string) => void;
}

export const RoomRequestTrack = ({ roomCode, onRequestTrack }: Props) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<SearchTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [requestedTracks, setRequestedTracks] = useState<Set<string>>(new Set());

  const debouncedSearch = useDebounce(searchTerm, 500);

  useEffect(() => {
    if (!debouncedSearch) {
      setResults([]);
      return;
    }

    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const data = await searchApi.search({ q: debouncedSearch, limit: APP_CONFIG.PAGINATION_LIMIT });
        if (data.tracks) {
          setResults(data.tracks);
        }
      } catch (error) {
        console.error("Lỗi tìm kiếm:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchResults();
  }, [debouncedSearch]);

  const handleRequest = (trackId: string) => {
    onRequestTrack(trackId);
    setRequestedTracks((prev) => {
      const next = new Set(prev);
      next.add(trackId);
      return next;
    });
  };

  return (
    <div className="w-full flex flex-col h-full bg-transparent">
      <div className="text-center mb-6">
        <div className="size-12 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-3 border border-primary/30 shadow-inner">
          <Music className="size-6 text-primary" />
        </div>
        <h2 className="text-lg font-bold text-foreground drop-shadow-sm">
          Yêu cầu Bài hát
        </h2>
        <p className="text-xs font-medium text-muted-foreground mt-1.5 px-4">
          Gửi yêu cầu bài hát tới Host. Nếu được duyệt, bài hát sẽ lọt vào danh sách phát!
        </p>
      </div>

      <div className="relative mb-2">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Tìm tên bài hát hoặc ca sĩ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={cn(
            "w-full pl-11 pr-10 py-3.5 bg-background/60 backdrop-blur-md border border-border/40 rounded-[1.25rem] text-sm font-medium",
            "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all text-foreground shadow-sm placeholder:text-muted-foreground/70"
          )}
          autoFocus
        />
        {isLoading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 size-4 animate-spin text-primary" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto mt-2 space-y-2 scrollbar-thin pb-4">
        {!isLoading && results.length === 0 && searchTerm.trim() !== "" && (
          <div className="text-center text-sm font-medium text-muted-foreground py-12 bg-card/30 rounded-2xl border border-border/20 backdrop-blur-sm">
            Không tìm thấy bài hát nào.
          </div>
        )}

        {results.map((track) => {
          const isRequested = requestedTracks.has(track._id);
          return (
            <div
              key={track._id}
              className="flex items-center gap-3 p-2.5 bg-card/40 backdrop-blur-sm hover:bg-card/70 rounded-2xl transition-all border border-border/20 hover:border-primary/30 group shadow-sm"
            >
              <img
                src={track.coverImage || "/placeholder-track.png"}
                alt={track.title}
                className="size-12 rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{track.title}</p>
                <p className="text-xs font-medium text-muted-foreground truncate mt-0.5">
                  {track.artist?.name || "Unknown"}
                </p>
              </div>
              <button
                onClick={() => handleRequest(track._id)}
                disabled={isRequested}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 shadow-sm",
                  isRequested
                    ? "bg-green-500/20 text-green-500 border border-green-500/20 cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 active:scale-95"
                )}
              >
                {isRequested ? (
                  <>
                    <Check className="size-3.5" /> Đã gửi
                  </>
                ) : (
                  <>
                    <Send className="size-3.5" /> Yêu cầu
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
