import React from "react";
import { Search, Plus, Loader2 } from "lucide-react";
import { useRoomAddTrack } from "../hooks/useRoomAddTrack";

export const RoomAddTrack = ({ 
  roomCode, 
  isListener, 
  onRequest 
}: { 
  roomCode: string; 
  isListener?: boolean; 
  onRequest?: (trackId: string) => void;
}) => {
  const {
    query,
    setQuery,
    results,
    isSearching,
    isOpen,
    setIsOpen,
    containerRef,
    handleAdd,
  } = useRoomAddTrack(roomCode);

  return (
    <div className="relative mb-4" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Tìm bài hát để thêm..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          className="w-full bg-input/50 border border-border/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 rounded-xl pl-9 pr-4 py-2 text-sm outline-none transition-all text-foreground"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && (query || results.length > 0) && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-border/50 bg-background/95 backdrop-blur-xl shadow-floating overflow-hidden">
          <div className="max-h-64 overflow-y-auto p-1 scrollbar-thin">
            {!isSearching && results.length === 0 && query && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Không tìm thấy bài hát nào
              </div>
            )}
            {results.map((track) => (
              <div
                key={track._id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 group cursor-pointer transition-colors"
                onClick={() => handleAdd(track._id, isListener, onRequest)}
              >
                <img
                  src={track.coverImage || "/placeholder-track.png"}
                  alt={track.title}
                  className="size-10 rounded-md object-cover shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate text-foreground group-hover:text-primary transition-colors">
                    {track.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {track.artist?.name || "Unknown"}
                  </p>
                </div>
                <button
                  className="shrink-0 size-8 flex items-center justify-center rounded-full bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-all hover:bg-primary hover:text-primary-foreground"
                  aria-label="Thêm"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
