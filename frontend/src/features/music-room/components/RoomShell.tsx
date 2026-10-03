import { useEffect, useState, type ReactNode, type RefObject } from "react";
import {
  Check,
  ListMusic,
  LogOut,
  MessageSquare,
  Mic,
  Plus,
  Settings,
  Share2,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import RoomThemeBackground from "./RoomThemeBackground";
import RoomReactions, { ReactionButtons } from "./RoomReactions";
import RoomPlayer from "./RoomPlayer";
import RoomQueue from "./RoomQueue";
import RoomChat from "./RoomChat";
import { RoomAddTrack } from "./RoomAddTrack";
import { RoomRequestTrack } from "./RoomRequestTrack";
import RoomMoodVideoSelector from "./RoomMoodVideoSelector";
import { RoomKaraokeMode } from "./RoomKaraokeMode";
import { RoomShareSheet } from "./RoomShareSheet";
import {
  ROOM_THEMES,
  type IKaraokeQueueItem,
  type QueueMode,
  type RoomHost,
  type RoomMessage,
  type RoomTheme,
  type TrackRequest,
} from "../types/room.types";
import {
  addCollectionToQueue,
  assignHost,
  getMembers,
  kickUser,
  setCoHost,
  updateRoomSettings,
  type RoomMember,
} from "../api/room.api";
import { searchApi } from "@/features/search";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type Sheet = "queue" | "add" | "chat" | "people" | "settings" | null;

const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsDesktop(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
};

interface Props {
  roomCode: string;
  roomName: string;
  theme: RoomTheme;
  memberCount: number;
  isHost: boolean;
  canControl: boolean;
  queueMode: QueueMode;
  isPublic: boolean;
  messages: RoomMessage[];
  chatEndRef: RefObject<HTMLDivElement | null>;
  chatContainerRef: RefObject<HTMLDivElement | null>;
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
  onCloseRoom: () => void;
  onRequestTrack: (trackId: string) => void;
  trackRequests: TrackRequest[];
  onHandleRequest: (trackId: string, action: "approve" | "reject") => void;
  onChangeTheme: (theme: string) => void;
  onChangeMoodVideo: (videoId: string | null) => void;
  currentMoodVideoId: string | null;
  moodVideoUrl?: string | null;
  disconnected: boolean;
  karaokeMode: boolean;
  currentKaraokeVideoId?: string;
  karaokeQueue: IKaraokeQueueItem[];
  currentSinger?: RoomHost;
  onToggleKaraokeMode: (enabled: boolean) => void;
  onAddKaraokeQueue: (videoId: string, title: string) => void;
  onNextKaraokeSinger: () => void;
  onShareKaraokeRecording: (recordingId: string, url: string, title: string) => void;
}

export const RoomShell = ({
  roomCode,
  roomName,
  theme,
  memberCount,
  isHost,
  canControl,
  queueMode,
  isPublic,
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
  onCloseRoom,
  onRequestTrack,
  trackRequests,
  onHandleRequest,
  onChangeTheme,
  onChangeMoodVideo,
  currentMoodVideoId,
  moodVideoUrl,
  disconnected,
  karaokeMode,
  currentKaraokeVideoId,
  karaokeQueue,
  currentSinger,
  onToggleKaraokeMode,
  onAddKaraokeQueue,
  onNextKaraokeSinger,
  onShareKaraokeRecording,
}: Props) => {
  const isDesktop = useIsDesktop();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [playlistQuery, setPlaylistQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"track" | "collection">("track");
  const debouncedPlaylist = useDebounce(playlistQuery, 400);
  const [collections, setCollections] = useState<{ id: string; title: string; kind: "playlist" | "album" }[]>([]);
  const accent = ROOM_THEMES[theme].accent;
  const needsApproval = queueMode === "approval" && !canControl;
  const canAddCollection = queueMode === "open" || canControl;
  const role = isHost ? "host" : canControl ? "cohost" : "member";
  const roleLabel = role === "host" ? "Host" : role === "cohost" ? "Co-host" : "Thành viên";
  const showControlLayout = role !== "member";
  const showAside = isDesktop && showControlLayout;
  const showBottomNav = !showAside;

  useEffect(() => {
    if (role !== "host" && sheet === "settings") setSheet(null);
  }, [role, sheet]);

  useEffect(() => {
    let alive = true;
    getMembers(roomCode)
      .then((rows) => {
        if (alive) setMembers(rows);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [roomCode, memberCount, hostId]);

  useEffect(() => {
    if (!debouncedPlaylist.trim() || !canAddCollection) {
      setCollections([]);
      return;
    }
    searchApi
      .search({ q: debouncedPlaylist, limit: 5 })
      .then((data) => {
        const playlists = (data.playlists ?? []).map((item) => ({
          id: item._id,
          title: item.title,
          kind: "playlist" as const,
        }));
        const albums = (data.albums ?? []).map((item) => ({
          id: item._id,
          title: item.title,
          kind: "album" as const,
        }));
        setCollections([...playlists, ...albums].slice(0, 6));
      })
      .catch(() => setCollections([]));
  }, [debouncedPlaylist, canAddCollection]);

  const addCollection = async (item: { id: string; kind: "playlist" | "album" }) => {
    try {
      const result = await addCollectionToQueue(
        roomCode,
        item.kind === "playlist" ? { playlistId: item.id } : { albumId: item.id },
      );
      toast.success(`Đã thêm ${result.added} bài`);
      setPlaylistQuery("");
      setCollections([]);
    } catch {
      toast.error("Không thêm được danh sách bài");
    }
  };

  const toggleQueueMode = async () => {
    const next: QueueMode = queueMode === "open" ? "approval" : "open";
    try {
      await updateRoomSettings(roomCode, next);
      toast.success(next === "open" ? "Mọi người có thể thêm bài" : "Bài mới cần bạn duyệt");
    } catch {
      toast.error("Không đổi được chế độ hàng chờ");
    }
  };

  const toggleCoHost = async (member: RoomMember) => {
    try {
      await setCoHost(roomCode, member.userId, !member.isCoHost);
      setMembers((rows) =>
        rows.map((row) => (row.userId === member.userId ? { ...row, isCoHost: !member.isCoHost } : row)),
      );
    } catch {
      toast.error("Không cập nhật được co-host");
    }
  };

  const toggleSheet = (name: Sheet) => setSheet((current) => (current === name ? null : name));

  const addControls = (
    <div className="flex flex-col gap-2 flex-1 min-h-0">
      {canAddCollection && (
        <div className="flex bg-muted/50 p-1 rounded-xl">
          <button 
            type="button"
            className={cn("flex-1 text-[11px] py-1.5 rounded-lg font-bold transition-all", searchMode === "track" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            onClick={() => setSearchMode("track")}
          >
            {needsApproval ? "Yêu cầu bài hát" : "Thêm bài hát"}
          </button>
          <button 
            type="button"
            className={cn("flex-1 text-[11px] py-1.5 rounded-lg font-bold transition-all", searchMode === "collection" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            onClick={() => setSearchMode("collection")}
          >
            Playlist & Album
          </button>
        </div>
      )}

      <div className="relative flex flex-col flex-1 min-h-0">
        {searchMode === "track" || !canAddCollection ? (
          needsApproval ? (
            <RoomRequestTrack
              roomCode={roomCode}
              onRequestTrack={(trackId) => {
                onRequestTrack(trackId);
                setSheet(null);
              }}
            />
          ) : (
            <RoomAddTrack roomCode={roomCode} />
          )
        ) : (
          <div className="relative flex-none">
            <ListMusic className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={playlistQuery}
              onChange={(event) => setPlaylistQuery(event.target.value)}
              placeholder="Tìm playlist hoặc album..."
              className="w-full bg-input/50 border border-border/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 rounded-xl pl-9 pr-4 py-2 text-sm outline-none transition-all text-foreground"
            />
            {collections.length > 0 && (
              <div className="absolute z-50 mt-2 w-full rounded-xl border border-border/50 bg-background/95 backdrop-blur-xl shadow-floating overflow-hidden py-1">
                {collections.map((item) => (
                  <button
                    key={`${item.kind}-${item.id}`}
                    type="button"
                    className="block w-full truncate px-3 py-2 text-left text-[13px] font-medium hover:bg-accent/50 transition-colors"
                    onClick={() => void addCollection(item)}
                  >
                    <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mr-2">{item.kind === "album" ? "ALBUM" : "PLAYLIST"}</span> 
                    {item.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const requestList = isHost && trackRequests.length > 0 && (
    <ul className="mb-3 space-y-2">
      {trackRequests.map((request) => (
        <li key={request.trackId} className="flex items-center gap-3 rounded-2xl border border-border/50 bg-background/70 p-2">
          <img
            src={request.coverImage || "/placeholder-track.png"}
            alt=""
            className="size-11 shrink-0 rounded-xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{request.trackTitle}</p>
            <p className="truncate text-xs text-muted-foreground">
              {request.artistName || "Bài yêu cầu"} · {request.count} lượt
            </p>
          </div>
          <button
            type="button"
            className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            onClick={() => onHandleRequest(request.trackId, "approve")}
          >
            Duyệt
          </button>
          <button
            type="button"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Bỏ yêu cầu"
            onClick={() => onHandleRequest(request.trackId, "reject")}
          >
            <X className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  );

  const queueBody = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        {requestList}
        <div className="mb-3 hidden lg:block">{addControls}</div>
      </div>
      <div className="min-h-0 flex-1 flex flex-col">
        <RoomQueue
          onVote={onVote}
          onRemove={isHost ? onRemoveFromQueue : undefined}
          votedTracks={votedTracks}
          isListener
        />
      </div>
    </div>
  );

  const chatBody = (
    <RoomChat
      messages={messages}
      onSendMessage={onSendMessage}
      chatEndRef={chatEndRef as RefObject<HTMLDivElement>}
      chatContainerRef={chatContainerRef as RefObject<HTMLDivElement>}
      isLoadingHistory={isLoadingHistory}
      hasMoreHistory={hasMoreHistory}
      onLoadMore={onLoadMoreHistory}
      accentColor={accent}
      currentUserId={currentUserId}
      hostId={hostId}
    />
  );

  const peopleBody = (
    <div className="flex-1 overflow-y-auto min-h-0 scrollbar-glass">
      <ul className="space-y-2">
        {members.length === 0 && <p className="text-sm text-muted-foreground">Chưa tải được danh sách.</p>}
      {members.map((member) => (
        <li key={member.userId} className="flex items-center justify-between gap-2 rounded-2xl px-1 py-1">
          <div className="flex min-w-0 items-center gap-2">
            {member.avatar ? (
              <img src={member.avatar} alt="" className="size-9 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {(member.fullName || member.username || "?").slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{member.fullName || member.username}</p>
              <p className="text-xs text-muted-foreground">
                {member.isHost ? "Host" : member.isCoHost ? "Co-host" : "Thành viên"}
              </p>
            </div>
          </div>
          {isHost && !member.isHost && member.userId !== currentUserId && (
            <span className="flex shrink-0 flex-wrap justify-end gap-1">
              <button
                type="button"
                className="rounded-full px-2 py-1 text-xs text-primary hover:bg-primary/10"
                onClick={() => {
                  if (!window.confirm("Chuyển quyền chủ phòng cho người này?")) return;
                  void assignHost(roomCode, member.userId).catch(() => toast.error("Không chuyển được host"));
                }}
              >
                Chuyển host
              </button>
              <button
                type="button"
                className="rounded-full px-2 py-1 text-xs text-primary hover:bg-primary/10"
                onClick={() => void toggleCoHost(member)}
              >
                {member.isCoHost ? "Gỡ co-host" : "Cho co-host"}
              </button>
              <button
                type="button"
                className="rounded-full px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                onClick={() => {
                  if (!window.confirm("Đưa người này ra khỏi phòng?")) return;
                  void kickUser(roomCode, member.userId)
                    .then(() => setMembers((rows) => rows.filter((row) => row.userId !== member.userId)))
                    .catch(() => toast.error("Không đuổi được thành viên"));
                }}
              >
                Đuổi
              </button>
            </span>
          )}
        </li>
      ))}
      </ul>
    </div>
  );

  const settingsBody = (
    <div className="flex-1 overflow-y-auto min-h-0 space-y-4 scrollbar-glass pr-2">
      <div>
        <p className="mb-2 text-sm font-medium">Không khí phòng</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ROOM_THEMES) as RoomTheme[]).map((key) => {
            const active = theme === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChangeTheme(key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium",
                  active ? "border-transparent text-white" : "border-border text-foreground",
                )}
                style={active ? { backgroundColor: ROOM_THEMES[key].accent } : undefined}
              >
                {active && <Check className="mr-1 inline size-3" />}
                {ROOM_THEMES[key].label}
              </button>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        onClick={() => void toggleQueueMode()}
        className="w-full rounded-xl border border-border px-3 py-2 text-left text-sm"
      >
        Hàng chờ: {queueMode === "open" ? "ai cũng thêm được" : "cần bạn duyệt"}
      </button>
      <RoomMoodVideoSelector
        currentMoodVideoId={currentMoodVideoId}
        onChangeMoodVideo={onChangeMoodVideo}
        accentColor={accent}
      />
      <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <Mic className="size-4" style={{ color: accent }} />
            Karaoke
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Chuyển sân khấu sang video hát.</p>
        </div>
        <button
          type="button"
          onClick={() => onToggleKaraokeMode(!karaokeMode)}
          className={cn("relative inline-flex h-6 w-11 items-center rounded-full", karaokeMode ? "bg-primary" : "bg-muted")}
          aria-pressed={karaokeMode}
          aria-label="Bật karaoke"
        >
          <span className={cn("inline-block size-4 rounded-full bg-white transition-transform", karaokeMode ? "translate-x-6" : "translate-x-1")} />
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          if (window.confirm("Đóng phòng cho mọi người đang nghe?")) onCloseRoom();
        }}
        className="w-full rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
      >
        Đóng phòng
      </button>
    </div>
  );

  const sheetTitle: Record<Exclude<Sheet, null>, string> = {
    queue: "Hàng chờ",
    add: needsApproval ? "Yêu cầu bài hát" : "Thêm bài",
    chat: "Trò chuyện",
    people: "Đang trong phòng",
    settings: "Cài đặt phòng",
  };

  const sheetBody: Record<Exclude<Sheet, null>, ReactNode> = {
    queue: queueBody,
    add: addControls,
    chat: chatBody,
    people: peopleBody,
    settings: settingsBody,
  };

  const overlaySheet = sheet === "people" || sheet === "settings" ? sheet : null;
  const mobileSheet = sheet && sheet !== "people" && sheet !== "settings" ? sheet : null;

  const renderSheet = (name: Exclude<Sheet, null>, className: string, isMobileView: boolean) => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      <button type="button" className="absolute inset-0 bg-background/50 backdrop-blur-sm w-full h-full" aria-label="Đóng" onClick={() => setSheet(null)} />
      <motion.div 
        initial={isMobileView ? { y: "100%" } : { opacity: 0, scale: 0.95 }}
        animate={isMobileView ? { y: 0 } : { opacity: 1, scale: 1 }}
        exit={isMobileView ? { y: "100%" } : { opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="glass-frosted shadow-floating relative z-10 flex max-h-[88%] min-h-[50vh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-border/50 sm:max-w-lg sm:rounded-[2rem] lg:max-h-[70vh] lg:min-h-0"
      >
        <div className="flex justify-center pt-3 lg:hidden">
          <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-semibold">{sheetTitle[name]}</h2>
          <button type="button" onClick={() => setSheet(null)} className="rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors" aria-label="Đóng">
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 flex flex-col px-4 pb-4 pt-1">
          {sheetBody[name]}
        </div>
      </motion.div>
    </motion.div>
  );

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <RoomReactions />
      {moodVideoUrl ? (
        <video
          key={moodVideoUrl}
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
          src={moodVideoUrl}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <RoomThemeBackground theme={theme} />
      )}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-background/80 via-background/60 to-background/90" />

      <header className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/40 px-4 glass-heavy">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold">{roomName}</h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-500">
              <span className="size-1.5 rounded-full bg-red-500" />
              Trực tiếp
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {roleLabel} · {memberCount} người · {roomCode}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" className="rounded-full p-2 hover:bg-muted" onClick={() => toggleSheet("people")} aria-label="Thành viên">
            <Users className="size-4" />
          </button>
          <button type="button" className="rounded-full p-2 hover:bg-muted" onClick={() => setShareOpen(true)} aria-label="Chia sẻ">
            <Share2 className="size-4" />
          </button>
          {isHost && (
            <button type="button" className="rounded-full p-2 hover:bg-muted" onClick={() => toggleSheet("settings")} aria-label="Cài đặt">
              <Settings className="size-4" />
            </button>
          )}
          {isHost ? (
            <button
              type="button"
              className="rounded-full p-2 text-destructive hover:bg-destructive/10"
              aria-label="Đóng phòng"
              onClick={() => {
                if (window.confirm("Đóng phòng cho mọi người đang nghe?")) onCloseRoom();
              }}
            >
              <LogOut className="size-4" />
            </button>
          ) : (
            <button type="button" className="rounded-full p-2 hover:bg-muted" onClick={onLeaveRoom} aria-label="Rời phòng">
              <LogOut className="size-4" />
            </button>
          )}
        </div>
      </header>

      {disconnected && (
        <div className="relative z-20 flex items-center justify-center gap-2 bg-amber-500/15 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
          <WifiOff className="size-3.5" />
          Mất kết nối. Đang vào lại phòng...
        </div>
      )}

      <div className="relative z-10 grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3 lg:p-3">
        <section className="flex min-h-0 flex-col overflow-y-auto lg:overflow-hidden scrollbar-glass">
          <div className={cn("flex min-h-0 flex-1 flex-col", karaokeMode && "min-h-[70vh] lg:min-h-0")}>
            {karaokeMode ? (
              <div className="min-h-0 flex-1 p-3">
                <RoomKaraokeMode
                  videoId={currentKaraokeVideoId}
                  karaokeQueue={karaokeQueue}
                  currentSinger={currentSinger}
                  isHost={isHost}
                  canAdvance={canControl}
                  onAddQueue={onAddKaraokeQueue}
                  onNextSinger={onNextKaraokeSinger}
                  onShareRecording={onShareKaraokeRecording}
                />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center p-4">
                <div className="w-full max-w-md">
                  <RoomPlayer onPlayNext={onPlayNext} onTogglePause={onTogglePause} />
                </div>
              </div>
            )}
          </div>
          <div className="shrink-0 overflow-x-auto px-4 py-3">
            <ReactionButtons onReact={onSendReaction} />
          </div>
        </section>

        {showAside && <aside className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
          <section className="glass-frosted flex min-h-0 flex-1 flex-col rounded-3xl border border-border/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Hàng chờ</h2>
              {isHost && trackRequests.length > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                  {trackRequests.length} yêu cầu
                </span>
              )}
            </div>
            <div className="min-h-0 flex-1 flex flex-col overflow-hidden">{queueBody}</div>
          </section>
          <section className="glass-frosted flex min-h-0 flex-1 flex-col rounded-3xl border border-border/40 p-3">
            <h2 className="mb-2 text-sm font-semibold">Trò chuyện</h2>
            <div className="min-h-0 flex-1 flex flex-col overflow-hidden">{chatBody}</div>
          </section>
        </aside>}

        <AnimatePresence>
          {overlaySheet && renderSheet(
            overlaySheet,
            "absolute inset-0 z-40 flex items-end justify-center lg:items-center lg:p-4",
            !isDesktop
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showBottomNav && mobileSheet && renderSheet(
            mobileSheet,
            "absolute inset-0 z-40 flex items-end justify-center lg:items-center lg:p-4",
            !isDesktop
          )}
        </AnimatePresence>
      </div>

      {showBottomNav && <nav
        className={cn(
          "relative z-20 shrink-0 border-t border-border/40 glass-heavy transition-all",
          isDesktop && "mx-auto mb-6 w-full max-w-sm rounded-3xl border shadow-floating"
        )}
        style={{ paddingBottom: isDesktop ? undefined : "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="grid grid-cols-4">
          {([
            { id: "queue" as const, icon: ListMusic, label: "Hàng chờ", badge: isHost ? trackRequests.length : 0 },
            { id: "add" as const, icon: Plus, label: needsApproval ? "Yêu cầu" : "Thêm bài", badge: 0 },
            { id: "chat" as const, icon: MessageSquare, label: "Chat", badge: 0 },
            { id: "people" as const, icon: Users, label: "Mọi người", badge: 0 },
          ]).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleSheet(item.id)}
              className={cn(
                "flex flex-col items-center gap-1 py-2 text-[11px]",
                sheet === item.id ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className="relative">
                <item.icon className="size-5" />
                {item.badge > 0 && (
                  <span className="absolute -right-2 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {item.badge}
                  </span>
                )}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>}



      {shareOpen && (
        <RoomShareSheet roomCode={roomCode} isPublic={isPublic} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
};
