import React, { useState } from "react";
import { Users, Music, Settings, ListVideo, LogOut, Check, X, ShieldAlert, MessageSquare, PlaySquare, ListMusic, Radio, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { HostMemberManager } from "./HostMemberManager";
import RoomQueue from "./RoomQueue";
import RoomPlayer from "./RoomPlayer";
import RoomChat from "./RoomChat";
import RoomReactions, { ReactionButtons } from "./RoomReactions";
import { RoomAddTrack } from "./RoomAddTrack";
import RoomThemeBackground from "./RoomThemeBackground";
import RoomMoodVideoSelector from "./RoomMoodVideoSelector";
import type { RoomMessage, QueueItem, TrackRequest } from "../types/room.types";
import { ROOM_THEMES } from "../types/room.types";

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
  onRemoveFromQueue: (trackId: string) => void;
  onPlayNext: () => void;
  onTogglePause: (currentPosition: number) => void;
  onSendReaction: (emoji: string) => void;
  onLeaveRoom: () => void;
  trackRequests: TrackRequest[];
  onHandleRequest: (trackId: string, action: "approve" | "reject") => void;
  onChangeTheme: (theme: string) => void;
  currentTheme: string;
  onChangeMoodVideo: (videoId: string | null) => void;
  currentMoodVideoId: string | null;
}

