// src/features/interaction/slice/interactionSlice.ts
import { RootState } from "@/store/store";
import { createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit";

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

      // 1. Mặc định gán toàn bộ những ID vừa check là false (Đã check nhưng chưa Like)
      checkedIds.forEach((id) => {
        state[mapName][id] = false;
      });

      // 2. Bài nào thực sự Like thì ghi đè thành true
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
      if (state[mapName][id]) state[mapName][id] = false;
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
      else state[mapName][id] = false;
    },

    setInteractionLoading: (
      state,
      action: PayloadAction<{
        id: string;
        targetType: InteractionTargetType;
        isLoading: boolean;
      }>,
    ) => {
      const { id, targetType, isLoading } = action.payload;
      const compositeKey = `${targetType}:${id}`; // 🚀 TẠO KEY KẾT HỢP

      if (isLoading) state.loadingIds[compositeKey] = true;
      else delete state.loadingIds[compositeKey];
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
// 1. Input selector lấy ra toàn bộ state của slice interaction
const selectInteractionState = (state: RootState) => state.interaction;

// % 2. Output selector được memoize để lấy toàn bộ map (Dùng khi cần lấy cả cụm)
export const selectInteractionMap = createSelector(
  [selectInteractionState],
  (interaction) => ({
    track: interaction.likedTracks,
    album: interaction.likedAlbums,
    playlist: interaction.likedPlaylists,
    artist: interaction.followedArtists,
  }),
);

// 3. Selector kiểm tra trạng thái Loading tổng thể
export const selectInteractionLoading = (state: RootState) =>
  state.interaction.loadingIds;

// 4. TỐI ƯU: Plain Selector kiểm tra trạng thái ép về Boolean (Dùng trực tiếp tại Button con)
// Chuyển từ createSelector thành hàm thường để đạt tốc độ O(1) tuyệt đối trong .map()
export const selectIsInteracted = (
  state: RootState,
  id: string,
  targetType: InteractionTargetType,
): boolean => {
  const MAP_NAMES = {
    track: "likedTracks",
    album: "likedAlbums",
    playlist: "likedPlaylists",
    artist: "followedArtists",
  } as const;

  return !!state.interaction[MAP_NAMES[targetType]][id];
};

// 5. Plain Selector lấy trạng thái gốc (true | false | undefined) phục vụ cho Sync Hook
export const selectRawInteractionStatus = (
  state: RootState,
  id: string,
  targetType: InteractionTargetType,
) => {
  const MAP_NAMES = {
    track: "likedTracks",
    album: "likedAlbums",
    playlist: "likedPlaylists",
    artist: "followedArtists",
  } as const;

  return state.interaction[MAP_NAMES[targetType]][id];
};
export default interactionSlice.reducer;
