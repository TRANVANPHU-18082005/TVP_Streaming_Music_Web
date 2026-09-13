import React, { useState } from "react";
import { Music, MessageSquare, Plus, ChevronUp, LogOut, X, Disc3 } from "lucide-react";
import { cn } from "@/lib/utils";
import RoomQueue from "./RoomQueue";
import { ReactionButtons } from "./RoomReactions";
import { RoomRequestTrack } from "./RoomRequestTrack";
import RoomChat from "./RoomChat";
import RoomReactions from "./RoomReactions";
import RoomMemberList from "./RoomMemberList";
import type { RoomMessage, QueueItem } from "../types/room.types";
import { getMembers } from "../api/room.api";
import { useEffect } from "react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";

interface Props {
  roomCode: string;
  roomName: string;
  themeAccent: string;
  memberCount: number;
  messages: RoomMessage[];
  chatEndRef: React.RefObject<HTMLDivElement>;
  chatContainerRef: React.RefObject<HTMLDivElement>;
  isLoadingHistory: boolean;
  hasMoreHistory: boolean;
  onSendMessage: (msg: string) => void;
  onLoadMoreHistory: () => void;
  currentUserId?: string;
  hostId?: string;
  votedTracks: Set<string>;
  onVote: (trackId: string) => void;
  onSendReaction: (emoji: string) => void;
  onLeaveRoom: () => void;
  onRequestTrack: (trackId: string) => void;
  currentTrack: any;
  playbackState: any;
  moodVideoUrl?: string;
}

