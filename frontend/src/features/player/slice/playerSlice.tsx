/**
 * @file playerSlice.ts
 * @description Quản lý State trình phát nhạc theo kiến trúc "ID-First & Lazy Metadata".
 * @architecture
 *   - Queue chỉ lưu string[] IDs → Redux nhẹ, DevTools mượt
 *   - trackMetadataCache: Record<string, ITrack> → O(1) lookup
 *   - Tương thích hoàn hảo với Virtual Scroll & Infinite Loading
 * @features Smart Shuffle, Dual Queue, Seek Checkpointing, Gapless Preload
 */

import {
  createSelector,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { RootState } from "@/store/store";
import { ITrack } from "@/features/track/types";
import { toast } from "sonner";

// ============================================================================
// 1. HELPER: SMART SHUFFLE (ID-based, Spotify Style)
// ============================================================================

/**
 * Shuffle thông minh dựa trên artistId trong cache.
 * Tránh xếp 2 bài cùng ca sĩ liền kề.
 *
 * @fix Trước đây vòng lặp `attempts` không đảm bảo thử đúng 3 candidate
 *      khác nhau — chỉ chạy tối đa 3 iteration bất kể kết quả.
 *      Nay dùng Fisher-Yates shuffle trên pool copy, sau đó linear scan
 *      → đảm bảo thử TẤT CẢ candidate theo thứ tự ngẫu nhiên trước khi fallback.
 */
const smartShuffleIds = (
  ids: string[],
  currentId: string,
  cache: Record<string, ITrack>,
): string[] => {
  const result: string[] = [currentId];
  // Fisher-Yates shuffle trên pool để random không bị bias
  const pool = ids.filter((id) => id !== currentId);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  while (pool.length > 0) {
    const lastArtistId = cache[result[result.length - 1]]?.artist?._id;

    // Tìm candidate đầu tiên trong pool (đã shuffle) không cùng artist
    const preferredIdx = pool.findIndex(
      (id) => cache[id]?.artist?._id !== lastArtistId,
    );

    // Nếu tìm được → dùng, không thì lấy phần tử đầu pool (fallback)
    const pickIdx = preferredIdx !== -1 ? preferredIdx : 0;
    const [chosen] = pool.splice(pickIdx, 1);
    result.push(chosen);
  }

  return result;
};
// Trong playerSlice.ts
export type QueueSourceType =
  | "album"
  | "playlist"
  | "artist"
  | "genre"
  | "single"
  | "chart"
  | "search"
  | "collection"
  | "suggestions"
  | "likedTracks"
  | "recentlyPlayed"
  | "trending"
  | "mostLiked";

interface QueueSource {
  id: string;
  type: QueueSourceType;
  title?: string; // Tên để hiển thị trên Playbar (ví dụ: "Top 100 Việt Nam")
  url?: string; // Đường dẫn để khi click vào tên nguồn sẽ quay lại trang đó
}

// ============================================================================
// 2. STATE INTERFACE
// ============================================================================

interface PlayerState {
  // --- ID-First Queue ---
  /** Danh sách ID gốc (thứ tự album/playlist). Dùng để khôi phục khi tắt Shuffle. */
  originalQueueIds: string[];
  /** Danh sách ID thực tế đang phát (đã Shuffle hoặc giữ nguyên). */
  activeQueueIds: string[];
  /** ID bài đang phát. */
  currentTrackId: string | null;
  /** Vị trí hiện tại trong activeQueueIds. */
  currentIndex: number;
  /** Source */
  currentSource: QueueSource | null;
  // --- Metadata Cache ---
  /**
   * Lưu Metadata của các bài đã được tải.
   * Key = trackId, Value = ITrack object.
   * Truy xuất O(1), không cần duyệt mảng.
   */
  trackMetadataCache: Record<string, ITrack>;

  // --- Playback Status ---
  isPlaying: boolean;
  /**
   * "idle"      : Chưa có bài nào được phát.
   * "loading"   : Đang chờ metadata hoặc audio buffer.
   * "buffering" : Metadata có nhưng audio đang buffer giữa chừng.
   * "ready"     : Sẵn sàng phát.
   */
  loadingState: "idle" | "loading" | "buffering" | "ready";
  /**
   * Duration tính bằng giây của bài đang phát.
   * Reset về 0 mỗi khi chuyển bài để tránh UI hiển thị duration sai
   * trong khoảng thời gian chờ audio metadata.
   */
  duration: number;

  // --- Seek Checkpointing ---
  /**
   * Chỉ cập nhật khi user tua, pause, hoặc tắt tab.
   * KHÔNG cập nhật mỗi giây → giảm tải Redux & LocalStorage.
   */
  lastSeekTime: number;
  seekPosition: number;

  // --- Audio Settings ---
  volume: number;
  isMuted: boolean;
  repeatMode: "off" | "all" | "one";
  isShuffling: boolean;

  /** Tự động phát khi hết queue. Nếu true sẽ tự fetch gợi ý và append vào queue. */
  autoplayEnabled: boolean;

  // --- Gapless Preload ---
  /** ID bài tiếp theo đã được preload metadata. */
  nextTrackIdPreloaded: string | null;
}

const initialState: PlayerState = {
  originalQueueIds: [],
  activeQueueIds: [],
  currentTrackId: null,
  currentIndex: -1,
  currentSource: null,
  trackMetadataCache: {},
  isPlaying: false,
  loadingState: "idle",
  duration: 0,
  lastSeekTime: 0,
  seekPosition: 0,
  volume: 1,
  isMuted: false,
  repeatMode: "off",
  isShuffling: false,
  autoplayEnabled: true,
  nextTrackIdPreloaded: null,
};

// ============================================================================
// 3. INTERNAL HELPERS
// ============================================================================

/** Tính nextTrackIdPreloaded dựa trên index hiện tại. */
const resolveNextPreload = (
  activeQueueIds: string[],
  currentIndex: number,
  repeatMode: PlayerState["repeatMode"],
): string | null => {
  if (activeQueueIds.length === 0) return null;
  const nextIdx = currentIndex + 1;
  if (nextIdx < activeQueueIds.length) return activeQueueIds[nextIdx];
  if (repeatMode === "all") return activeQueueIds[0];
  return null;
};

/**
 * Áp dụng chuyển bài — tập trung tất cả logic "chuyển track" vào 1 chỗ.
 * Dùng cho nextTrack, prevTrack, jumpToIndex để tránh drift logic.
 */
const applyTrackChange = (state: PlayerState, newIndex: number): void => {
  state.currentIndex = newIndex;
  state.currentTrackId = state.activeQueueIds[newIndex];
  state.seekPosition = 0;
  state.lastSeekTime = Date.now();
  state.duration = 0; // @fix: reset duration để UI không hiển thị duration bài cũ
  state.isPlaying = true;
  state.loadingState = state.trackMetadataCache[state.currentTrackId]
    ? "buffering"
    : "loading";
  state.nextTrackIdPreloaded = resolveNextPreload(
    state.activeQueueIds,
    newIndex,
    state.repeatMode,
  );
};

// ============================================================================
// 4. SLICE DEFINITION
// ============================================================================

const playerSlice = createSlice({
  name: "player",
  initialState,
  reducers: {
    // -------------------------------------------------------------------------
    // QUEUE MANAGEMENT
    // -------------------------------------------------------------------------

    /**
     * Khởi tạo queue với danh sách IDs + metadata batch đầu tiên.
     *
     * @example
     * dispatch(setQueue({
     *   trackIds: album.trackIds,          // 100 IDs
     *   initialMetadata: first20Tracks,    // 20 bài đầu từ Infinite Query
     *   startIndex: 3,
     * }))
     */
    setQueue: (
      state,
      action: PayloadAction<{
        trackIds: string[];
        initialMetadata: ITrack[];
        startIndex: number;
        source: QueueSource;
        isShuffling?: boolean;
      }>,
    ) => {
      const { trackIds, initialMetadata, startIndex, source, isShuffling } =
        action.payload;

      // 1. Cập nhật Metadata Cache (O(n))
      for (const track of initialMetadata) {
        if (track?._id) {
          state.trackMetadataCache[track._id] = track;
        }
      }

      // 2. Thiết lập thông tin nguồn phát
      state.currentSource = source;
      state.originalQueueIds = trackIds;
      state.isShuffling = !!isShuffling;

      // 3. Xử lý Logic xác định bài hát bắt đầu (Target Track)
      let targetTrackId: string | null = null;
      let targetIndex = 0;

      // playerSlice.ts — setQueue reducer

      if (state.isShuffling) {
        // ✅ startIndex giờ luôn là index tường minh từ caller
        // Không còn logic "startIndex > 0 ? startIndex : random" gây surprise
        targetTrackId = trackIds[startIndex] ?? null;

        if (targetTrackId) {
          state.activeQueueIds = smartShuffleIds(
            trackIds,
            targetTrackId,
            state.trackMetadataCache,
          );
          targetIndex = 0; // Target luôn ở đầu sau shuffle
        } else {
          state.activeQueueIds = [...trackIds];
        }
      } else {
        targetIndex =
          startIndex >= 0 && startIndex < trackIds.length ? startIndex : 0;
        targetTrackId = trackIds[targetIndex] ?? null;
        state.activeQueueIds = [...trackIds];
      }

      // 4. Cập nhật trạng thái Playback
      state.currentTrackId = targetTrackId;
      state.currentIndex = targetIndex;
      state.isPlaying = true;
      state.duration = 0;
      state.seekPosition = 0;
      state.lastSeekTime = Date.now();

      // Xác định trạng thái load (Nếu có trong cache thì buffer ngay, ko thì chờ loading)
      // @fix: dùng hasPlayableUrl thay vì chỉ check existence
      // Tránh case initialMetadata chứa partial track (không có URL) nhưng
      // vẫn bị coi là "đủ" → loadingState = "buffering" giả → resolver không fetch
      const cachedTrack = targetTrackId
        ? state.trackMetadataCache[targetTrackId]
        : undefined;
      state.loadingState = hasPlayableUrl(cachedTrack)
        ? "buffering"
        : "loading";

      // 5. Cập nhật bài preload cho tính năng Gapless
      state.nextTrackIdPreloaded = resolveNextPreload(
        state.activeQueueIds,
        state.currentIndex,
        state.repeatMode,
      );
    },
    setCurrentSource: (state, action: PayloadAction<QueueSource>) => {
      state.currentSource = action.payload;
    },
    /**
     * Thêm metadata vào cache theo batch (lazy loading khi Virtual Scroll).
     * Gọi khi Infinite Query trả về trang mới hoặc getTrackDetail thành công.
     *
     * @note Chỉ upgrade loadingState từ "loading" → "buffering".
     *       Không động vào "ready" / "buffering" hiện tại để tránh regression.
     */
    upsertMetadataCache: (state, action: PayloadAction<ITrack[]>) => {
      for (const track of action.payload) {
        state.trackMetadataCache[track._id] = track;
      }
      // @fix: upgrade chỉ khi track có URL thực — không upgrade khi partial metadata
      if (
        state.currentTrackId &&
        hasPlayableUrl(state.trackMetadataCache[state.currentTrackId]) &&
        state.loadingState === "loading"
      ) {
        state.loadingState = "buffering";
      }
    },

    /**
     * Thêm IDs vào cuối queue (Infinite Scroll load thêm bài).
     *
     * @fix Trước đây dùng Array.includes() → O(n²) với queue lớn.
     *      Nay dùng Set → O(n) tổng.
     */
    appendQueueIds: (state, action: PayloadAction<string[]>) => {
      const existingSet = new Set(state.originalQueueIds);
      const newIds = action.payload.filter((id) => !existingSet.has(id));
      if (newIds.length === 0) return;

      state.originalQueueIds.push(...newIds);
      // Always append to activeQueue so dynamic additions (Autoplay, fetches)
      // will be playable immediately without requiring a full reshuffle.
      state.activeQueueIds.push(...newIds);

      // Update preload in case we were at the end of the queue.
      state.nextTrackIdPreloaded = resolveNextPreload(
        state.activeQueueIds,
        state.currentIndex,
        state.repeatMode,
      );

      // We intentionally avoid reshuffling the entire queue to preserve UX.
    },

    /**
     * Xóa một track khỏi queue (Remove from queue).
     * Tự động điều chỉnh currentIndex nếu item bị xóa đứng trước bài đang phát.
     */
    removeFromQueue: (state, action: PayloadAction<string>) => {
      const id = action.payload;

      // Không cho phép xóa bài đang phát
      if (id === state.currentTrackId) return;

      state.originalQueueIds = state.originalQueueIds.filter((i) => i !== id);

      const removedActiveIdx = state.activeQueueIds.indexOf(id);
      if (removedActiveIdx === -1) return;

      state.activeQueueIds = state.activeQueueIds.filter((i) => i !== id);

      // Nếu item bị xóa đứng trước currentIndex → index dịch lùi 1
      if (removedActiveIdx < state.currentIndex) {
        state.currentIndex -= 1;
      }

      state.nextTrackIdPreloaded = resolveNextPreload(
        state.activeQueueIds,
        state.currentIndex,
        state.repeatMode,
      );
    },
    reorderQueue: (state, action: PayloadAction<string[]>) => {
      const newIds = action.payload;

      // Guard: length phải khớp để tránh mất track
      if (newIds.length !== state.activeQueueIds.length) return;

      state.activeQueueIds = newIds;

      // Tìm lại index của bài đang phát trong mảng đã sắp xếp
      // Bài đang phát KHÔNG đổi, chỉ vị trí trong queue thay đổi
      const newIndex = newIds.indexOf(state.currentTrackId ?? "");
      state.currentIndex = newIndex !== -1 ? newIndex : state.currentIndex;

      // Cập nhật preload vì thứ tự đã đổi
      state.nextTrackIdPreloaded = resolveNextPreload(
        state.activeQueueIds,
        state.currentIndex,
        state.repeatMode,
      );

      // Đồng bộ originalQueueIds khi KHÔNG shuffle
      // (khi shuffle, originalQueueIds giữ nguyên thứ tự album/playlist gốc)
      if (!state.isShuffling) {
        state.originalQueueIds = newIds;
      }
    },
    // -------------------------------------------------------------------------
    // CONTROLS
    // -------------------------------------------------------------------------

    setIsPlaying: (state, action: PayloadAction<boolean>) => {
      state.isPlaying = action.payload;
    },

    setLoadingState: (
      state,
      action: PayloadAction<PlayerState["loadingState"]>,
    ) => {
      state.loadingState = action.payload;
    },

    setDuration: (state, action: PayloadAction<number>) => {
      state.duration = action.payload;
    },

    /**
     * Lưu checkpoint vị trí. Gọi khi: tua, pause, beforeunload.
     */
    seekTo: (state, action: PayloadAction<number>) => {
      state.seekPosition = action.payload;
      state.lastSeekTime = Date.now();
    },

    setVolume: (state, action: PayloadAction<number>) => {
      state.volume = Math.max(0, Math.min(1, action.payload));
      if (state.volume > 0) state.isMuted = false;
    },

    toggleMute: (state) => {
      state.isMuted = !state.isMuted;
    },

    stopPlaying: (state) => {
      Object.assign(state, {
        ...initialState,
        // Giữ lại cache & volume settings giữa các phiên
        trackMetadataCache: state.trackMetadataCache,
        volume: state.volume,
        isMuted: state.isMuted,
      });
    },

    // -------------------------------------------------------------------------
    // NAVIGATION
    // -------------------------------------------------------------------------

    toggleShuffle: (state) => {
      state.isShuffling = !state.isShuffling;

      // Nếu không có bài nào đang phát, chỉ đổi trạng thái rồi thoát
      if (!state.currentTrackId) return;

      if (state.isShuffling) {
        /**
         * KỊCH BẢN: BẬT SHUFFLE
         * Chúng ta sử dụng hàm smartShuffleIds đã có của Phú.
         * Thuật toán này sẽ:
         * 1. Giữ bài hiện tại ở vị trí đầu tiên (Index 0).
         * 2. Xáo trộn tất cả các bài còn lại trong originalQueueIds.
         * 3. Đảm bảo tránh trùng nghệ sĩ liền kề (Smart Shuffle).
         */
        state.activeQueueIds = smartShuffleIds(
          state.originalQueueIds,
          state.currentTrackId,
          state.trackMetadataCache,
        );

        // Sau khi shuffle, bài hiện tại LUÔN nằm ở index 0
        state.currentIndex = 0;
      } else {
        /**
         * KỊCH BẢN: TẮT SHUFFLE
         * 1. Khôi phục lại danh sách phát theo đúng thứ tự của Album/Playlist.
         * 2. Tìm vị trí của bài hiện tại trong danh sách gốc để duy trì currentIndex.
         */
        state.activeQueueIds = [...state.originalQueueIds];

        const originalIdx = state.originalQueueIds.indexOf(
          state.currentTrackId,
        );
        state.currentIndex = originalIdx !== -1 ? originalIdx : 0;
      }

      // QUAN TRỌNG: Cập nhật lại bài hát Preload cho tính năng Gapless
      state.nextTrackIdPreloaded = resolveNextPreload(
        state.activeQueueIds,
        state.currentIndex,
        state.repeatMode,
      );
    },

    toggleRepeat: (state) => {
      const modes: PlayerState["repeatMode"][] = ["off", "all", "one"];
      const idx = modes.indexOf(state.repeatMode);
      state.repeatMode = modes[(idx + 1) % 3];

      state.nextTrackIdPreloaded = resolveNextPreload(
        state.activeQueueIds,
        state.currentIndex,
        state.repeatMode,
      );
    },

    /** Toggle autoplay when queue ends */
    toggleAutoplay: (state) => {
      state.autoplayEnabled = !state.autoplayEnabled;
      toast.success(`${state.autoplayEnabled ? "Bật" : "Tắt"} tự động phát`);
    },

    nextTrack: (state) => {
      if (state.activeQueueIds.length === 0) return;

      // repeatMode "one": replay bài hiện tại
      if (state.repeatMode === "one") {
        state.seekPosition = 0;
        state.lastSeekTime = Date.now();
        state.duration = 0;
        state.isPlaying = true;
        return;
      }

      const nextIndex = state.currentIndex + 1;

      if (nextIndex >= state.activeQueueIds.length) {
        if (state.repeatMode === "all") {
          // @fix: explicit set isPlaying = true thay vì dựa vào giá trị cũ
          applyTrackChange(state, 0);
        } else {
          // End of queue → dừng, reset về đầu (không phát)
          state.isPlaying = false;
          state.currentIndex = 0;
          state.currentTrackId = state.activeQueueIds[0] ?? null;
          state.seekPosition = 0;
          state.lastSeekTime = Date.now();
          state.duration = 0;
          state.nextTrackIdPreloaded = resolveNextPreload(
            state.activeQueueIds,
            0,
            state.repeatMode,
          );
        }
        return;
      }

      applyTrackChange(state, nextIndex);
    },

    prevTrack: (state, action: PayloadAction<number | undefined>) => {
      if (state.activeQueueIds.length === 0) return;
      const currentTime = action.payload ?? 0;

      // Nghe > 3s → replay bài hiện tại
      if (currentTime > 3) {
        state.seekPosition = 0;
        state.lastSeekTime = Date.now();
        // @fix: không reset duration ở đây vì bài không đổi,
        //       audio element sẽ seek về 0 và duration vẫn hợp lệ.
        return;
      }

      let prevIndex = state.currentIndex - 1;

      if (prevIndex < 0) {
        if (state.repeatMode === "all") {
          prevIndex = state.activeQueueIds.length - 1;
        } else {
          // @fix: đang ở đầu queue & repeatMode off → replay bài đầu (index 0),
          //       không nhảy index âm hay để behavior mơ hồ.
          state.seekPosition = 0;
          state.lastSeekTime = Date.now();
          return;
        }
      }

      applyTrackChange(state, prevIndex);
    },

    /**
     * Jump trực tiếp đến một track theo index trong activeQueue.
     * Dùng cho Virtual Scroll list khi user click vào bài bất kỳ.
     */
    jumpToIndex: (state, action: PayloadAction<number>) => {
      const idx = action.payload;
      if (idx < 0 || idx >= state.activeQueueIds.length) return;
      applyTrackChange(state, idx);
    },
  },
});

// ============================================================================
// 5. EXPORTS
// ============================================================================

export const {
  setQueue,
  setCurrentSource,
  upsertMetadataCache,
  appendQueueIds,
  removeFromQueue,
  reorderQueue,
  setIsPlaying,
  setLoadingState,
  setDuration,
  seekTo,
  setVolume,
  toggleMute,
  stopPlaying,
  toggleShuffle,
  toggleRepeat,
  toggleAutoplay,
  nextTrack,
  prevTrack,
  jumpToIndex,
} = playerSlice.actions;

// --- Selectors ---

export const selectPlayer = (state: RootState) => state.player;

/**
 * Trả về ITrack của bài đang phát (từ cache). Null nếu chưa có metadata.
 * @fix Memoized bằng createSelector để tránh re-render không cần thiết.
 */
export const selectCurrentTrack = createSelector(
  (state: RootState) => state.player.currentTrackId,
  (state: RootState) => state.player.trackMetadataCache,
  (id, cache): ITrack | null => {
    if (!id) return null;
    if (cache[id]) return cache[id];
    // Return a safe minimal placeholder so UI mounts the player immediately
    // while `useTrackMetadataResolver` fetches full metadata.
    const minimal: ITrack = {
      _id: id,
      title: "",
      slug: "",
      artist: {
        _id: "",
        name: "",
        slug: "",
        aliases: [],
        nationality: "",
        images: [],
        coverImage: "",
        themeColor: "",
        totalTracks: 0,
        totalAlbums: 0,
        totalFollowers: 0,
        playCount: 0,
        monthlyListeners: 0,
        isVerified: false,
        isActive: false,
        isDeleted: false,
        createdAt: "",
        updatedAt: "",
      },
      featuringArtists: [],
      genres: [],
      uploader: "",
      trackUrl: "",
      hlsUrl: undefined,
      coverImage: "",
      lyricType: "none",
      lyricUrl: undefined,
      lyricPreview: [],
      plainLyrics: undefined,
      moodVideo: undefined,
      trackNumber: 0,
      diskNumber: 0,
      releaseDate: new Date(0),
      isExplicit: false,
      copyright: undefined,
      isrc: undefined,
      tags: [],
      duration: 0,
      fileSize: 0,
      format: "",
      bitrate: 0,
      playCount: 0,
      likeCount: 0,
      status: "pending",
      isPublic: false,
      isDeleted: false,
      createdAt: "",
      updatedAt: "",
    };

    return minimal;
  },
);
// ============================================================================
// 1b. HELPER: hasPlayableUrl  ← THÊM MỚI
// ============================================================================
/**
 * Single source of truth cho "track có đủ metadata để phát không".
 * Check cả trackUrl (MP3/AAC) lẫn hlsUrl (HLS) — bất kỳ một trong hai là đủ.
 * Dùng nhất quán ở MỌI chỗ trong slice & selectors.
 */
export const hasPlayableUrl = (track: ITrack | undefined | null): boolean =>
  Boolean(track && (track.hlsUrl || track.trackUrl));
/**
 * Trả về ITrack của bài kế tiếp đã preload.
 * @fix Memoized bằng createSelector.
 */
export const selectNextTrack = createSelector(
  (state: RootState) => state.player.nextTrackIdPreloaded,
  (state: RootState) => state.player.trackMetadataCache,
  (id, cache): ITrack | null => (id ? (cache[id] ?? null) : null),
);
/** True khi currentTrack có đủ metadata thực (không phải placeholder) */

export const selectIsCurrentTrackReady = createSelector(
  (state: RootState) => state.player.currentTrackId,
  (state: RootState) => state.player.trackMetadataCache,
  (id, cache): boolean => hasPlayableUrl(id ? cache[id] : null),
);
/** Kiểm tra nhanh metadata của một trackId có trong cache chưa. */
export const selectIsTrackCached =
  (trackId: string) =>
  (state: RootState): boolean =>
    Boolean(state.player.trackMetadataCache[trackId]);

/** Tổng số bài trong queue (dùng cho Virtual Scroll totalCount). */
export const selectQueueLength = (state: RootState): number =>
  state.player.activeQueueIds.length;

export default playerSlice.reducer;
