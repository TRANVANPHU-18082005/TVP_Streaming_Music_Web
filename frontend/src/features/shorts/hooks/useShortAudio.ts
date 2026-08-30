import { useState, useEffect, useRef, useCallback } from "react";

/**
 * useShortAudio — Production-grade audio hook cho TikTok-style Shorts
 *
 * Fix các vấn đề:
 * 1. Race condition: play() Promise chưa settle đã gọi pause() → DOMException
 * 2. Không reset khi scroll qua → short cũ tiếp tục chơi song song
 * 3. TikTok reset behavior: quay lại short → phát lại từ đầu
 * 4. Expose seek() để seekbar kéo được
 * 5. isLoading state để UI hiển thị spinner khi buffer
 */
export const useShortAudio = (
  src: string,
  startTime: number,
  endTime: number,
  isActive: boolean,
  onEnd?: () => void,
) => {
  const audioRef      = useRef<HTMLAudioElement | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null); // Tracking play() promise
  const activeRef     = useRef(isActive);                    // Luôn ref mới nhất, tránh stale closure
  const srcRef        = useRef(src);
  const onEndRef      = useRef(onEnd);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Sync refs
  activeRef.current = isActive;
  srcRef.current    = src;
  onEndRef.current  = onEnd;

  // ── 1. Khởi tạo Audio Element (1 lần duy nhất per hook instance) ─────────
  useEffect(() => {
    const audio = new Audio();
    audio.preload    = "auto";
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    return () => {
      // HARD cleanup: huỷ tất cả khi component unmount
      audio.pause();
      audio.src    = "";
      audio.load(); // Giải phóng buffer
      audioRef.current    = null;
      playPromiseRef.current = null;
    };
  }, []); // empty deps → chạy đúng 1 lần

  // ── 2. Load source mới khi src thay đổi ────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;

    // Hard stop trước khi đổi source
    audio.pause();
    audio.src         = src;
    audio.currentTime = startTime;
    audio.load();

    setProgress(0);
    setIsPlaying(false);
    setIsLoading(true);
    playPromiseRef.current = null;
  }, [src, startTime]);

  // ── 3. Event listeners (timeupdate, loop, loading states) ───────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      // Chỉ cập nhật progress khi đang active (tránh update state cho item ẩn)
      if (!activeRef.current) return;

      const duration = endTime - startTime;
      if (duration <= 0) return;

      const rawProgress = ((audio.currentTime - startTime) / duration) * 100;
      setProgress(Math.max(0, Math.min(100, rawProgress)));

      // Auto-loop trong khoảng [startTime, endTime] nếu không có onEnd
      if (audio.currentTime >= endTime) {
        if (onEndRef.current) {
          audio.pause();
          if (activeRef.current) setIsPlaying(false);
          playPromiseRef.current = null;
          onEndRef.current();
        } else {
          audio.currentTime = startTime;
          // Dùng playPromiseRef để track promise mới khi loop
          playPromiseRef.current = audio.play().catch(() => {
            if (activeRef.current) setIsPlaying(false);
          });
        }
      }
    };

    const handlePlay    = () => { setIsPlaying(true);  setIsLoading(false); };
    const handlePause   = () => setIsPlaying(false);
    const handleWaiting = () => { if (activeRef.current) setIsLoading(true); };
    const handleCanPlay = () => setIsLoading(false);
    const handleError   = () => { setIsLoading(false); setIsPlaying(false); };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play",       handlePlay);
    audio.addEventListener("pause",      handlePause);
    audio.addEventListener("waiting",    handleWaiting);
    audio.addEventListener("canplay",    handleCanPlay);
    audio.addEventListener("error",      handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play",       handlePlay);
      audio.removeEventListener("pause",      handlePause);
      audio.removeEventListener("waiting",    handleWaiting);
      audio.removeEventListener("canplay",    handleCanPlay);
      audio.removeEventListener("error",      handleError);
    };
  }, [startTime, endTime]); // chỉ re-attach khi time segment thay đổi

  // ── 4. CORE: Activate / Deactivate với race condition protection ─────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isActive) {
      // ─── Activate: luôn reset về startTime (TikTok behavior) ────────────
      audio.currentTime = startTime;
      setProgress(0);

      // Đảm bảo không có pending play promise trước khi play mới
      const attemptPlay = () => {
        if (!activeRef.current) return; // double-check trước khi play
        playPromiseRef.current = audio.play().catch((err) => {
          // AbortError: bình thường khi scroll nhanh, bỏ qua
          if (err?.name !== "AbortError") {
            console.warn("[ShortAudio] play error:", err);
          }
          if (activeRef.current) setIsPlaying(false);
        });
      };

      if (playPromiseRef.current) {
        // Chờ promise cũ settle trước khi play (ngăn race condition)
        playPromiseRef.current.then(attemptPlay).catch(attemptPlay);
      } else {
        attemptPlay();
      }
    } else {
      // ─── Deactivate: HARD STOP + reset ────────────────────────────────
      const stopAudio = () => {
        const a = audioRef.current;
        if (!a) return;
        a.pause();
        // Reset về startTime để khi quay lại thì phát từ đầu (TikTok reset)
        a.currentTime = startTime;
        setProgress(0);
        setIsPlaying(false);
        setIsLoading(false);
        playPromiseRef.current = null;
      };

      if (playPromiseRef.current) {
        // Phải đợi play Promise resolve/reject rồi mới pause được
        // Nếu pause() gọi khi play Promise đang pending → DOMException
        playPromiseRef.current
          .then(stopAudio)
          .catch(stopAudio); // dù lỗi cũng stop
      } else {
        stopAudio();
      }
    }
  }, [isActive, startTime]);

  // ── 5. togglePlay: user bấm vào short để pause/resume ───────────────────
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      playPromiseRef.current = audio.play().catch((err) => {
        if (err?.name !== "AbortError") console.warn("[ShortAudio] togglePlay error:", err);
      });
    } else {
      // Phải chờ play Promise rồi mới pause
      if (playPromiseRef.current) {
        playPromiseRef.current.then(() => audio.pause()).catch(() => audio.pause());
      } else {
        audio.pause();
      }
    }
  }, []);

  // ── 6. seek: kéo seekbar đến vị trí bất kỳ trong [startTime, endTime] ──
  const seek = useCallback(
    (percent: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const clampedPercent = Math.max(0, Math.min(100, percent));
      const duration = endTime - startTime;
      audio.currentTime = startTime + (clampedPercent / 100) * duration;
      setProgress(clampedPercent);
    },
    [startTime, endTime],
  );

  return { isPlaying, progress, isLoading, togglePlay, seek };
};
