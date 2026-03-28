// src/features/interaction/slice/interactionSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type InteractionTargetType = "track" | "album" | "playlist" | "artist";

interface InteractionState {
  // Dùng Record để truy xuất O(1)
  likedTracks: Record<string, boolean>;
  likedAlbums: Record<string, boolean>;
  likedPlaylists: Record<string, boolean>;
  followedArtists: Record<string, boolean>;
  loadingIds: Record<string, boolean>;
}

const initialState: InteractionState = {
  likedTracks: {},
  likedAlbums: {},
  likedPlaylists: {},
  followedArtists: {},
  loadingIds: {},
};

const MAP_NAMES = {
  track: "likedTracks",
  album: "likedAlbums",
  playlist: "likedPlaylists",
  artist: "followedArtists",
} as const;

export const interactionSlice = createSlice({
  name: "interaction",
  initialState,
  reducers: {
    // 🚀 NÂNG CẤP: Sync thông minh (Xóa stale, nạp fresh)
    syncInteractions: (
      state,
      action: PayloadAction<{
        interactedIds: string[];
        checkedIds: string[];
        targetType: InteractionTargetType;
      }>,
    ) => {
      const { interactedIds, checkedIds, targetType } = action.payload;
      const mapName = MAP_NAMES[targetType];

      // 1. Reset trạng thái của các ID vừa check (để đảm bảo tính nhất quán giữa các tab)
      checkedIds.forEach((id) => {
        delete state[mapName][id];
      });

      // 2. Map lại dữ liệu mới từ Server
      interactedIds.forEach((id) => {
        state[mapName][id] = true;
      });
    },

    // 🚀 NÂNG CẤP: Optimistic Toggle
    toggleOptimistic: (
      state,
      action: PayloadAction<{ id: string; targetType: InteractionTargetType }>,
    ) => {
      const { id, targetType } = action.payload;
      const mapName = MAP_NAMES[targetType];
      if (state[mapName][id]) delete state[mapName][id];
      else state[mapName][id] = true;
    },

    // 🚀 NÂNG CẤP: Set cụ thể (Dùng cho Rollback hoặc cập nhật chính xác)
    setInteractionStatus: (
      state,
      action: PayloadAction<{
        id: string;
        targetType: InteractionTargetType;
        status: boolean;
      }>,
    ) => {
      const { id, targetType, status } = action.payload;
      const mapName = MAP_NAMES[targetType];
      if (status) state[mapName][id] = true;
      else delete state[mapName][id];
    },

    setInteractionLoading: (
      state,
      action: PayloadAction<{ id: string; isLoading: boolean }>,
    ) => {
      if (action.payload.isLoading) state.loadingIds[action.payload.id] = true;
      else delete state.loadingIds[action.payload.id];
    },
    resetInteractions: () => initialState,
  },
});

export const {
  syncInteractions,
  toggleOptimistic,
  setInteractionStatus,
  setInteractionLoading,
  resetInteractions,
} = interactionSlice.actions;
export default interactionSlice.reducer;
