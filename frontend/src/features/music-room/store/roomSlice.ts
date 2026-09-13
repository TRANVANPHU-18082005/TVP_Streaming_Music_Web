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
    "roomCode" | "name" | "theme" | "host" | "isPublic" | "memberCount" | "queue"
  > & {
    currentTrack?: any;
    currentMoodVideo?: any;
  } | null;

  // Quyền trong phòng
  isHost: boolean;

  // Playback
  playbackState: PlaybackState | null;

  // Chat
  messages: RoomMessage[];
  hasMoreMessages: boolean;

  // UI
  floatingReactions: FloatingReaction[];
  isJoining: boolean;
  error: string | null;

  // Của riêng Host
  trackRequests: TrackRequest[];

  // Danh sách phòng khám phá
  publicRooms: MusicRoom[];
  publicRoomsTotal: number;
  publicRoomsPage: number;
}

const initialState: RoomState = {
  currentRoom: null,
  isHost: false,
  playbackState: null,
  messages: [],
  hasMoreMessages: true,
  floatingReactions: [],
  isJoining: false,
  error: null,
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
      }>,
    ) => {
      state.isJoining = false;
      state.error = null;
      state.currentRoom = action.payload.room;
      state.playbackState = action.payload.playbackState;
      state.isHost = action.payload.isHost;
      state.messages = [];
      state.trackRequests = [];
    },

    leaveRoom(state) {
      state.currentRoom = null;
      state.playbackState = null;
      state.isHost = false;
      state.messages = [];
      state.hasMoreMessages = true;
      state.floatingReactions = [];
      state.error = null;
    },

    // ── Members ──────────────────────────────────────────────────────────────

    updateMemberCount(state, action: PayloadAction<number>) {
      if (state.currentRoom) {
        state.currentRoom.memberCount = action.payload;
      }
    },

    setNewHost(state, action: PayloadAction<{ newHostId: string; currentUserId?: string }>) {
      const { newHostId, currentUserId } = action.payload;
      if (state.currentRoom) {
        (state.currentRoom.host as any)._id = newHostId;
      }
      // Bug 4 fix: Cập nhật isHost khi host mới được chỉ định
      if (currentUserId !== undefined) {
        state.isHost = newHostId === currentUserId;
      }
    },

    // ── Playback ─────────────────────────────────────────────────────────────

    updatePlaybackState(state, action: PayloadAction<PlaybackState & { track?: any }>) {
      state.playbackState = action.payload;
      if (action.payload.track && state.currentRoom) {
        (state.currentRoom as any).currentTrack = action.payload.track;
      }
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

    setRoomError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
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
  setTrackRequests,
  setRoomTheme,
  moodVideoUpdated,
} = roomSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

export const selectCurrentRoom = (state: RootState) => state.room.currentRoom;
export const selectPlaybackState = (state: RootState) => state.room.playbackState;
export const selectIsHost = (state: RootState) => state.room.isHost;
export const selectRoomMessages = (state: RootState) => state.room.messages;
export const selectFloatingReactions = (state: RootState) => state.room.floatingReactions;
export const selectPublicRooms = (state: RootState) => state.room.publicRooms;
export const selectRoomError = (state: RootState) => state.room.error;
export const selectIsJoining = (state: RootState) => state.room.isJoining;
export const selectRoomQueue = (state: RootState) =>
  state.room.currentRoom?.queue ?? [];
export const selectTrackRequests = (state: RootState) => state.room.trackRequests;

export default roomSlice.reducer;
