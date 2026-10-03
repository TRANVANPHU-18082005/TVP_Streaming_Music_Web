// features/music-room/store/roomSlice.ts

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "@/store/store";
import type {
  MusicRoom,
  QueueItem,
  RoomMessage,
  PlaybackState,
  FloatingReaction,
  RoomTheme,
  TrackRequest,
} from "../types/room.types";

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────

interface RoomState {
  // Thông tin phòng hiện tại
  currentRoom: Pick<
    MusicRoom,
    "roomCode" | "name" | "theme" | "host" | "isPublic" | "memberCount" | "queue" | "queueMode"
  > & {
    coHosts?: string[];
    currentTrack?: any;
    currentMoodVideo?: any;
    karaokeMode?: boolean;
    karaokeQueue?: any[];
    currentKaraokeVideoId?: string;
    currentSinger?: any;
  } | null;

  // Quyền trong phòng
  isHost: boolean;
  isCoHost: boolean;
  clockOffsetMs: number;

  // Playback
  playbackState: PlaybackState | null;

  // Chat
  messages: RoomMessage[];
  hasMoreMessages: boolean;

  // UI
  floatingReactions: FloatingReaction[];
  isJoining: boolean;
  error: string | null;
  errorCode: string | null;

  // Của riêng Host
  trackRequests: TrackRequest[];

  // Danh sách phòng khám phá
  publicRooms: MusicRoom[];
  publicRoomsTotal: number;
  publicRoomsPage: number;
}

const idOf = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object" && "_id" in value) return idOf((value as { _id: unknown })._id);
  return "";
};

