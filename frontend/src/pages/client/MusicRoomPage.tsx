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

import { useRoomSocket } from "@/features/music-room/hooks/useRoomSocket";
import { useRoomChat } from "@/features/music-room/hooks/useRoomChat";
import {
  selectCurrentRoom,
  selectIsJoining,
  selectRoomError,
  selectTrackRequests,
  selectPlaybackState,
} from "@/features/music-room/store/roomSlice";
import { ROOM_THEMES } from "@/features/music-room/types/room.types";

import RoomThemeBackground from "@/features/music-room/components/RoomThemeBackground";
import RoomReactions from "@/features/music-room/components/RoomReactions";
import { HostDashboard } from "@/features/music-room/components/HostDashboard";
import { ListenerView } from "@/features/music-room/components/ListenerView";

import { getRoomByCode } from "@/features/music-room/api/room.api";
import { useRoomMutations } from "@/features/music-room/hooks/useRoomMutations";
import { useSocket } from "@/hooks/useSocket";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const selectAuth = (state: any) => state.auth.user;



const SP = { type: "spring", stiffness: 340, damping: 28 } as const;

const MusicRoomPage = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
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
  } = useRoomSocket(roomCode);

  const { messages, chatEndRef, chatContainerRef, isLoadingHistory, hasMoreHistory, loadMoreHistory } =
    useRoomChat(roomCode);

  const isJoining = useSelector(selectIsJoining);
  const error = useSelector(selectRoomError);
  const trackRequests = useSelector(selectTrackRequests);
  const playbackState = useSelector(selectPlaybackState);


  const [votedTracks, setVotedTracks] = useState<Set<string>>(new Set());
  const [passwordPrompt, setPasswordPrompt] = useState("");
  const [needPassword, setNeedPassword] = useState(false);

  const theme = (currentRoom?.theme ?? "bar") as keyof typeof ROOM_THEMES;
  const accentColor = ROOM_THEMES[theme].accent;

  // Auto-join: đợi socket connect + user login trước khi join
  useEffect(() => {
    if (!roomCode) return;
    // Guest chưa login — không join, guard sẽ redirect
    if (!currentUser) return;
    // Đợi socket sẵn sàng
    if (!isConnected) return;

    let isMounted = true;
    const tryJoin = async () => {
      try {
        const room = await getRoomByCode(roomCode);
        if (!isMounted) return;
        if (!room.isPublic) { setNeedPassword(true); return; }
        joinRoom();
      } catch {
        if (!isMounted) return;
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
  }, [roomCode, currentUser, isConnected]);

  const handleVote = (trackId: string) => {
    voteTrack(trackId);
    setVotedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  };

  const { removeFromQueueAsync } = useRoomMutations();

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

  // ── PASSWORD GATE ──
  if (needPassword) {
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
              if (e.key === "Enter") { setNeedPassword(false); joinRoom(passwordPrompt); }
            }}
          />
          <button
            onClick={() => { setNeedPassword(false); joinRoom(passwordPrompt); }}
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

  // ── LOADING ──
  if (isJoining && !currentRoom) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <div
          className="flex size-16 items-center justify-center rounded-2xl shadow-glow-md bg-primary/20"
        >
          <span className="text-3xl animate-bounce">🎵</span>
        </div>
        <p className="text-muted-foreground text-sm">Đang vào phòng...</p>
        <div className="spinner" />
      </div>
    );
  }

  // ── ERROR ──
  if (!currentRoom && error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-center">
        <div className="glass-frosted shadow-elevated flex size-20 items-center justify-center rounded-3xl text-4xl">
          ❌
        </div>
        <p className="text-muted-foreground">{error}</p>
        <button
          onClick={() => navigate("/rooms")}
          className="pressable rounded-xl bg-muted px-6 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
        >
          ← Quay lại danh sách
        </button>
      </div>
    );
  }

  const hostId = typeof currentRoom?.host === 'object' ? (currentRoom.host as any)._id : currentRoom?.host;

  const commonProps = {
    roomCode: roomCode ?? "",
    roomName: currentRoom?.name ?? roomCode ?? "",
    themeAccent: accentColor,
    memberCount: currentRoom?.memberCount ?? 0,
    messages,
    chatEndRef,
    chatContainerRef,
    isLoadingHistory,
    hasMoreHistory,
    onSendMessage: sendMessage,
    onLoadMoreHistory: loadMoreHistory,
    currentUserId: currentUser?._id,
    hostId,
    votedTracks,
    onVote: handleVote,
    onSendReaction: sendReaction,
    onLeaveRoom: () => { leaveRoom(); navigate("/rooms"); },
  };

  if (isHost) {
    return (
      <HostDashboard
        {...commonProps}
        onRemoveFromQueue={handleRemoveFromQueue}
        onPlayNext={playNext}
        onTogglePause={togglePause}
        trackRequests={trackRequests}
        onHandleRequest={handleRequest}
        onChangeTheme={changeTheme}
        currentTheme={theme}
        onChangeMoodVideo={handleChangeMoodVideo}
        currentMoodVideoId={(currentRoom as any)?.currentMoodVideo?._id ?? null}
      />
    );
  }

  // Lấy video URL từ phòng (Host set), bài hát hiện tại, hoặc fallback theo theme
  const currentRoomObj = currentRoom as any;
  const currentTrackObj = currentRoomObj?.currentTrack;
  const moodVideoUrl = currentRoomObj?.currentMoodVideo?.videoUrl 
    || currentTrackObj?.moodVideo?.videoUrl 
    || null;

  return (
    <ListenerView
      {...commonProps}
      onRequestTrack={requestTrack}
      currentTrack={currentTrackObj}
      playbackState={playbackState}
      moodVideoUrl={moodVideoUrl}
    />
  );
};

export default MusicRoomPage;
