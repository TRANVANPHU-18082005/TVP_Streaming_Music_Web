// pages/client/MusicRoomPage.tsx
/**
 * Trang trong phòng nhạc.
 * Layout 3 cột: [Queue + Members] [Player + Reactions] [Chat]
 * Tuân theo design system index.css — dark/light mode, glass, tokens.
 */

import { useEffect, useRef, useState, type RefObject } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import { useRoomSocket } from "@/features/music-room/hooks/useRoomSocket";
import { useRoomChat } from "@/features/music-room/hooks/useRoomChat";
import {
  selectRoomError,
  selectRoomErrorCode,
  selectTrackRequests,
  setRoomError,
} from "@/features/music-room/store/roomSlice";
import type { MusicRoom, RoomTheme } from "@/features/music-room/types/room.types";
import { RoomShell } from "@/features/music-room/components/RoomShell";
import { RoomGate } from "@/features/music-room/components/RoomGate";
import { getRoomByCode } from "@/features/music-room/api/room.api";
import { useRoomMutations } from "@/features/music-room/hooks/useRoomMutations";
import { useSocket } from "@/hooks/useSocket";
import { RoomErrorCode } from "@/config/constants";
import { setIsPlaying } from "@/features/player/slice/playerSlice";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const selectAuth = (state: any) => state.auth.user;



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
    toggleKaraokeMode,
    addKaraokeQueue,
    nextKaraokeSinger,
    shareKaraokeRecording,
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
  const [preview, setPreview] = useState<MusicRoom | null>(null);
  const [showMemberJoin, setShowMemberJoin] = useState(false);
  const memberEnteredRef = useRef(false);

  useEffect(() => {
    dispatch(setIsPlaying(false));
  }, [dispatch]);

  // Host vào thẳng bàn điều khiển. Thành viên dừng ở màn tham gia.
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
        setPreview(room);
        if (!room.isPublic) {
          setNeedPassword(true);
          return;
        }
        const hostId = typeof room.host === "object" ? room.host?._id : room.host;
        const viewerId = currentUser._id || currentUser.id;
        const isRoomHost = Boolean(hostId && viewerId && String(hostId) === String(viewerId));
        if (isRoomHost || memberEnteredRef.current) {
          setShowMemberJoin(false);
          joinRoom();
        } else {
          setShowMemberJoin(true);
        }
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, currentUser, isConnected, dispatch, joinRoom, errorCode]);

  const enterRoom = (password?: string) => {
    memberEnteredRef.current = true;
    setShowMemberJoin(false);
    dispatch(setRoomError(null));
    setNeedPassword(false);
    joinRoom(password);
  };

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

  const backToRooms = () => navigate("/rooms");

  if (!currentUser) {
    return (
      <RoomGate
        kind="login"
        title="Cần đăng nhập"
        description="Đăng nhập để nghe cùng phòng, bình chọn và nhắn tin."
        primaryLabel="Đăng nhập"
        onPrimary={() => navigate(`/login?next=/rooms/${roomCode}`)}
        onBack={backToRooms}
      />
    );
  }

  if (needPassword || errorCode === RoomErrorCode.WRONG_PASSWORD) {
    return (
      <RoomGate
        kind="password"
        title="Phòng riêng tư"
        description="Nhập mật khẩu để vào phòng này."
        password={passwordPrompt}
        onPasswordChange={setPasswordPrompt}
        primaryLabel="Vào phòng"
        onPrimary={() => enterRoom(passwordPrompt)}
        onBack={backToRooms}
        backLabel="Quay lại"
      />
    );
  }

  if (!currentRoom && errorCode === RoomErrorCode.ROOM_FULL) {
    return (
      <RoomGate
        kind="full"
        title="Phòng đã đầy"
        description="Hãy thử phòng khác hoặc quay lại sau."
        primaryLabel="Về danh sách phòng"
        onPrimary={backToRooms}
      />
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
      <RoomGate
        kind="blocked"
        title={title}
        description={error}
        primaryLabel="Về danh sách phòng"
        onPrimary={backToRooms}
      />
    );
  }

  if (showMemberJoin && preview && !currentRoom) {
    return (
      <RoomGate
        kind="join"
        title={preview.name}
        description="Bạn sẽ nghe cùng phòng, bình chọn và nhắn tin. Chủ phòng giữ quyền phát và bài tiếp theo."
        room={preview}
        primaryLabel="Tham gia phòng"
        onPrimary={() => enterRoom()}
        onBack={backToRooms}
        backLabel="Quay lại danh sách phòng"
      />
    );
  }

  if (!currentRoom) {
    return (
      <RoomGate
        kind="loading"
        title={!isConnected ? "Mất kết nối. Đang vào lại phòng..." : "Đang vào phòng..."}
      />
    );
  }

  const roomView = currentRoom as typeof currentRoom & {
    currentTrack?: { moodVideo?: { videoUrl?: string } };
    currentMoodVideo?: { _id?: string; videoUrl?: string };
  };
  const moodVideoUrl = roomView.currentMoodVideo?.videoUrl
    || roomView.currentTrack?.moodVideo?.videoUrl
    || null;

  const hostId = typeof currentRoom.host === "object" ? currentRoom.host?._id : currentRoom.host;
  const theme = (currentRoom.theme ?? "bar") as RoomTheme;

  return (
    <RoomShell
      roomCode={roomCode ?? ""}
      roomName={currentRoom.name ?? roomCode ?? ""}
      theme={theme}
      memberCount={currentRoom.memberCount ?? 0}
      isHost={isHost}
      canControl={canControl}
      queueMode={currentRoom.queueMode ?? "open"}
      isPublic={currentRoom.isPublic !== false}
      messages={messages}
      chatEndRef={chatEndRef as RefObject<HTMLDivElement>}
      chatContainerRef={chatContainerRef as RefObject<HTMLDivElement>}
      isLoadingHistory={isLoadingHistory}
      hasMoreHistory={hasMoreHistory}
      onSendMessage={sendMessage}
      onLoadMoreHistory={loadMoreHistory}
      currentUserId={currentUser?._id || currentUser?.id}
      hostId={hostId}
      votedTracks={votedTracks}
      onVote={handleVote}
      onRemoveFromQueue={handleRemoveFromQueue}
      onPlayNext={playNext}
      onTogglePause={togglePause}
      onSendReaction={sendReaction}
      onLeaveRoom={() => {
        leaveRoom();
        navigate("/rooms");
      }}
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
      karaokeMode={Boolean(currentRoom.karaokeMode)}
      currentKaraokeVideoId={currentRoom.currentKaraokeVideoId}
      karaokeQueue={currentRoom.karaokeQueue ?? []}
      currentSinger={currentRoom.currentSinger}
      onToggleKaraokeMode={toggleKaraokeMode}
      onAddKaraokeQueue={addKaraokeQueue}
      onNextKaraokeSinger={nextKaraokeSinger}
      onShareKaraokeRecording={shareKaraokeRecording}
    />
  );
};

export default MusicRoomPage;