const initialState: RoomState = {
  currentRoom: null,
  isHost: false,
  isCoHost: false,
  clockOffsetMs: 0,
  playbackState: null,
  messages: [],
  hasMoreMessages: true,
  floatingReactions: [],
  isJoining: false,
  error: null,
  errorCode: null,
  trackRequests: [],
  publicRooms: [],
  publicRoomsTotal: 0,
  publicRoomsPage: 1,
};

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const roomSlice = createSlice({
  name: "room",
  initialState,
  reducers: {
    // ── Join / Leave ──────────────────────────────────────────────────────────

    setJoining(state, action: PayloadAction<boolean>) {
      state.isJoining = action.payload;
    },

    setRoomState: (
      state,
      action: PayloadAction<{
        room: RoomState["currentRoom"];
        playbackState: PlaybackState;
        isHost: boolean;
        isCoHost?: boolean;
      }>,
    ) => {
      state.isJoining = false;
      state.error = null;
      state.errorCode = null;
      state.currentRoom = action.payload.room;
      state.playbackState = action.payload.playbackState;
      state.isHost = action.payload.isHost;
      state.isCoHost = Boolean(action.payload.isCoHost);
      if (typeof action.payload.playbackState?.serverNow === "number") {
        state.clockOffsetMs = action.payload.playbackState.serverNow - Date.now();
      }
      state.messages = [];
      state.trackRequests = [];
    },

    leaveRoom(state) {
      state.currentRoom = null;
      state.playbackState = null;
      state.isHost = false;
      state.isCoHost = false;
      state.clockOffsetMs = 0;
      state.messages = [];
      state.hasMoreMessages = true;
      state.floatingReactions = [];
      state.error = null;
      state.errorCode = null;
    },

    // ── Members ──────────────────────────────────────────────────────────────

    updateMemberCount(state, action: PayloadAction<number>) {
      if (state.currentRoom) {
        state.currentRoom.memberCount = action.payload;
      }
    },

    setNewHost(state, action: PayloadAction<{ newHostId: string; currentUserId?: string }>) {
      const newHostId = idOf(action.payload.newHostId);
      const currentUserId =
        action.payload.currentUserId == null ? undefined : idOf(action.payload.currentUserId);
      if (state.currentRoom && newHostId) {
        // room:state gửi host là chuỗi id. Gán host._id lên chuỗi làm reducer throw
        // và Immer hủy cả lần cập nhật isHost, nên layout không đổi theo vai trò.
        const host = state.currentRoom.host as unknown;
        if (host && typeof host === "object") {
          (state.currentRoom.host as { _id: string })._id = newHostId;
        } else {
          (state.currentRoom as unknown as { host: string }).host = newHostId;
        }
        if (state.currentRoom.coHosts?.length) {
          state.currentRoom.coHosts = state.currentRoom.coHosts.filter((id) => idOf(id) !== newHostId);
        }
      }
      if (currentUserId !== undefined && newHostId) {
        const nowHost = newHostId === currentUserId;
        state.isHost = nowHost;
        if (nowHost) state.isCoHost = false;
        else state.trackRequests = [];
      }
    },

    // ── Playback ─────────────────────────────────────────────────────────────

    updatePlaybackState(state, action: PayloadAction<PlaybackState & { track?: any }>) {
      state.playbackState = action.payload;
      if (typeof action.payload.serverNow === "number") {
        state.clockOffsetMs = action.payload.serverNow - Date.now();
      }
      if (action.payload.track && state.currentRoom) {
        (state.currentRoom as any).currentTrack = action.payload.track;
      }
    },

    setCoHosts(state, action: PayloadAction<{ coHosts: string[]; currentUserId?: string }>) {
      if (state.currentRoom) state.currentRoom.coHosts = action.payload.coHosts;
      if (action.payload.currentUserId) {
        state.isCoHost =
          !state.isHost && action.payload.coHosts.includes(action.payload.currentUserId);
      }
    },

    setQueueMode(state, action: PayloadAction<"open" | "approval">) {
      if (state.currentRoom) state.currentRoom.queueMode = action.payload;
    },

    // ── Queue ────────────────────────────────────────────────────────────────

    setQueue(state, action: PayloadAction<QueueItem[]>) {
      if (state.currentRoom) {
        state.currentRoom.queue = action.payload;
      }
    },

    themeUpdated: (state, action: PayloadAction<RoomTheme>) => {
      if (state.currentRoom) {
        state.currentRoom.theme = action.payload;
      }
    },
    moodVideoUpdated: (state, action: PayloadAction<any>) => {
      if (state.currentRoom) {
        state.currentRoom.currentMoodVideo = action.payload;
      }
    },

    setTrackRequests(state, action: PayloadAction<TrackRequest[]>) {
      state.trackRequests = action.payload;
    },

    setRoomTheme(state, action: PayloadAction<string>) {
      if (state.currentRoom) {
        state.currentRoom.theme = action.payload as any;
      }
    },

    // ── Karaoke ──────────────────────────────────────────────────────────────
    setKaraokeMode(state, action: PayloadAction<boolean>) {
      if (state.currentRoom) {
        state.currentRoom.karaokeMode = action.payload;
        if (!action.payload) {
          state.currentRoom.currentKaraokeVideoId = "";
          state.currentRoom.currentSinger = undefined;
          state.currentRoom.karaokeQueue = [];
        }
      }
    },
    appendKaraokeQueue(state, action: PayloadAction<any>) {
      if (state.currentRoom) {
        if (!state.currentRoom.karaokeQueue) {
           state.currentRoom.karaokeQueue = [];
        }
        state.currentRoom.karaokeQueue.push(action.payload);
      }
    },
    setNextKaraokeSinger(state, action: PayloadAction<{ videoId: string, singer: any }>) {
      if (state.currentRoom) {
        state.currentRoom.currentKaraokeVideoId = action.payload.videoId;
        state.currentRoom.currentSinger = action.payload.singer;
        if (state.currentRoom.karaokeQueue && state.currentRoom.karaokeQueue.length > 0) {
           state.currentRoom.karaokeQueue.shift();
        }
      }
    },
    setKaraokeEnded(state) {
      if (state.currentRoom) {
        state.currentRoom.currentKaraokeVideoId = "";
        state.currentRoom.currentSinger = undefined;
      }
    },

    // ── Chat ─────────────────────────────────────────────────────────────────

    prependMessages(state, action: PayloadAction<RoomMessage[]>) {
      // Thêm messages cũ vào đầu (phân trang ngược)
      state.messages = [...action.payload, ...state.messages];
      if (action.payload.length === 0) {
        state.hasMoreMessages = false;
      }
    },

    appendMessage(state, action: PayloadAction<RoomMessage>) {
      // Tin nhắn realtime mới → thêm vào cuối
      state.messages = [...state.messages, action.payload];
      // Giới hạn 500 tin nhắn trong memory
      if (state.messages.length > 500) {
        state.messages = state.messages.slice(-500);
      }
    },

    // ── Reactions ────────────────────────────────────────────────────────────

    addFloatingReaction(state, action: PayloadAction<FloatingReaction>) {
      state.floatingReactions = [...state.floatingReactions, action.payload];
    },

    removeFloatingReaction(state, action: PayloadAction<string>) {
      state.floatingReactions = state.floatingReactions.filter(
        (r) => r.id !== action.payload,
      );
    },

    // ── Error ────────────────────────────────────────────────────────────────

    setRoomError(
      state,
      action: PayloadAction<{ message: string; errorCode?: string } | string | null>,
    ) {
      if (action.payload == null) {
        state.error = null;
        state.errorCode = null;
      } else if (typeof action.payload === "string") {
        state.error = action.payload;
        state.errorCode = null;
      } else {
        state.error = action.payload.message;
        state.errorCode = action.payload.errorCode ?? null;
      }
      state.isJoining = false;
    },

    // ── Public Rooms ─────────────────────────────────────────────────────────

    setPublicRooms(
      state,
      action: PayloadAction<{
        rooms: MusicRoom[];
        total: number;
        page: number;
        append?: boolean;
      }>,
    ) {
      const { rooms, total, page, append } = action.payload;
      state.publicRooms = append ? [...state.publicRooms, ...rooms] : rooms;
      state.publicRoomsTotal = total;
      state.publicRoomsPage = page;
    },

    updatePublicRoomMemberCount(
      state,
      action: PayloadAction<{ roomCode: string; count: number }>,
    ) {
      const room = state.publicRooms.find(
        (r) => r.roomCode === action.payload.roomCode,
      );
      if (room) room.memberCount = action.payload.count;
    },
  },
});