export const HostDashboard = ({
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
  onRemoveFromQueue,
  onPlayNext,
  onTogglePause,
  onSendReaction,
  onLeaveRoom,
  trackRequests,
  onHandleRequest,
  onChangeTheme,
  currentTheme,
  onChangeMoodVideo,
  currentMoodVideoId,
}: Props) => {
  const [activeTab, setActiveTab] = useState<"player" | "queue" | "requests" | "add" | "settings" | "chat">("player");

  const desktopMainTab = ["player", "chat"].includes(activeTab) ? "queue" : activeTab;

  return (
    <div className="flex h-[100dvh] flex-col bg-background text-foreground overflow-hidden relative">
      <RoomReactions />
      <RoomThemeBackground theme={currentTheme as any} />

      {/* ── HEADER ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/50 dark:border-border/20 px-4 sm:px-5 glass-heavy relative z-20">
        <div className="flex items-center gap-3">
          {/* Host badge + room info */}
          <div className="flex items-center gap-2.5">
            <div
              className="flex size-8 items-center justify-center rounded-xl shadow-sm shrink-0"
              style={{ backgroundColor: `${themeAccent}22`, border: `1px solid ${themeAccent}44` }}
            >
              <ShieldAlert className="size-4" style={{ color: themeAccent }} />
            </div>
            <div className="flex flex-col leading-none gap-0.5 mr-4">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight">{roomName}</h1>
                {/* LIVE indicator */}
                <span className="inline-flex items-center gap-1 bg-red-500/15 border border-red-500/30 text-red-500 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-red-500" />
                  </span>
                  LIVE
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground font-semibold mt-1">
                Phòng của bạn <span className="opacity-40">·</span> <span className="font-mono font-bold">{roomCode}</span>
              </p>
            </div>
          </div>
          
          <HostMemberManager roomCode={roomCode} memberCount={memberCount} accentColor={themeAccent} hostId={hostId} />
        </div>

        <div className="flex items-center gap-2">
          {/* Member count */}
          <div className="hidden sm:flex items-center gap-1.5 glass text-xs font-semibold px-3 py-1.5 rounded-full border-border/60 dark:border-border/30">
            <Users className="size-3.5 text-muted-foreground" />
            <span>{memberCount}</span>
          </div>
          {/* Close room */}
          <button
            onClick={onLeaveRoom}
            id="host-close-room-btn"
            className="flex items-center gap-1.5 text-xs font-bold text-destructive hover:bg-destructive/10 border border-destructive/30 px-3 py-1.5 rounded-full transition-all hover:scale-105 active:scale-95 backdrop-blur-sm"
          >
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Đóng phòng</span>
          </button>
        </div>
      </header>

      {/* ── MAIN GRID LAYOUT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden relative z-10">

        {/* ── PANEL 1: Player + Reactions ── */}
        <aside className={cn(
          "flex-col border-border/50 dark:border-border/20",
          "lg:flex lg:col-span-3 lg:border-r",
          activeTab === "player" ? "flex col-span-1" : "hidden"
        )}>
          {/* Glass sidebar background */}
          <div className="absolute inset-0 glass-frosted pointer-events-none lg:w-[25%]" />

          <div className="relative flex-1 overflow-y-auto p-4 scrollbar-thin">
            {/* Section label */}
            <div className="flex items-center gap-2 mb-5">
              <Music className="size-3.5 text-muted-foreground" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Now Playing</span>
            </div>
            <RoomPlayer onPlayNext={onPlayNext} onTogglePause={onTogglePause} />
          </div>

          <div className="relative p-4 border-t border-border/50 dark:border-border/20 bg-background/30 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <Radio className="size-3 text-muted-foreground" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Reactions</span>
            </div>
            <ReactionButtons onReact={onSendReaction} />
          </div>
        </aside>

        {/* ── PANEL 2: Queue / Requests / Add / Settings ── */}
        <main className={cn(
          "flex-col bg-background/30 backdrop-blur-sm min-h-0 overflow-hidden",
          "lg:flex lg:col-span-6",
          ["queue", "requests", "settings", "add"].includes(activeTab) ? "flex col-span-1" : "hidden"
        )}>
          {/* Tab bar */}
          <div className="flex items-center gap-1 p-2 sm:p-3 border-b border-border/50 dark:border-border/20 glass-heavy overflow-x-auto no-scrollbar shrink-0">
            {/* Main tabs */}
            {(["queue", "requests", "add"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "relative flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all shrink-0",
                  desktopMainTab === tab
                    ? "bg-primary text-primary-foreground shadow-brand"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                {tab === "queue" && "Queue"}
                {tab === "requests" && "Yêu cầu"}
                {tab === "add" && (
                  <>
                    <Plus className="size-3.5" />
                    <span className="hidden sm:inline">Thêm bài</span>
                  </>
                )}
                {tab === "requests" && trackRequests.length > 0 && (
                  <span className={cn(
                    "text-[9px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center",
                    desktopMainTab === "requests"
                      ? "bg-background/30 text-primary-foreground"
                      : "bg-primary text-primary-foreground"
                  )}>
                    {trackRequests.length}
                  </span>
                )}
              </button>
            ))}

            <div className="flex-1" />

            <button
              onClick={() => setActiveTab("settings")}
              className={cn(
                "p-2 rounded-xl transition-all shrink-0",
                desktopMainTab === "settings"
                  ? "bg-primary text-primary-foreground shadow-brand"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
              title="Cài đặt phòng"
            >
              <Settings className="size-4 sm:size-5" />
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden p-2 sm:p-4 relative">
            {desktopMainTab === "queue" && (
              <RoomQueue onVote={onVote} onRemove={onRemoveFromQueue} votedTracks={votedTracks} />
            )}

            {desktopMainTab === "add" && (
              <div className="max-w-xl mx-auto h-full overflow-y-auto scrollbar-thin">
                <RoomAddTrack roomCode={roomCode} />
              </div>
            )}

            {desktopMainTab === "requests" && (
              <div className="h-full overflow-y-auto pr-1 space-y-2.5 scrollbar-thin">
                {trackRequests.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
                    <div className="size-16 rounded-2xl glass flex items-center justify-center border border-border/60 dark:border-border/30">
                      <ListVideo className="size-8 opacity-25" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold">Chưa có yêu cầu</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Listener sẽ gửi yêu cầu bài hát tới đây</p>
                    </div>
                  </div>
                ) : (
                  trackRequests.map((req) => (
                    <div
                      key={req.trackId}
                      className="group flex items-center gap-3 p-3 rounded-2xl glass-frosted border border-border/50 dark:border-border/20 hover:border-primary/30 transition-all shadow-card"
                    >
                      <div className="relative shrink-0">
                        <img
                          src={req.coverImage || "/placeholder-track.png"}
                          alt={req.trackTitle}
                          className="size-14 rounded-xl object-cover shadow-card-md group-hover:scale-105 transition-transform"
                        />
                        {req.count > 1 && (
                          <span className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-primary text-primary-foreground text-[9px] font-black flex items-center justify-center shadow-brand">
                            {req.count}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold truncate">{req.trackTitle}</h4>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{req.artistName}</p>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold mt-1.5 px-2 py-0.5 rounded-full border"
                          style={{ color: themeAccent, borderColor: `${themeAccent}44`, backgroundColor: `${themeAccent}11` }}>
                          {req.count} lượt yêu cầu
                        </span>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => onHandleRequest(req.trackId, "approve")}
                          className="size-9 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm"
                          title="Duyệt"
                        >
                          <Check className="size-4" />
                        </button>
                        <button
                          onClick={() => onHandleRequest(req.trackId, "reject")}
                          className="size-9 rounded-full bg-destructive/15 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white hover:border-destructive flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm"
                          title="Từ chối"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {desktopMainTab === "settings" && (
              <div className="max-w-xl mx-auto h-full overflow-y-auto scrollbar-thin">
                <div className="p-5 rounded-3xl glass-frosted border border-border/50 dark:border-border/20 shadow-card-lg">
                  <div className="mb-6">
                    <h3 className="text-base font-bold">Không gian (Theme)</h3>
                    <p className="text-xs text-muted-foreground mt-1">Thay đổi áp dụng cho tất cả người nghe & nền video.</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                    {Object.entries(ROOM_THEMES).map(([key, themeObj]) => {
                      const isActive = currentTheme === key;
                      return (
                        <button
                          key={key}
                          onClick={() => onChangeTheme(key)}
                          className={cn(
                            "group relative p-4 rounded-2xl border text-left transition-all duration-300",
                            isActive
                              ? "border-transparent scale-[1.02] shadow-brand"
                              : "border-border/60 dark:border-border/30 hover:border-border/60 hover:scale-[1.01] bg-card/40"
                          )}
                          style={isActive ? {
                            backgroundColor: `${themeObj.accent}18`,
                            boxShadow: `0 0 0 1.5px ${themeObj.accent}66, 0 8px 24px ${themeObj.accent}22`
                          } : {}}
                        >
                          {isActive && (
                            <div className="absolute top-2 right-2 size-4 rounded-full flex items-center justify-center" style={{ backgroundColor: themeObj.accent }}>
                              <Check className="size-2.5 text-white" />
                            </div>
                          )}
                          <h4 className="font-bold text-sm transition-colors" style={{ color: isActive ? themeObj.accent : undefined }}>
                            {themeObj.label}
                          </h4>
                          <div className="mt-3 h-1.5 rounded-full w-full" style={{ background: `linear-gradient(90deg, ${themeObj.accent}, ${themeObj.accent}88)` }} />
                        </button>
                      );
                    })}
                  </div>

                  <RoomMoodVideoSelector 
                    currentMoodVideoId={currentMoodVideoId}
                    onChangeMoodVideo={onChangeMoodVideo}
                    accentColor={themeAccent}
                  />
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ── PANEL 3: Members + Chat ── */}
        <aside className={cn(
          "flex-col border-border/50 dark:border-border/20 min-h-0 overflow-hidden",
          "lg:flex lg:col-span-3 lg:border-l",
          activeTab === "chat" ? "flex col-span-1" : "hidden"
        )}>
          <div className="absolute right-0 inset-y-0 w-[25%] glass-frosted pointer-events-none hidden lg:block" />

          <div className="relative flex-1 min-h-0 p-3 sm:p-4 flex flex-col overflow-hidden">
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
            />
          </div>
        </aside>
      </div>

      {/* ── MOBILE BOTTOM TABS ── */}
      <nav className="lg:hidden shrink-0 glass-heavy border-t border-border/50 dark:border-border/20 relative z-20" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-around px-2 py-2">
          {([
            { tab: "player", icon: PlaySquare, label: "Player", badge: 0 },
            { tab: "queue", icon: ListMusic, label: "Queue", badge: 0 },
            { tab: "requests", icon: ListVideo, label: "Yêu cầu", badge: trackRequests.length },
            { tab: "add", icon: Plus, label: "Thêm", badge: 0 },
            { tab: "chat", icon: MessageSquare, label: "Chat", badge: 0 },
          ] as Array<{ tab: typeof activeTab; icon: React.ElementType; label: string; badge: number }>).map(({ tab, icon: Icon, label, badge }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all",
                activeTab === tab ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "relative flex items-center justify-center size-9 rounded-xl transition-all",
                activeTab === tab ? "bg-primary/15 scale-110" : "hover:bg-muted/50"
              )}>
                <Icon className="size-5" />
                {/* Badge */}
                {badge && badge > 0 && (
                  <span className="absolute -top-1 -right-1 size-4 rounded-full bg-primary text-primary-foreground text-[9px] font-black flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-black tracking-tight">{label}</span>
              {/* Active dot indicator */}
              {activeTab === tab && (
                <span className="absolute -bottom-0.5 size-1 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default HostDashboard;
