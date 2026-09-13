// features/music-room/components/RoomQueue.tsx
/**
 * Danh sách queue bài hát + Vote system.
 * Bài nhiều vote nhất → đầu queue, có glow effect.
 * Tuân theo design system index.css.
 */

import React, { memo } from "react";
import { useSelector } from "react-redux";
import { ThumbsUp, Crown, ListMusic, X } from "lucide-react";
import { selectRoomQueue, selectIsHost, selectCurrentRoom } from "../store/roomSlice";
import { ROOM_THEMES } from "../types/room.types";
import type { QueueItem } from "../types/room.types";
import { cn } from "@/lib/utils";

interface Props {
  onVote: (trackId: string) => void;
  onRemove?: (trackId: string) => void;
  votedTracks?: Set<string>;
  isListener?: boolean;
}

// ── Queue track card ──────────────────────────────────────────────────────────

const QueueTrackCard = memo(
  ({
    item,
    rank,
    accentColor,
    isHost,
    isTopVoted,
    hasVoted,
    onVote,
    onRemove,
  }: {
    item: QueueItem;
    rank: number;
    accentColor: string;
    isHost: boolean;
    isTopVoted: boolean;
    hasVoted: boolean;
    onVote: (id: string) => void;
    onRemove?: (id: string) => void;
  }) => (

    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-2xl transition-all border",
        isTopVoted 
          ? "bg-primary/10 border-primary/30 shadow-md ring-1 ring-primary/20 scale-[1.01]" 
          : "bg-card/40 border-border/20 hover:bg-card/60 hover:border-primary/30",
      )}
    >
      {/* Inner content */}
      <div className="flex items-center justify-center w-6 shrink-0">
        {isTopVoted ? (
          <Crown className="size-4 text-primary animate-bounce" />
        ) : (
          <span className="text-xs font-bold text-muted-foreground">#{rank}</span>
        )}
      </div>

      {/* Cover */}
      <div className="relative size-12 shrink-0 overflow-hidden rounded-xl shadow-sm">
        <img
          src={item.track.coverImage || "/placeholder-track.png"}
          alt={item.track.title}
          className="size-full object-cover"
        />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold truncate text-foreground">
          {item.track.title}
        </p>
        <p className="text-xs font-medium truncate text-muted-foreground mt-0.5">
          {item.track.artist?.name ?? "Unknown Artist"}
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Vote */}
        <button
          id={`vote-btn-${item.track._id}`}
          onClick={() => onVote(item.track._id)}
          aria-pressed={hasVoted}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm",
            hasVoted 
              ? "bg-primary text-primary-foreground scale-105" 
              : "bg-background border border-border/50 text-foreground hover:bg-muted"
          )}
        >
          <ThumbsUp className={cn("size-3", hasVoted && "fill-current")} />
          <span>{item.votes}</span>
        </button>

        {/* Remove (host only) */}
        {isHost && onRemove && (
          <button
            id={`remove-queue-btn-${item.track._id}`}
            onClick={() => onRemove(item.track._id)}
            aria-label="Xóa khỏi queue"
            className="size-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  ),
);
QueueTrackCard.displayName = "QueueTrackCard";

import { RoomAddTrack } from "./RoomAddTrack";

// ── RoomQueue ────────────────────────────────────────────────────────────────

const RoomQueue = memo(({ onVote, onRemove, votedTracks = new Set(), isListener = false }: Props) => {
  const queue = useSelector(selectRoomQueue);
  const isHost = useSelector(selectIsHost);
  const currentRoom = useSelector(selectCurrentRoom);
  const theme = (currentRoom?.theme ?? "bar") as keyof typeof ROOM_THEMES;
  const accentColor = ROOM_THEMES[theme].accent;

  // Bug 7 fix: stable sort — khi votes bằng nhau thì giữ thứ tự FIFO theo addedAt
  const sortedQueue = [...queue].sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
  });
  const maxVotes = sortedQueue[0]?.votes ?? 0;
  
  return (
    <div className="flex h-full flex-col">

      {/* ── Header ── */}
      <div className="mb-4 flex items-center justify-between px-2">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 drop-shadow-sm">
          <ListMusic className="size-4 text-primary" />
          Danh sách phát ({queue.length}/30)
        </h3>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">Vote để ưu tiên</span>
      </div>

      {!isListener && currentRoom && (
        <div className="mb-4 hidden lg:block">
           <RoomAddTrack roomCode={currentRoom.roomCode} />
        </div>
      )}

      {/* ── List ── */}
      <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto px-1 pb-4">
        {sortedQueue.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="size-16 rounded-3xl bg-muted/30 flex items-center justify-center border border-border/20 shadow-inner">
              <ListMusic className="size-8 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground">Queue trống</p>
              <p className="text-sm font-medium text-muted-foreground mt-1">Thêm bài để cùng nghe</p>
            </div>
          </div>
        ) : (
          sortedQueue.map((item, idx) => (
            <QueueTrackCard
              key={item._id}
              item={item}
              rank={idx + 1}
              accentColor={accentColor}
              isHost={isHost}
              isTopVoted={maxVotes > 0 && item.votes === maxVotes && idx === 0}
              hasVoted={votedTracks.has(item.track._id)}
              onVote={onVote}
              onRemove={onRemove}
            />
          ))
        )}
      </div>
    </div>
  );
});

RoomQueue.displayName = "RoomQueue";
export default RoomQueue;
