// features/music-room/hooks/useRoomSocket.ts
/**
 * Hook quản lý tất cả Socket.io events cho Music Room.
 * Tự động đăng ký/huỷ listeners khi mount/unmount.
 */

import { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useSocket } from "@/hooks/useSocket";
import {
  setRoomState,
  updateMemberCount,
  updatePlaybackState,
  setQueue,
  appendMessage,
  addFloatingReaction,
  removeFloatingReaction,
  setRoomError,
  leaveRoom,
  setNewHost,
  setTrackRequests,
  setRoomTheme,
  moodVideoUpdated,
  selectCurrentRoom,
  selectIsHost,
} from "../store/roomSlice";
import type { PlaybackState, FloatingReaction } from "../types/room.types";
import { useAppSelector } from "@/store/hooks";
import { RoomErrorCode } from "@/config/constants";

let reactionIdCounter = 0;

export const useRoomSocket = (roomCode: string | undefined) => {
  const { socket } = useSocket();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const currentRoom = useSelector(selectCurrentRoom);
  const isHost = useSelector(selectIsHost);
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?._id;
  // ── JOIN ──────────────────────────────────────────────────────────────────

  const joinRoom = useCallback(
    (password?: string) => {
      if (!socket || !roomCode) return;
      socket.emit("room:join", { roomCode, password });
    },
    [socket, roomCode],
  );

  // ── LEAVE ─────────────────────────────────────────────────────────────────

  const leaveRoomSocket = useCallback(() => {
    if (!socket || !roomCode) return;
    socket.emit("room:leave", { roomCode });
    dispatch(leaveRoom());
  }, [socket, roomCode, dispatch]);

  // ── CHAT ──────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    (content: string) => {
      if (!socket || !roomCode || !content.trim()) return;
      socket.emit("room:message", { roomCode, content: content.trim() });
    },
    [socket, roomCode],
  );

  // ── REACT ─────────────────────────────────────────────────────────────────

  const sendReaction = useCallback(
    (emoji: string) => {
      if (!socket || !roomCode) return;
      socket.emit("room:react", { roomCode, emoji });
    },
    [socket, roomCode],
  );

  // ── PLAYBACK (Host only) ──────────────────────────────────────────────────

  const playNext = useCallback(() => {
    if (!socket || !roomCode || !isHost) return;
    socket.emit("room:play_next", { roomCode });
  }, [socket, roomCode, isHost]);

  const togglePause = useCallback(
    (currentPosition: number) => {
      if (!socket || !roomCode || !isHost) return;
      socket.emit("room:toggle_pause", { roomCode, currentPosition });
    },
    [socket, roomCode, isHost],
  );

  // ── VOTE ──────────────────────────────────────────────────────────────────

  const voteTrack = useCallback(
    (trackId: string) => {
      if (!socket || !roomCode) return;
      socket.emit("room:vote", { roomCode, trackId });
    },
    [socket, roomCode],
  );

  // ── SOCKET EVENT LISTENERS ────────────────────────────────────────────────

  useEffect(() => {
    if (!socket) return;

    const onRoomState = (data: any) => {
      dispatch(setRoomState(data));
    };

    const onPlaybackUpdate = (state: PlaybackState) => {
      dispatch(updatePlaybackState(state));
    };

    const onQueueUpdate = ({ queue }: { queue: any[] }) => {
      dispatch(setQueue(queue));
    };

    const onMemberJoined = ({ memberCount }: { userId: string; memberCount: number }) => {
      dispatch(updateMemberCount(memberCount));
    };

    const onMemberLeft = ({ memberCount }: { userId: string; memberCount: number }) => {
      dispatch(updateMemberCount(memberCount));
    };

    const onNewMessage = (msg: any) => {
      dispatch(appendMessage(msg));
    };

    const onReaction = ({ emoji }: { userId: string; emoji: string }) => {
      const id = `reaction-${++reactionIdCounter}`;
      const reaction: FloatingReaction = {
        id,
        emoji,
        x: 10 + Math.random() * 80, // 10%-90% từ trái
      };
      dispatch(addFloatingReaction(reaction));
      // Tự xóa sau 3 giây
      setTimeout(() => dispatch(removeFloatingReaction(id)), 3000);
    };

    const onHostChanged = ({ newHostId }: { newHostId: string }) => {
      dispatch(setNewHost({ newHostId, currentUserId }));
      toast.info("Host mới đã được chỉ định");
    };

    const onTrackRequestList = (requests: any[]) => {
      dispatch(setTrackRequests(requests));
    };

    const onRoomClosed = ({ reason }: { roomCode: string; reason?: string }) => {
      dispatch(leaveRoom());
      toast.error(reason ?? "Phòng đã bị đóng");
      navigate("/rooms");
    };

    const onKicked = ({ reason }: { roomCode: string; reason?: string }) => {
      dispatch(leaveRoom());
      toast.error(reason ?? "Bạn đã bị kick khỏi phòng");
      navigate("/rooms");
    };

    const onError = ({ message, errorCode }: { message: string, errorCode: string }) => {
      // Lỗi "cần đăng nhập" → redirect thay vì hiển thị error thô
      if (errorCode === RoomErrorCode.UNAUTHORIZED) {
        dispatch(setRoomError(null));
        toast.error(message);
        navigate(`/login?next=/rooms/${roomCode ?? ""}`);
        return;
      }
      dispatch(setRoomError(message));
      toast.error(message);
    };

    const onThemeChanged = ({ theme }: { theme: string }) => {
      dispatch(setRoomTheme(theme as any));
      toast.success(`Host đã đổi không gian phòng`);
    };

    const onMoodVideoChanged = ({ currentMoodVideo }: { currentMoodVideo: any }) => {
      dispatch(moodVideoUpdated(currentMoodVideo));
    };

    const onUserMuted = ({ targetUserId }: { targetUserId: string }) => {
      if (targetUserId === currentUserId) {
        toast.error("Bạn đã bị cấm chat bởi Host");
      }
    };

    const onUserUnmuted = ({ targetUserId }: { targetUserId: string }) => {
      if (targetUserId === currentUserId) {
        toast.success("Host đã mở cấm chat cho bạn");
      }
    };

    const onQueueEmpty = ({ message }: { message: string }) => {
      toast.info(message, { duration: 5000 });
    };

    // Đăng ký listeners
    socket.on("room:state", onRoomState);
    socket.on("room:playback_update", onPlaybackUpdate);
    socket.on("room:queue_update", onQueueUpdate);
    socket.on("room:member_joined", onMemberJoined);
    socket.on("room:member_left", onMemberLeft);
    socket.on("room:new_message", onNewMessage);
    socket.on("room:reaction", onReaction);
    socket.on("room:host_changed", onHostChanged);
    socket.on("room:request_list", onTrackRequestList);
    socket.on("room:theme_changed", onThemeChanged);
    socket.on("room:mood_video_changed", onMoodVideoChanged);
    socket.on("room:user_muted", onUserMuted);
    socket.on("room:user_unmuted", onUserUnmuted);
    socket.on("room:queue_empty", onQueueEmpty);
    socket.on("room:closed", onRoomClosed);
    socket.on("room:kicked", onKicked);
    socket.on("room:error", onError);

    return () => {
      socket.off("room:state", onRoomState);
      socket.off("room:playback_update", onPlaybackUpdate);
      socket.off("room:queue_update", onQueueUpdate);
      socket.off("room:member_joined", onMemberJoined);
      socket.off("room:member_left", onMemberLeft);
      socket.off("room:new_message", onNewMessage);
      socket.off("room:reaction", onReaction);
      socket.off("room:host_changed", onHostChanged);
      socket.off("room:request_list", onTrackRequestList);
      socket.off("room:theme_changed", onThemeChanged);
      socket.off("room:mood_video_changed", onMoodVideoChanged);
      socket.off("room:user_muted", onUserMuted);
      socket.off("room:user_unmuted", onUserUnmuted);
      socket.off("room:queue_empty", onQueueEmpty);
      socket.off("room:closed", onRoomClosed);
      socket.off("room:kicked", onKicked);
      socket.off("room:error", onError);
    };
  }, [socket, dispatch, navigate, roomCode, currentUserId]);

  // Gửi request bài hát (Dành cho listener)
  const requestTrack = useCallback(
    (trackId: string) => {
      if (!socket || !roomCode || !trackId) return;
      socket.emit("room:request_track", { roomCode, trackId });
    },
    [socket, roomCode]
  );

  // Xử lý request (Dành cho host)
  const handleRequest = useCallback(
    (trackId: string, action: "approve" | "reject") => {
      if (!socket || !roomCode || !trackId) return;
      socket.emit("room:handle_request", { roomCode, trackId, action });
    },
    [socket, roomCode]
  );

  // Thay đổi theme phòng (Dành cho host)
  const changeTheme = useCallback(
    (theme: string) => {
      if (!socket || !roomCode || !theme) return;
      socket.emit("room:change_theme", { roomCode, theme });
    },
    [socket, roomCode]
  );

  const handleChangeMoodVideo = useCallback(
    (videoId: string | null) => {
      if (!socket || !roomCode) return;
      socket.emit("room:set_mood_video", { roomCode, videoId });
    },
    [socket, roomCode]
  );

  return {
    joinRoom,
    leaveRoom: leaveRoomSocket,
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
  };
};
