import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import {
  selectPlayer,
  selectCurrentTrack,
  selectNextTrack,
  setIsPlaying,
  setLoadingState,
  setDuration as setReduxDuration,
  seekTo,
  nextTrack,
  prevTrack,
  appendQueueIds,
} from "@/features/player/slice/playerSlice";
import trackApi from "@/features/track/api/trackApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useSocket } from "@/hooks/useSocket";
import { RootState } from "@/store/store";
import { env } from "@/config/env";
import { toCDN } from "@/utils/track-helper";

// ---------------------------------------------------------------------------
// Constants & pure helpers
// ---------------------------------------------------------------------------

const toLogVolume = (val: number): number => (val === 0 ? 0 : Math.pow(val, 2));
const MAX_RETRY_COUNT = 3;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * @usage
 * const { audioRef, currentTime, seek, getCurrentTime, events } = useAudioPlayer();
 * <audio ref={audioRef} {...events} />
 *
 * audioRef PHẢI được gắn vào một <audio> element trong JSX.
 * Hook không tự tạo Audio() để đảm bảo React kiểm soát lifecycle DOM element.
 */
export const useAudioPlayer = () => {
  const dispatch = useAppDispatch();
  const { socket, isConnected } = useSocket();

  // ── Redux State ────────────────────────────────────────────────────────────
  const {
    isPlaying,
    volume,
    isMuted,
    seekPosition,
    lastSeekTime,
    duration: reduxDuration,
  } = useAppSelector(selectPlayer);

  const currentTrack = useAppSelector(selectCurrentTrack);

  const nextTrackPreload = useAppSelector(selectNextTrack);
  const user = useAppSelector((state: RootState) => state.auth.user);
  const activeQueueLen = useAppSelector(
    (s: RootState) => s.player.activeQueueIds.length,
  );
  const currentIndex = useAppSelector((s: RootState) => s.player.currentIndex);
  const repeatMode = useAppSelector((s: RootState) => s.player.repeatMode);
  const autoplayEnabled = useAppSelector(
    (s: RootState) => s.player.autoplayEnabled,
  );

  // ── Audio Refs ─────────────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
  const preloadHlsRef = useRef<Hls | null>(null);

  // ── Sync Refs (tránh stale closure trong effects có dep rỗng / dep tối thiểu) ──
  /**
   * @fix #1 — isPlaying stale closure
   * Effect C (track loader) chỉ re-run khi currentTrack._id đổi.
   * Đọc isPlaying trực tiếp trong closure → bị capture giá trị cũ.
   * Ref luôn phản ánh giá trị hiện tại.
   */
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  /**
   * @fix #7 — handleTimeUpdate re-create mỗi khi reduxDuration đổi
   * reduxDuration trong dep array → handleTimeUpdate mới mỗi ~1s đầu bài
   * → event listener re-attach không cần thiết.
   */
  const reduxDurationRef = useRef(reduxDuration);
  useEffect(() => {
    reduxDurationRef.current = reduxDuration;
  }, [reduxDuration]);

  const lastSeekTimeRef = useRef(lastSeekTime);
  const retryCountRef = useRef(0);
  const hasCountedView = useRef<string | null>(null);

  // ── Local UI State ─────────────────────────────────────────────────────────
  const [currentTime, setCurrentTime] = useState(0);

  // ==========================================================================
  // A. VIEW RECORDING
  // ==========================================================================

  useEffect(() => {
    hasCountedView.current = null;
  }, [currentTrack?._id]);

  // console.log(user);
  const handleRecordView = useCallback(
    (trackId: string): void => {
      if (hasCountedView.current === trackId) return;
      if (!socket || !isConnected) return;
      hasCountedView.current = trackId;
      const userId = user?._id ?? user?.id ?? undefined;
      socket.emit("interact_play", {
        targetId: trackId,
        targetType: "track",
        userId: userId,
      });
      if (env.NODE_ENV === "development") {
        console.log("[Analytics] track_play emitted:", { trackId, userId });
      }
    },
    [socket, isConnected, user],
  );

  // ==========================================================================
  // B. SEEK — Handle seek từ Redux & F5 resume
  //
  // @fix #3 — loadedmetadata listener không cleanup
  // Nếu effect re-run (bài mới) trước khi loadedmetadata fire → listener cũ
  // còn treo trên audio element → thực thi với seekPosition của bài cũ.
  // Return cleanup đảm bảo listener bị remove trước khi effect chạy lại.
  // ==========================================================================

  useEffect(() => {
    if (!audioRef.current) return;
    if (lastSeekTime === lastSeekTimeRef.current) return;

    const audio = audioRef.current;

    const performSeek = () => {
      if (!audioRef.current) return;
      if (Number.isFinite(seekPosition)) {
        audioRef.current.currentTime = seekPosition;
        setCurrentTime(seekPosition);
      }
      lastSeekTimeRef.current = lastSeekTime;
    };

    if (audio.readyState > 0) {
      performSeek();
    } else {
      audio.addEventListener("loadedmetadata", performSeek, { once: true });
    }

    // @fix #3 — cleanup stale listener
    return () => {
      audio.removeEventListener("loadedmetadata", performSeek);
    };
  }, [lastSeekTime, seekPosition]);

  // ==========================================================================
  // C. MAIN TRACK LOADER
  //
  // Trigger: currentTrack?._id thay đổi
  // Guard:   currentTrack null → metadata chưa về, chờ useTrackMetadataResolver
  //
  // @fix #1 — đọc isPlayingRef.current thay vì isPlaying closure
  // @fix #5 — return cleanup destroy HLS khi effect re-run hoặc unmount
  // ==========================================================================

  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;

    const audio = audioRef.current;
    const rawSrc = currentTrack.hlsUrl || currentTrack.trackUrl;
    const src = toCDN(rawSrc) || rawSrc;
    console.log(toCDN(src));
    console.log(src);
    // Dọn HLS instance của bài trước
    if (hlsRef.current) {
      hlsRef.current.detachMedia();
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    retryCountRef.current = 0;

    if (Hls.isSupported() && src.endsWith(".m3u8")) {
      const hls = new Hls({
        maxBufferLength: 30,
        enableWorker: true,
        manifestLoadingTimeOut: 15000,
      });
      hls.loadSource(src);
      hls.attachMedia(audio);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        dispatch(setLoadingState("buffering"));
        // @fix #1 — isPlayingRef thay vì isPlaying (stale closure)
        if (isPlayingRef.current) {
          audio.play().catch(() => dispatch(setIsPlaying(false)));
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            if (retryCountRef.current < MAX_RETRY_COUNT) {
              retryCountRef.current++;
              hls.startLoad();
            } else {
              dispatch(setIsPlaying(false));
              dispatch(setLoadingState("idle"));
            }
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            hls.destroy();
            dispatch(setLoadingState("idle"));
        }
      });
    } else {
      // Fallback MP3/AAC
      audio.src = src;
      dispatch(setLoadingState("buffering"));
      // @fix #1 — isPlayingRef thay vì isPlaying (stale closure)
      if (isPlayingRef.current) {
        audio.play().catch(() => dispatch(setIsPlaying(false)));
      }
    }

    // @fix #5 — cleanup HLS khi bài đổi hoặc component unmount
    return () => {
      if (hlsRef.current) {
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?._id]);
  // Intentionally exclude isPlaying, dispatch — chỉ re-run khi đổi track

  // ==========================================================================
  // D. PRELOAD NEXT TRACK
  //
  // @fix #6 — return cleanup destroy preload HLS khi unmount
  // ==========================================================================

  useEffect(() => {
    if (!nextTrackPreload) {
      if (preloadHlsRef.current) {
        preloadHlsRef.current.destroy();
        preloadHlsRef.current = null;
      }
      if (preloadAudioRef.current) {
        preloadAudioRef.current.src = "";
      }
      return;
    }

    const rawSrc = nextTrackPreload.hlsUrl || nextTrackPreload.trackUrl;
    const src = toCDN(rawSrc) || rawSrc;

    if (!preloadAudioRef.current) {
      preloadAudioRef.current = new Audio();
      preloadAudioRef.current.muted = true;
    }
    const preloadAudio = preloadAudioRef.current;

    if (preloadHlsRef.current) {
      preloadHlsRef.current.destroy();
      preloadHlsRef.current = null;
    }

    if (Hls.isSupported() && src.endsWith(".m3u8")) {
      const hls = new Hls({ maxBufferLength: 10, startLevel: 0 });
      hls.loadSource(src);
      hls.attachMedia(preloadAudio);
      preloadHlsRef.current = hls;
    } else {
      preloadAudio.src = src;
      preloadAudio.load();
    }

    // @fix #6 — cleanup preload HLS khi bài tiếp theo đổi hoặc unmount
    return () => {
      if (preloadHlsRef.current) {
        preloadHlsRef.current.destroy();
        preloadHlsRef.current = null;
      }
      if (preloadAudioRef.current) {
        preloadAudioRef.current.src = "";
      }
    };
  }, [nextTrackPreload?._id]);

  // ==========================================================================
  // E. SYNC PLAY/PAUSE
  //
  // @fix #2 — BỎ dispatch(seekTo) khi pause
  // Trước đây: pause → seekTo(currentTime) → lastSeekTime đổi → Effect B chạy
  // → audio.currentTime = seekPosition → vòng lặp ngầm.
  // seekTo chỉ nên được gọi khi user CHỦ ĐỘNG tua hoặc beforeunload.
  // ==========================================================================

  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.play().catch(() => dispatch(setIsPlaying(false)));
    } else {
      audioRef.current.pause();
      // @fix #2 — không dispatch seekTo ở đây
    }
  }, [isPlaying, dispatch]);

  // ==========================================================================
  // F. VOLUME SYNC
  // ==========================================================================

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : toLogVolume(volume);
  }, [volume, isMuted]);

  // ==========================================================================
  // G. MEDIA SESSION API
  //
  // @fix #8 — dep chỉ còn currentTrack?._id thay vì toàn bộ currentTrack object
  // Tránh re-setup khi cache update field không liên quan (playCount, v.v.)
  // currentTrack được đọc bên trong effect — closure vẫn fresh vì effect
  // re-run khi _id đổi (tức là khi currentTrack thực sự là bài khác).
  // ==========================================================================

  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentTrack) return;
    const fullArtist =
      currentTrack.artist?.name +
      (currentTrack.featuringArtists.length > 0
        ? ` ft. ${currentTrack.featuringArtists.map((a) => a.name).join(", ")}`
        : "");
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: fullArtist,
      artwork: [
        {
          src: toCDN(currentTrack.coverImage) || currentTrack.coverImage,
          sizes: "512x512",
          type: "image/jpeg",
        },
      ],
    });

    navigator.mediaSession.setActionHandler("play", () =>
      dispatch(setIsPlaying(true)),
    );
    navigator.mediaSession.setActionHandler("pause", () =>
      dispatch(setIsPlaying(false)),
    );
    navigator.mediaSession.setActionHandler("previoustrack", () =>
      dispatch(prevTrack(audioRef.current?.currentTime)),
    );
    navigator.mediaSession.setActionHandler("nexttrack", () =>
      dispatch(nextTrack()),
    );
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime != null && audioRef.current) {
        audioRef.current.currentTime = details.seekTime;
        setCurrentTime(details.seekTime);
        dispatch(seekTo(details.seekTime));
      }
    });

    return () => {
      navigator.mediaSession.metadata = null;
    };
    // @fix #8 — chỉ re-run khi _id đổi, không phải khi object reference đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?._id, dispatch]);

  // ==========================================================================
  // H. DOM EVENT HANDLERS
  // ==========================================================================

  /**
   * @fix #7 — reduxDurationRef thay vì reduxDuration trong deps
   * handleTimeUpdate fire ~4 lần/giây. reduxDuration trong deps → callback
   * mới mỗi khi duration update (đầu mỗi bài) → event listener re-attach.
   * Dùng ref để đọc giá trị mới nhất mà không re-create callback.
   */
  const handleTimeUpdate = useCallback((): void => {
    if (!audioRef.current || !currentTrack) return;
    const { currentTime: curr, duration: dur } = audioRef.current;

    setCurrentTime(curr);

    if (curr >= 30) handleRecordView(currentTrack._id);

    if (
      dur > 0 &&
      dur !== Infinity &&
      Math.floor(dur) !== Math.floor(reduxDurationRef.current)
    ) {
      dispatch(setReduxDuration(dur));
    }
  }, [currentTrack, handleRecordView, dispatch]);
  // reduxDuration đã bị loại khỏi deps — đọc qua ref

  /**
   * @fix #4 — BỎ xử lý repeat:one tại đây
   * Trước đây hook tự xử lý repeat:one (seek + play trực tiếp) → logic bị
   * split giữa hook và slice, dễ drift.
   * playerSlice.nextTrack() đã handle đầy đủ:
   *   repeat:one  → seekPosition = 0, isPlaying = true → Effect B + E tự chạy
   *   repeat:all  → wrap về index 0
   *   repeat:off  → dừng ở cuối
   * Slice là single source of truth duy nhất cho navigation logic.
   */
  const handleEnded = useCallback(async (): Promise<void> => {
    // If there's no current track, fallback to nextTrack behavior
    if (!currentTrack) {
      dispatch(nextTrack());
      return;
    }

    const atLast = activeQueueLen > 0 && currentIndex >= activeQueueLen - 1;

    // If we're at the end of the queue and repeat is off, consider Autoplay
    if (atLast && repeatMode === "off") {
      if (autoplayEnabled && currentTrack._id) {
        try {
          const resp = await trackApi.getSimilarTracks(currentTrack._id, 10);
          const recs = resp?.tracks ?? [];
          const ids = recs.map((t) => t._id).filter(Boolean);
          if (ids.length > 0) {
            // Append recommended IDs and immediately advance to the next track
            dispatch(appendQueueIds(ids));
            dispatch(nextTrack());
            return;
          }
        } catch (err) {
          if (env.NODE_ENV === "development") {
            console.error("Autoplay fetch failed:", err);
          }
        }
      }

      // No autoplay or fetch failed → default behavior
      dispatch(nextTrack());
      return;
    }

    // Normal case: advance to next track
    dispatch(nextTrack());
  }, [
    dispatch,
    currentTrack,
    activeQueueLen,
    currentIndex,
    repeatMode,
    autoplayEnabled,
  ]);

  const handleWaiting = useCallback(
    () => dispatch(setLoadingState("buffering")),
    [dispatch],
  );

  const handleCanPlay = useCallback(
    () => dispatch(setLoadingState("ready")),
    [dispatch],
  );

  const handleStalled = useCallback(() => {
    if (isPlayingRef.current) dispatch(setLoadingState("buffering"));
    // @note — dùng isPlayingRef để tránh isPlaying vào deps của callback
    // isPlaying thay đổi liên tục → callback mới liên tục nếu là dep trực tiếp
  }, [dispatch]);

  // ==========================================================================
  // I. IMPERATIVE HELPERS
  // ==========================================================================

  const getCurrentTime = useCallback(
    (): number => audioRef.current?.currentTime ?? 0,
    [],
  );

  /**
   * @fix #9 — sync lastSeekTimeRef ngay lập tức sau khi seek
   * Trước đây: seek() dispatch(seekTo(t)) → Redux update → Effect B re-run
   * → audio.currentTime = t lần nữa (redundant double-seek).
   * Cập nhật lastSeekTimeRef trực tiếp → Effect B thấy ref đã bằng lastSeekTime
   * → skip, tránh double-seek.
   */
  const seek = useCallback(
    (time: number): void => {
      if (!audioRef.current) return;
      const validTime = Number.isFinite(time) ? time : 0;
      audioRef.current.currentTime = validTime;
      setCurrentTime(validTime);
      lastSeekTimeRef.current = Date.now(); // sync trước khi dispatch
      dispatch(seekTo(validTime));
    },
    [dispatch],
  );

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    /**
     * Gắn vào <audio> element trong JSX:
     * <audio ref={audioRef} {...events} />
     */
    audioRef,
    currentTime,
    seek,
    getCurrentTime,
    events: {
      onTimeUpdate: handleTimeUpdate,
      onEnded: handleEnded,
      onWaiting: handleWaiting,
      onStalled: handleStalled,
      onPlaying: handleCanPlay,
      onCanPlay: handleCanPlay,
      onSeeked: handleCanPlay,
    },
  };
};