export const {
  setJoining,
  setRoomState,
  leaveRoom,
  updateMemberCount,
  setNewHost,
  updatePlaybackState,
  setQueue,
  prependMessages,
  appendMessage,
  addFloatingReaction,
  removeFloatingReaction,
  setRoomError,
  setPublicRooms,
  updatePublicRoomMemberCount,
  setCoHosts,
  setQueueMode,
  setTrackRequests,
  setRoomTheme,
  moodVideoUpdated,
  setKaraokeMode,
  appendKaraokeQueue,
  setNextKaraokeSinger,
  setKaraokeEnded,
} = roomSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

export const selectCurrentRoom = (state: RootState) => state.room.currentRoom;
export const selectPlaybackState = (state: RootState) => state.room.playbackState;
export const selectIsHost = (state: RootState) => state.room.isHost;
export const selectIsCoHost = (state: RootState) => state.room.isCoHost;
export const selectCanControlPlayback = (state: RootState) =>
  state.room.isHost || state.room.isCoHost;
export const selectClockOffsetMs = (state: RootState) => state.room.clockOffsetMs;
export const selectRoomErrorCode = (state: RootState) => state.room.errorCode;
export const selectRoomMessages = (state: RootState) => state.room.messages;
export const selectFloatingReactions = (state: RootState) => state.room.floatingReactions;
export const selectPublicRooms = (state: RootState) => state.room.publicRooms;
export const selectRoomError = (state: RootState) => state.room.error;
export const selectIsJoining = (state: RootState) => state.room.isJoining;
export const selectRoomQueue = (state: RootState) =>
  state.room.currentRoom?.queue ?? [];
export const selectTrackRequests = (state: RootState) => state.room.trackRequests;
export const selectKaraokeMode = (state: RootState) => state.room.currentRoom?.karaokeMode ?? false;
export const selectKaraokeQueue = (state: RootState) => state.room.currentRoom?.karaokeQueue ?? [];
export const selectCurrentKaraokeVideoId = (state: RootState) => state.room.currentRoom?.currentKaraokeVideoId;
export const selectCurrentSinger = (state: RootState) => state.room.currentRoom?.currentSinger;

export default roomSlice.reducer;
