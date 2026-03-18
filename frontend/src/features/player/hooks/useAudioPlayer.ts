/**
 * @file useAudioPlayer.ts
 * @status ENTERPRISE-READY
 * @description Hook Core xử lý Audio, HLS streaming, Preload & Analytics qua Socket.
 *
 * Flow ghi view:
 *  currentTime >= 30s
 *    → hasCountedView guard (dedup per session)
 *    → socket.emit("track_play") [fire-and-forget]
 *    → Backend: Redis anti-spam 10 phút → analyticsService → BullMQ → MongoDB
 */

import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import {
  selectPlayer,
  selectNextTrack,
  setIsPlaying,
  setIsLoading,
  setDuration as setReduxDuration,
  seekTo,
  nextTrack,
  prevTrack,
} from "@/features/player/slice/playerSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useSocket } from "@/hooks/useSocket";
import { RootState } from "@/store/store";
import { env } from "@/config/env";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Chuyển linear volume (0-1) sang logarithmic để tai người nghe tự nhiên hơn. */
const toLogVolume = (val: number): number => (val === 0 ? 0 : Math.pow(val, 2));

const MAX_RETRY_COUNT = 3;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useAudioPlayer = () => {
  const dispatch = useAppDispatch();
  const { socket, isConnected } = useSocket();

  // ── Redux State ────────────────────────────────────────────────────────────
  const {
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    seekPosition,
    lastSeekTime,
    repeatMode,
    duration: reduxDuration,
  } = useAppSelector(selectPlayer);

  const nextTrack_preload = useAppSelector(selectNextTrack);
  const user = useAppSelector((state: RootState) => state.auth.user);

  // ── Audio Refs ─────────────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
  const preloadHlsRef = useRef<Hls | null>(null);

  // ── Logic Refs (tránh stale closure, không gây re-render) ──────────────────
  const lastSeekTimeRef = useRef(lastSeekTime);
  const retryCountRef = useRef(0);

  /**
   * Lưu trackId đã được đếm view trong phiên nghe hiện tại.
   * null  = chưa đếm bài nào
   * string = đã emit track_play cho trackId đó
   *
   * Reset về null mỗi khi currentTrack._id thay đổi (xem useEffect bên dưới).
   */
  const hasCountedView = useRef<string | null>(null);

  // ── Local UI State ─────────────────────────────────────────────────────────
  const [currentTime, setCurrentTime] = useState(0);

  // ==========================================================================
  // A. VIEW RECORDING — Socket emit (không dùng REST API)
  // ==========================================================================

  /** Reset guard khi đổi bài để bài mới luôn được đếm. */
  useEffect(() => {
    hasCountedView.current = null;
  }, [currentTrack?._id]);

  /**
   * Emit "track_play" lên server qua WebSocket.
   *
   * Guard 1 (client): hasCountedView — tránh emit lặp trong cùng session nghe.
   * Guard 2 (server): Redis lock 10 phút — phòng spam / refresh tab.
   *
   * Fire-and-forget: không cần await, không block UX.
   * Silent-fail: nếu socket ngắt đúng lúc, view bị bỏ qua — acceptable trade-off
   * vì mục tiêu là "số liệu tốt", không phải "chính xác tuyệt đối từng lượt".
   */
  const handleRecordView = useCallback(
    (trackId: string): void => {
      // Guard 1: đã đếm rồi thì skip
      if (hasCountedView.current === trackId) return;

      // Guard 2: socket chưa sẵn sàng thì skip
      // (backend Redis đã chặn spam nên không cần retry phức tạp phía client)
      if (!socket || !isConnected) return;

      // Đánh dấu ngay trước khi emit để tránh race condition
      // (handleTimeUpdate có thể gọi liên tục trong cùng 1 giây)
      hasCountedView.current = trackId;

      const userId = user?._id ?? user?.id ?? undefined;

      socket.emit("track_play", { trackId, userId });
      console.debug(`[Analytics] Emitted track_play:`, { trackId, userId });
      if (env.NODE_ENV === "development") {
        console.log(`[Analytics] track_play emitted:`, { trackId, userId });
      }
    },
    [socket, isConnected, user],
  );

  // ==========================================================================
  // B. SEEK — Handle seek từ Redux & F5 resume
  // ==========================================================================

  useEffect(() => {
    if (!audioRef.current) return;

    if (lastSeekTime !== lastSeekTimeRef.current) {
      const performSeek = () => {
        if (!audioRef.current) return;
        if (Number.isFinite(seekPosition)) {
          audioRef.current.currentTime = seekPosition;
          setCurrentTime(seekPosition);
        }
        lastSeekTimeRef.current = lastSeekTime;
      };

      if (audioRef.current.readyState > 0) {
        performSeek();
      } else {
        audioRef.current.addEventListener("loadedmetadata", performSeek, {
          once: true,
        });
      }
    }
  }, [lastSeekTime, seekPosition]);

  // ==========================================================================
  // C. MAIN TRACK LOADER — HLS (m3u8) hoặc fallback MP3
  // ==========================================================================

  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;

    const audio = audioRef.current;
    const src = currentTrack.hlsUrl || currentTrack.trackUrl;

    // Dọn dẹp HLS instance cũ trước khi load track mới
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
        if (isPlaying) {
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
            }
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            hls.destroy();
            break;
        }
      });
    } else {
      // Fallback: MP3 / AAC thông thường
      audio.src = src;
      if (isPlaying) {
        audio.play().catch(() => dispatch(setIsPlaying(false)));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?._id]);
  // Intentionally exclude `isPlaying` và `dispatch` — chỉ re-run khi đổi track

  // ==========================================================================
  // D. PRELOAD NEXT TRACK — Buffer trước để chuyển bài không bị delay
  // ==========================================================================

  useEffect(() => {
    if (!nextTrack_preload) {
      if (preloadHlsRef.current) {
        preloadHlsRef.current.destroy();
        preloadHlsRef.current = null;
      }
      return;
    }

    const src = nextTrack_preload.hlsUrl || nextTrack_preload.trackUrl;

    if (!preloadAudioRef.current) {
      preloadAudioRef.current = new Audio();
      preloadAudioRef.current.muted = true; // không phát ra âm thanh
    }
    const preloadAudio = preloadAudioRef.current;

    if (preloadHlsRef.current) {
      preloadHlsRef.current.destroy();
      preloadHlsRef.current = null;
    }

    if (Hls.isSupported() && src.endsWith(".m3u8")) {
      const hls = new Hls({
        maxBufferLength: 10,
        startLevel: 0, // bắt đầu từ quality thấp nhất để preload nhanh
      });
      hls.loadSource(src);
      hls.attachMedia(preloadAudio);
      preloadHlsRef.current = hls;
    } else {
      preloadAudio.src = src;
      preloadAudio.load();
    }
  }, [nextTrack_preload?._id]);

  // ==========================================================================
  // E. SYNC PLAY/PAUSE STATE — Đồng bộ Redux isPlaying với audio element
  // ==========================================================================

  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.play().catch(() => {
        // Autoplay policy blocked — sync lại Redux
        dispatch(setIsPlaying(false));
      });
    } else {
      audioRef.current.pause();
      // Lưu vị trí hiện tại để resume sau (F5, tab switch)
      if (audioRef.current.currentTime > 0) {
        dispatch(seekTo(audioRef.current.currentTime));
      }
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
  // G. MEDIA SESSION API — Lock screen / headphone controls
  // ==========================================================================

  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentTrack) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist?.name ?? "Unknown Artist",
      artwork: [
        {
          src: currentTrack.coverImage,
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
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = null;
      }
    };
  }, [currentTrack, dispatch]);

  // ==========================================================================
  // H. DOM EVENT HANDLERS — Gắn vào <audio> element qua spread `events`
  // ==========================================================================

  const handleTimeUpdate = useCallback((): void => {
    if (!audioRef.current || !currentTrack) return;

    const { currentTime: curr, duration: dur } = audioRef.current;

    setCurrentTime(curr);

    // Ghi view sau 30s liên tục (threshold chuẩn của hầu hết music platform)
    if (curr >= 30) {
      handleRecordView(currentTrack._id);
    }

    // Sync duration lên Redux nếu thay đổi (tránh dispatch không cần thiết)
    if (
      dur > 0 &&
      dur !== Infinity &&
      Math.floor(dur) !== Math.floor(reduxDuration)
    ) {
      dispatch(setReduxDuration(dur));
    }
  }, [currentTrack, reduxDuration, handleRecordView, dispatch]);

  const handleEnded = useCallback((): void => {
    if (repeatMode === "one" && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    } else {
      dispatch(nextTrack());
    }
  }, [repeatMode, dispatch]);

  const handleWaiting = useCallback(
    (): void => void dispatch(setIsLoading(true)),
    [dispatch],
  );

  const handleCanPlay = useCallback(
    (): void => void dispatch(setIsLoading(false)),
    [dispatch],
  );

  const handleStalled = useCallback((): void => {
    if (isPlaying) dispatch(setIsLoading(true));
  }, [isPlaying, dispatch]);

  // ==========================================================================
  // I. IMPERATIVE HELPERS — Expose ra ngoài cho PlayerBar
  // ==========================================================================

  const getCurrentTime = useCallback(
    (): number => audioRef.current?.currentTime ?? 0,
    [],
  );

  const seek = useCallback(
    (time: number): void => {
      if (!audioRef.current) return;
      const validTime = Number.isFinite(time) ? time : 0;
      audioRef.current.currentTime = validTime;
      setCurrentTime(validTime);
      dispatch(seekTo(validTime));
    },
    [dispatch],
  );

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
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