export const ListenerView = ({
  roomCode,
  roomName,
  themeAccent,
  memberCount,
  messages,
  chatEndRef,
  chatContainerRef,
  isLoadingHistory,
  hasMoreHistory,
  onSendMessage,
  onLoadMoreHistory,
  currentUserId,
  hostId,
  votedTracks,
  onVote,
  onSendReaction,
  onLeaveRoom,
  onRequestTrack,
  currentTrack,
  playbackState,
  moodVideoUrl,
}: Props) => {
  const [activeModal, setActiveModal] = useState<"queue" | "request" | "chat" | null>(null);
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    getMembers(roomCode)
      .then((data) => {
        if (isMounted) setMembers(data);
      })
      .catch(console.error);
    return () => { isMounted = false; };
  }, [roomCode, memberCount]);

  const isPlaying = currentTrack && !playbackState?.isPaused;

  const bgImage = currentTrack?.coverImage || "/placeholder-track.png";

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden relative bg-background text-foreground select-none">
      <RoomReactions />

      {/* ── IMMERSIVE BACKGROUND ── */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {/* Blurred album art */}
        {!moodVideoUrl && (
          <ImageWithFallback
            src={bgImage}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-[80px] opacity-25 saturate-150"
            style={{ transition: "opacity 1.5s ease" }}
          />
        )}
        {/* Mood video layer */}
        {moodVideoUrl && (
          <video
            src={moodVideoUrl}
            autoPlay loop muted playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-90 saturate-[1.1]"
          />
        )}
        {/* Gradient vignettes */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-b",
          moodVideoUrl ? "from-black/80 via-black/20 to-black/80" : "from-background/90 via-background/30 to-background/95"
        )} />
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t via-transparent to-transparent",
          moodVideoUrl ? "from-black/95" : "from-background/95"
        )} />
        {/* Theme accent radial glow */}
        <div
          className="absolute inset-0 opacity-20"
          style={{ background: `radial-gradient(ellipse 70% 40% at 50% 30%, ${themeAccent}55, transparent)` }}
        />
      </div>

      {/* ── HEADER (Glass pill) ── */}
      <header className="flex items-center justify-between px-4 pt-4 pb-2 relative z-20">
        {/* Left: Room info */}
        <div className="flex flex-col gap-1 min-w-0 flex-1 mr-3">
          <h1 className="text-sm sm:text-base font-bold leading-tight truncate drop-shadow-sm">
            {roomName}
          </h1>
          <RoomMemberList members={members} />
        </div>

        {/* Right: Room code + leave */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:flex items-center glass border-border/60 dark:border-border/30 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full text-muted-foreground">
            {roomCode}
          </span>
          <button
            onClick={onLeaveRoom}
            id="listener-leave-btn"
            title="Rời phòng"
            className="size-9 rounded-full glass border-border/60 dark:border-border/30 hover:bg-destructive/15 hover:border-destructive/40 hover:text-destructive flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-sm"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      {/* ── CENTER: IMMERSIVE PLAYER ── */}
      <main className="flex-1 flex flex-col items-center justify-center relative z-10 px-6 py-4 overflow-hidden">
        {currentTrack ? (
          <div className="w-full max-w-[320px] sm:max-w-[380px] flex flex-col items-center gap-6">

            {/* ── Vinyl / Album Art with Glow ── */}
            <div className="relative flex items-center justify-center">
              {/* Outer glow halo */}
              {!moodVideoUrl && (
                <div
                  className={cn(
                    "absolute rounded-full transition-all duration-1000",
                    isPlaying ? "opacity-60 scale-110" : "opacity-0 scale-100"
                  )}
                  style={{
                    width: "100%",
                    height: "100%",
                    boxShadow: `0 0 60px 20px ${themeAccent}33, 0 0 120px 40px ${themeAccent}18`,
                    background: `radial-gradient(circle, ${themeAccent}22 0%, transparent 70%)`,
                  }}
                />
              )}

              {/* Vinyl disc */}
              <div
                className={cn(
                  "relative rounded-full overflow-hidden transition-all duration-700",
                  "border-[6px] border-background/30 shadow-card-lg shrink-0",
                  moodVideoUrl
                    ? "w-[120px] h-[120px] sm:w-[140px] sm:h-[140px] mt-10"
                    : "w-[260px] h-[260px] sm:w-[300px] sm:h-[300px]",
                  isPlaying ? "scale-100 opacity-100" : "scale-95 opacity-75",
                  isPlaying && "animate-[spin_22s_linear_infinite]"
                )}
              >
                {/* Vinyl grooves */}
                <div className="absolute inset-0 rounded-full border border-white/5 m-2 pointer-events-none" />
                <div className="absolute inset-0 rounded-full border border-white/5 m-6 pointer-events-none" />
                <div className="absolute inset-0 rounded-full border border-white/5 m-12 pointer-events-none" />
                <div className="absolute inset-0 rounded-full border border-white/5 m-20 pointer-events-none" />

                <ImageWithFallback
                  src={currentTrack.coverImage}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-track.png"; }}
                />

                {/* Center hole */}
                <div className="absolute inset-0 m-auto size-2 sm:size-4 rounded-full border-2 border-background/50 shadow-inner"
                  style={{ backgroundColor: "hsl(var(--background) / 0.95)" }} />
              </div>

              {/* Pause overlay */}
              {/* {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center z-10 rounded-full">
                  <div className="size-16 rounded-full glass border-border/60 dark:border-border/30 flex items-center justify-center backdrop-blur-xl shadow-floating">
                    <Disc3 className="size-8 text-muted-foreground opacity-60" />
                  </div>
                </div>
              )} */}
            </div>

            {/* ── Track Info ── */}
            <div className="text-center w-full px-2">
              {/* Now playing indicator */}
              <div className="flex items-center justify-center gap-2 mb-3">
                {isPlaying ? (
                  <div className="flex items-end gap-0.5 h-4">
                    {[1, 2, 3, 4].map((b) => (
                      <div
                        key={b}
                        className="w-0.5 rounded-full animate-pulse"
                        style={{
                          height: `${40 + b * 15}%`,
                          backgroundColor: themeAccent,
                          animationDelay: `${b * 0.15}s`,
                          animationDuration: "0.8s",
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <Music className="size-3.5 text-muted-foreground" />
                )}
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {isPlaying ? "Đang phát" : "Tạm dừng"}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight truncate drop-shadow-sm">
                {currentTrack.title}
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground mt-1.5 truncate font-medium">
                {currentTrack.artist?.name || "Unknown Artist"}
              </p>
            </div>

            {/* ── Progress bar (Theme-colored) ── */}
            <div className="w-full flex flex-col gap-1.5">
              <div className="w-full h-1 bg-foreground/10 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", isPlaying && "animate-pulse")}
                  style={{ width: "33%", backgroundColor: themeAccent }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground/60">
                <span>0:00</span>
                <span>∞</span>
              </div>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center gap-5 text-muted-foreground">
            <div
              className="size-28 rounded-full glass flex items-center justify-center border border-border/50 dark:border-border/20 animate-pulse shadow-floating cursor-pointer hover:scale-105 transition-transform"
              onClick={() => setActiveModal("request")}
              title="Gửi yêu cầu bài hát"
            >
              <Music className="size-14 opacity-30 text-primary" style={{ color: themeAccent }} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-base">Phòng đang chờ nhạc</p>
              <p className="text-xs font-medium mt-1 animate-pulse" style={{ color: themeAccent }}>
                Host đang chờ bạn gửi yêu cầu bài hát đấy!
              </p>
            </div>
          </div>
        )}
      </main>

      {/* ── REACTION BUTTONS ── */}
      <div className="relative z-20 px-4 pb-2 flex justify-center">
        <ReactionButtons onReact={onSendReaction} />
      </div>

      {/* ── BOTTOM FLOATING DOCK ── */}
      <footer className="relative z-20 px-4 pb-4 sm:pb-6 shrink-0" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="glass-heavy border border-border/50 dark:border-border/20 rounded-[2rem] shadow-floating overflow-hidden">
          <div className="flex items-stretch justify-around">
            {/* Queue */}
            <button
              onClick={() => setActiveModal("queue")}
              id="listener-queue-btn"
              className="flex-1 flex flex-col items-center gap-1.5 py-3 sm:py-4 px-2 hover:bg-muted/30 active:scale-95 transition-all group"
            >
              <ChevronUp className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-[10px] sm:text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors">Hàng đợi</span>
            </button>

            {/* Separator */}
            <div className="w-px my-3 bg-border/30" />

            {/* Request (CTA) */}
            <button
              onClick={() => setActiveModal("request")}
              id="listener-request-btn"
              className="flex-[1.4] flex items-center justify-center gap-2 py-3 sm:py-4 px-4 transition-all active:scale-95 group"
            >
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-white shadow-brand transition-all group-hover:scale-105"
                style={{ background: `linear-gradient(135deg, ${themeAccent}, ${themeAccent}cc)` }}
              >
                <Plus className="size-4" />
                <span>Yêu cầu</span>
              </div>
            </button>

            {/* Separator */}
            <div className="w-px my-3 bg-border/30" />

            {/* Chat */}
            <button
              onClick={() => setActiveModal("chat")}
              id="listener-chat-btn"
              className="flex-1 flex flex-col items-center gap-1.5 py-3 sm:py-4 px-2 hover:bg-muted/30 active:scale-95 transition-all group"
            >
              <MessageSquare className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-[10px] sm:text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors">Trò chuyện</span>
            </button>
          </div>
        </div>
      </footer>

      {/* ── BOTTOM SHEET MODALS ── */}
      {activeModal && (
        <div
          className="absolute inset-0 z-50 flex flex-col justify-end"
          style={{ backgroundColor: "hsl(var(--background) / 0.5)", backdropFilter: "blur(8px)" }}
        >
          {/* Backdrop tap to close */}
          <div className="flex-1" onClick={() => setActiveModal(null)} />

          {/* Sheet */}
          <div className="glass-ultra border border-border/50 dark:border-border/20 w-full max-h-[88vh] rounded-t-[2rem] sm:max-w-2xl sm:mx-auto sm:rounded-[2rem] sm:mb-6 shadow-floating flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-300 ease-out">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 dark:border-border/20 shrink-0">
              <h3 className="text-base font-bold">
                {activeModal === "queue" && "Hàng đợi & Bình chọn"}
                {activeModal === "request" && "Yêu cầu bài hát"}
                {activeModal === "chat" && "Trò chuyện phòng"}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="size-9 rounded-full glass flex items-center justify-center hover:bg-muted/60 transition-all hover:scale-105 active:scale-95"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Sheet content */}
            <div className="flex-1 overflow-hidden p-3 sm:p-4 min-h-0">
              {activeModal === "queue" && (
                <RoomQueue onVote={onVote} votedTracks={votedTracks} isListener />
              )}
              {activeModal === "request" && (
                <RoomRequestTrack
                  roomCode={roomCode}
                  onRequestTrack={(id) => {
                    onRequestTrack(id);
                    setActiveModal(null);
                  }}
                />
              )}
              {activeModal === "chat" && (
                <RoomChat
                  messages={messages}
                  chatEndRef={chatEndRef}
                  chatContainerRef={chatContainerRef}
                  isLoadingHistory={isLoadingHistory}
                  hasMoreHistory={hasMoreHistory}
                  onSendMessage={onSendMessage}
                  onLoadMore={onLoadMoreHistory}
                  accentColor={themeAccent}
                  currentUserId={currentUserId}
                  hostId={hostId}
                  isListener
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListenerView;
