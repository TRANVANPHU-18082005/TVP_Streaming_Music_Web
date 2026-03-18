import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "@/store/store";

interface InteractionState {
  // Key là ID (string), value chỉ cần true để tiết kiệm bộ nhớ
  likedTracks: Record<string, boolean>;
  followedArtists: Record<string, boolean>;
  // Quản lý trạng thái loading riêng biệt cho từng nút để chống spam click
  loadingIds: Record<string, boolean>;
}

const initialState: InteractionState = {
  likedTracks: {},
  followedArtists: {},
  loadingIds: {},
};

export const interactionSlice = createSlice({
  name: "interaction",
  initialState,
  reducers: {
    // 🚀 1. ĐỒNG BỘ HÀNG LOẠT (Dùng khi fetch Album/Playlist hoặc Login xong)
    syncLikes: (state, action: PayloadAction<string[]>) => {
      action.payload.forEach((id) => {
        state.likedTracks[id] = true;
      });
    },
    syncFollows: (state, action: PayloadAction<string[]>) => {
      action.payload.forEach((id) => {
        state.followedArtists[id] = true;
      });
    },

    // 🚀 2. CẬP NHẬT LẠC QUAN (Optimistic Update)
    toggleLikeOptimistic: (state, action: PayloadAction<string>) => {
      const trackId = action.payload;
      if (state.likedTracks[trackId]) {
        delete state.likedTracks[trackId]; // Xóa hẳn key để giải phóng RAM
      } else {
        state.likedTracks[trackId] = true;
      }
    },

    toggleFollowOptimistic: (state, action: PayloadAction<string>) => {
      const artistId = action.payload;
      if (state.followedArtists[artistId]) {
        delete state.followedArtists[artistId];
      } else {
        state.followedArtists[artistId] = true;
      }
    },

    // 🚀 3. QUẢN LÝ LOADING (Chống spam)
    setInteractionLoading: (
      state,
      action: PayloadAction<{ id: string; loading: boolean }>,
    ) => {
      const { id, loading } = action.payload;
      if (loading) {
        state.loadingIds[id] = true;
      } else {
        delete state.loadingIds[id];
      }
    },

    // 🚀 4. DỌN DẸP KHI LOGOUT (Cực kỳ quan trọng)
    resetInteractions: () => initialState,
  },
});

// Export Actions
export const {
  syncLikes,
  syncFollows,
  toggleLikeOptimistic,
  toggleFollowOptimistic,
  setInteractionLoading,
  resetInteractions,
} = interactionSlice.actions;

// ============================================================================
// SELECTORS (Tối ưu hiệu năng Re-render)
// ============================================================================

// Chỉ re-render khi trạng thái Like của track cụ thể thay đổi
export const selectIsTrackLiked = (trackId: string) => (state: RootState) =>
  !!state.interaction.likedTracks[trackId];

// Chỉ re-render khi trạng thái Follow của artist cụ thể thay đổi
export const selectIsArtistFollowed =
  (artistId: string) => (state: RootState) =>
    !!state.interaction.followedArtists[artistId];

// Check xem một ID bất kỳ có đang xử lý API không
export const selectIsInteractionLoading = (id: string) => (state: RootState) =>
  !!state.interaction.loadingIds[id];

export default interactionSlice.reducer;
