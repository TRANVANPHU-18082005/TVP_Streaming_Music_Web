import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { ListMusic, LogOut, MessageSquare, Settings, Share2, Users, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import RoomThemeBackground from "./RoomThemeBackground";
import RoomReactions, { ReactionButtons } from "./RoomReactions";
import RoomPlayer from "./RoomPlayer";
import RoomQueue from "./RoomQueue";
import RoomChat from "./RoomChat";
import { RoomAddTrack } from "./RoomAddTrack";
import RoomMoodVideoSelector from "./RoomMoodVideoSelector";
import { RoomShareSheet } from "./RoomShareSheet";
import { ROOM_THEMES, type QueueMode, type RoomMessage, type RoomTheme, type TrackRequest } from "../types/room.types";
import { selectCurrentRoom } from "../store/roomSlice";
import { addCollectionToQueue, assignHost, getMembers, kickUser, setCoHost, updateRoomSettings, type RoomMember } from "../api/room.api";
import { searchApi } from "@/features/search";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

type Sheet = "queue" | "chat" | "people" | "settings" | null;

interface Props {
  roomCode: string;
  roomName: string;
  theme: RoomTheme;
  memberCount: number;
  isHost: boolean;
  canControl: boolean;
  queueMode: QueueMode;
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
}

export const RoomShell = ({
  roomCode,
  roomName,
  theme,
  memberCount,
  isHost,
  canControl,
  queueMode,
  messages,
  chatEndRef,
  chatContainerRef,
  isLoadingHistory,
  hasMoreHistory,
  onSendMessage,
  onLoadMoreHistory,
  currentUserId,
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
}: Props) => {
  const currentRoom = useSelector(selectCurrentRoom);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [playlistQuery, setPlaylistQuery] = useState("");
  const debouncedPlaylist = useDebounce(playlistQuery, 400);
  const [collections, setCollections] = useState<{ id: string; title: string; kind: "playlist" | "album" }[]>([]);
  const accent = ROOM_THEMES[theme].accent;
  const needsApproval = queueMode === "approval" && !canControl;
  const canAddCollection = queueMode === "open" || canControl;

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
  }, [roomCode, memberCount]);

  useEffect(() => {
    if (!debouncedPlaylist.trim()) {
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
  }, [debouncedPlaylist]);

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
      toast.success(next === "open" ? "Mọi người có thể thêm bài" : "Bài mới cần host duyệt");
    } catch {
      toast.error("Không đổi được chế độ hàng chờ");
    }
  };

  const toggleCoHost = async (member: RoomMember) => {
    try {
      await setCoHost(roomCode, member.userId, !member.isCoHost);
    } catch {
      toast.error("Không cập nhật được co-host");
    }
  };

  const panel = (name: Sheet, title: string, body: ReactNode) => (
    <section className={cn("flex min-h-0 flex-col rounded-3xl border border-border/40 bg-background/70 p-3", sheet === name || "max-lg:hidden")}>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
    </section>
  );

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <RoomReactions />
      {moodVideoUrl ? (
        <video
          key={moodVideoUrl}
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover opacity-40"
          src={moodVideoUrl}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <RoomThemeBackground theme={theme} />
      )}

      <header className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/40 px-4 glass-heavy">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-bold">{roomName}</h1>
            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-500">LIVE</span>
            {canControl && !isHost && <span className="text-[10px] font-semibold text-primary">Co-host</span>}
          </div>
          <p className="text-xs text-muted-foreground">{memberCount} người · {roomCode}</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="rounded-full p-2 hover:bg-muted lg:hidden" onClick={() => setSheet(sheet === "queue" ? null : "queue")} aria-label="Hàng chờ">
            <ListMusic className="size-4" />
          </button>
          <button type="button" className="rounded-full p-2 hover:bg-muted lg:hidden" onClick={() => setSheet(sheet === "chat" ? null : "chat")} aria-label="Chat">
            <MessageSquare className="size-4" />
          </button>
          <button type="button" className="rounded-full p-2 hover:bg-muted" onClick={() => setSheet(sheet === "people" ? null : "people")} aria-label="Thành viên">
            <Users className="size-4" />
          </button>
          <button type="button" className="rounded-full p-2 hover:bg-muted" onClick={() => setShareOpen(true)} aria-label="Chia sẻ">
            <Share2 className="size-4" />
          </button>
          {isHost && (
            <button type="button" className="rounded-full p-2 hover:bg-muted" onClick={() => setSheet(sheet === "settings" ? null : "settings")} aria-label="Cài đặt">
              <Settings className="size-4" />
            </button>
          )}
          <button type="button" className="rounded-full p-2 hover:bg-muted" onClick={onLeaveRoom} aria-label="Rời phòng">
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      {disconnected && (
        <div className="relative z-20 flex items-center justify-center gap-2 bg-amber-500/15 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
          <WifiOff className="size-3.5" />
          Mất kết nối. Đang vào lại phòng...
        </div>
      )}

      <div className="relative z-10 grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1.1fr)_320px_320px]">
        <section className={cn("flex min-h-0 flex-col items-center justify-center gap-4", sheet && "max-lg:hidden")}>
          <RoomPlayer onPlayNext={onPlayNext} onTogglePause={onTogglePause} />
          <ReactionButtons onReact={onSendReaction} />
        </section>

        {panel("queue", "Hàng chờ", (
          <>
            <RoomAddTrack roomCode={roomCode} isListener={needsApproval} onRequest={onRequestTrack} />
            {canAddCollection && (
              <div className="relative mb-3">
                <input
                  value={playlistQuery}
                  onChange={(event) => setPlaylistQuery(event.target.value)}
                  placeholder="Thêm playlist hoặc album"
                  className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none"
                />
                {collections.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-xl border border-border bg-background shadow-floating">
                    {collections.map((item) => (
                      <button key={`${item.kind}-${item.id}`} type="button" className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => void addCollection(item)}>
                        {item.kind === "album" ? "Album" : "Playlist"} · {item.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {isHost && trackRequests.length > 0 && (
              <ul className="mb-3 space-y-2">
                {trackRequests.map((request) => (
                  <li key={request.trackId} className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm">
                    <span className="truncate">{request.trackTitle}</span>
                    <span className="flex gap-2">
                      <button type="button" className="text-primary" onClick={() => onHandleRequest(request.trackId, "approve")}>Duyệt</button>
                      <button type="button" className="text-muted-foreground" onClick={() => onHandleRequest(request.trackId, "reject")}>Bỏ</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <RoomQueue
              onVote={onVote}
              onRemove={isHost ? onRemoveFromQueue : undefined}
              votedTracks={votedTracks}
              isListener
            />
          </>
        ))}

        {panel("chat", "Trò chuyện", (
          <RoomChat
            messages={messages}
            onSendMessage={onSendMessage}
            chatEndRef={chatEndRef as React.RefObject<HTMLDivElement>}
            chatContainerRef={chatContainerRef as React.RefObject<HTMLDivElement>}
            isLoadingHistory={isLoadingHistory}
            hasMoreHistory={hasMoreHistory}
            onLoadMore={onLoadMoreHistory}
            accentColor={accent}
            currentUserId={currentUserId}
          />
        ))}
      </div>

      {sheet === "people" && (
        <div className="absolute inset-x-3 bottom-3 z-30 max-h-[60vh] overflow-y-auto rounded-3xl border border-border bg-background p-4 shadow-floating">
          <h2 className="mb-3 text-sm font-semibold">Đang trong phòng</h2>
          {members.length === 0 && <p className="text-sm text-muted-foreground">Chưa tải được danh sách.</p>}
          <ul className="space-y-2">
            {members.map((member) => (
              <li key={member.userId} className="flex items-center justify-between gap-2">
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
                  <span className="flex shrink-0 gap-2">
                    <button type="button" className="text-xs text-primary" onClick={() => void assignHost(roomCode, member.userId).catch(() => toast.error("Không chuyển được host"))}>
                      Chuyển host
                    </button>
                    <button type="button" className="text-xs text-primary" onClick={() => void toggleCoHost(member)}>
                      {member.isCoHost ? "Gỡ co-host" : "Cho co-host"}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-destructive"
                      onClick={() => {
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
      )}

      {sheet === "settings" && isHost && (
        <div className="absolute inset-x-3 bottom-3 z-30 max-h-[70vh] overflow-y-auto rounded-3xl border border-border bg-background p-4 shadow-floating">
          <h2 className="mb-3 text-sm font-semibold">Cài đặt phòng</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {(Object.keys(ROOM_THEMES) as RoomTheme[]).map((key) => (
              <button key={key} type="button" onClick={() => onChangeTheme(key)} className="rounded-full px-3 py-1 text-xs" style={{ background: theme === key ? accent : "transparent", color: theme === key ? "#fff" : undefined }}>
                {ROOM_THEMES[key].label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void toggleQueueMode()} className="mb-3 w-full rounded-xl border border-border px-3 py-2 text-left text-sm">
            Hàng chờ: {queueMode === "open" ? "ai cũng thêm được" : "cần duyệt"}
          </button>
          <RoomMoodVideoSelector currentMoodVideoId={currentMoodVideoId} onChangeMoodVideo={onChangeMoodVideo} accentColor={accent} />
          <button type="button" onClick={onCloseRoom} className="mt-3 w-full rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Đóng phòng
          </button>
        </div>
      )}

      {shareOpen && (
        <RoomShareSheet roomCode={roomCode} isPublic={currentRoom?.isPublic !== false} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
};
