// pages/client/MusicRoomPage.tsx
/**
 * Trang trong phòng nhạc.
 * Layout 3 cột: [Queue + Members] [Player + Reactions] [Chat]
 * Tuân theo design system index.css — dark/light mode, glass, tokens.
 */

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import { Lock, LogIn } from "lucide-react";
import { motion } from "framer-motion";

import { useDispatch } from "react-redux";
import { useRoomSocket } from "@/features/music-room/hooks/useRoomSocket";
import { useRoomChat } from "@/features/music-room/hooks/useRoomChat";
import {
  selectCurrentRoom,
  selectRoomError,
  selectRoomErrorCode,
  selectTrackRequests,
  setRoomError,
} from "@/features/music-room/store/roomSlice";
import { type RoomTheme } from "@/features/music-room/types/room.types";
import { RoomShell } from "@/features/music-room/components/RoomShell";
import { getRoomByCode } from "@/features/music-room/api/room.api";
import { useRoomMutations } from "@/features/music-room/hooks/useRoomMutations";
import { useSocket } from "@/hooks/useSocket";
import { RoomErrorCode } from "@/config/constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const selectAuth = (state: any) => state.auth.user;



const SP = { type: "spring", stiffness: 340, damping: 28 } as const;

const MusicRoomPage = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentUser = useSelector(selectAuth);
  const { isConnected } = useSocket();

  const {
    joinRoom,
    leaveRoom,
    sendMessage,
    sendReaction,
    playNext,
    togglePause,
    voteTrack,
    requestTrack,
    handleRequest,
    changeTheme,
    handleChangeMoodVideo,
    currentRoom,
    isHost,
    canControl,
  } = useRoomSocket(roomCode);

  const { messages, chatEndRef, chatContainerRef, isLoadingHistory, hasMoreHistory, loadMoreHistory } =
    useRoomChat(roomCode);

  const error = useSelector(selectRoomError);
  const errorCode = useSelector(selectRoomErrorCode);
  const trackRequests = useSelector(selectTrackRequests);


  const [votedTracks, setVotedTracks] = useState<Set<string>>(new Set());
  const [passwordPrompt, setPasswordPrompt] = useState("");
  const [needPassword, setNeedPassword] = useState(false);

  const theme = (currentRoom?.theme ?? "bar") as RoomTheme;

  // Auto-join: đợi socket connect + user login trước khi join
  useEffect(() => {
    if (!roomCode) return;
    if (!currentUser) return;
    if (!isConnected) return;
    if (errorCode === RoomErrorCode.KICKED || errorCode === RoomErrorCode.ROOM_CLOSED) return;

    let isMounted = true;
    const tryJoin = async () => {
      try {
        const room = await getRoomByCode(roomCode);
        if (!isMounted) return;
        if (!room.isPublic) { setNeedPassword(true); return; }
        joinRoom();
      } catch (err: any) {
        if (!isMounted) return;
        const code = err?.response?.data?.errorCode as string | undefined;
        if (code === RoomErrorCode.WRONG_PASSWORD) {
          setNeedPassword(true);
          return;
        }
        if (code === RoomErrorCode.NOT_FOUND) {
          dispatch(setRoomError({
            message: err?.response?.data?.message ?? "Phòng không tồn tại hoặc đã đóng",
            errorCode: RoomErrorCode.NOT_FOUND,
          }));
          return;
        }
        joinRoom();
      }
    };
    tryJoin();
    return () => { 
      isMounted = false;
      leaveRoom(); 
    };
    // Chỉ re-run khi roomCode hoặc isConnected thay đổi (không phụ thuộc joinRoom/leaveRoom)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, currentUser, isConnected, dispatch, joinRoom, errorCode]);

  const handleVote = (trackId: string) => {
    voteTrack(trackId);
    setVotedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  };

  const { removeFromQueueAsync, deleteRoomAsync } = useRoomMutations();

  const handleRemoveFromQueue = async (trackId: string) => {
    if (!roomCode) return;
    try {
      await removeFromQueueAsync({ roomCode, trackId });
    } catch {
      // Error is handled by useRoomMutations
    }
  };

  // ── GUEST GATE — Hiển thị trước bất kỳ trạng thái nào khác ──
  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={SP}
          className="glass-frosted shadow-floating w-full max-w-sm rounded-3xl p-8 text-center"
        >
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary/20">
            <LogIn className="size-7 text-primary" />
          </div>
          <h2 className="text-display-lg text-foreground">Cần đăng nhập</h2>
          <p className="mt-2 text-sm text-muted-foreground mb-6">
            Vui lòng đăng nhập để tham gia phòng nhạc và cùng nghe với mọi người.
          </p>
          <button
            id="login-to-join-btn"
            onClick={() => navigate(`/login?next=/rooms/${roomCode}`)}
            className="pressable w-full rounded-xl py-3 text-sm font-semibold text-primary-foreground shadow-brand bg-primary"
          >
            Đăng nhập ngay
          </button>
          <button
            onClick={() => navigate("/rooms")}
            className="mt-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Quay lại danh sách phòng
          </button>
        </motion.div>
      </div>
    );
  }

  const submitPassword = () => {
    dispatch(setRoomError(null));
    setNeedPassword(false);
    joinRoom(passwordPrompt);
  };

  // ── PASSWORD GATE ──
  if (needPassword || errorCode === RoomErrorCode.WRONG_PASSWORD) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={SP}
          className="glass-frosted shadow-floating w-full max-w-sm rounded-3xl p-8 text-center"
        >
          <div
            className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary/20"
          >
            <Lock className="size-7 text-primary" />
          </div>
          <h2 className="text-display-lg text-foreground">Phòng riêng tư</h2>
          <p className="mt-2 text-sm text-muted-foreground mb-6">
            Nhập mật khẩu để vào phòng này
          </p>
          <input
            type="password"
            value={passwordPrompt}
            onChange={(e) => setPasswordPrompt(e.target.value)}
            placeholder="Mật khẩu..."
            className="mb-4 w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
            onKeyDown={(e) => {
              if (e.key === "Enter") submitPassword();
            }}
          />
          <button
            onClick={submitPassword}
            className="pressable w-full rounded-xl py-3 text-sm font-semibold text-primary-foreground shadow-brand bg-primary"
          >
            Vào phòng
          </button>
          <button
            onClick={() => navigate("/rooms")}
            className="mt-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Quay lại
          </button>
        </motion.div>
      </div>
    );
  }

  if (!currentRoom && errorCode === RoomErrorCode.ROOM_FULL) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-center">
        <h2 className="text-display-lg">Phòng đã đầy</h2>
        <p className="text-sm text-muted-foreground">Hãy thử phòng khác hoặc quay lại sau.</p>
        <button type="button" onClick={() => navigate("/rooms")} className="pressable rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground">
          Về danh sách phòng
        </button>
      </div>
    );
  }

  if (!currentRoom && error) {
    const title =
      errorCode === RoomErrorCode.KICKED
        ? "Bạn đã bị đưa khỏi phòng"
        : errorCode === RoomErrorCode.ROOM_CLOSED || errorCode === RoomErrorCode.NOT_FOUND
          ? "Phòng đã đóng"
          : "Không vào được phòng";
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-center">
        <h2 className="text-display-lg">{title}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
        <button type="button" onClick={() => navigate("/rooms")} className="pressable rounded-xl bg-muted px-6 py-2.5 text-sm font-medium text-foreground">
          Về danh sách phòng
        </button>
      </div>
    );
  }

  if (!isConnected || !currentRoom) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-sm text-muted-foreground">
          {!isConnected ? "Mất kết nối. Đang vào lại phòng..." : "Đang vào phòng..."}
        </p>
        <div className="spinner" />
      </div>
    );
  }

  const roomView = currentRoom as typeof currentRoom & {
    currentTrack?: { moodVideo?: { videoUrl?: string } };
    currentMoodVideo?: { _id?: string; videoUrl?: string };
  };
  const moodVideoUrl = roomView.currentMoodVideo?.videoUrl
    || roomView.currentTrack?.moodVideo?.videoUrl
    || null;

  return (
    <RoomShell
      roomCode={roomCode ?? ""}
      roomName={currentRoom.name ?? roomCode ?? ""}
      theme={theme}
      memberCount={currentRoom.memberCount ?? 0}
      isHost={isHost}
      canControl={canControl}
      queueMode={currentRoom.queueMode ?? "open"}
      messages={messages}
      chatEndRef={chatEndRef}
      chatContainerRef={chatContainerRef}
      isLoadingHistory={isLoadingHistory}
      hasMoreHistory={hasMoreHistory}
      onSendMessage={sendMessage}
      onLoadMoreHistory={loadMoreHistory}
      currentUserId={currentUser?._id}
      votedTracks={votedTracks}
      onVote={handleVote}
      onRemoveFromQueue={handleRemoveFromQueue}
      onPlayNext={playNext}
      onTogglePause={togglePause}
      onSendReaction={sendReaction}
      onLeaveRoom={() => { leaveRoom(); navigate("/rooms"); }}
      onCloseRoom={() => {
        if (!roomCode) return;
        void deleteRoomAsync(roomCode).then(() => navigate("/rooms"));
      }}
      onRequestTrack={requestTrack}
      trackRequests={trackRequests}
      onHandleRequest={handleRequest}
      onChangeTheme={changeTheme}
      onChangeMoodVideo={handleChangeMoodVideo}
      currentMoodVideoId={roomView.currentMoodVideo?._id ?? null}
      moodVideoUrl={moodVideoUrl}
      disconnected={!isConnected}
    />
  );
};

export default MusicRoomPage;
