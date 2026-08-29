/**
 * audioWakeLock.ts
 *
 * Chiến thuật "Silent Audio Wake Lock" — giữ tab sống vĩnh viễn trên nền.
 *
 * Cách hoạt động:
 *  - iOS Safari, Chrome Android chỉ giữ tab sống khi nó đang phát âm thanh.
 *  - Tạo ra một thẻ <audio> ẩn phát file mp3 silent (1 giây, lặp vô tận).
 *  - Khi playWakeLock() được gọi, OS "thấy" tab luôn phát âm thanh → không bao giờ kill.
 *  - pauseWakeLock() dừng silent audio khi user thực sự pause (tránh ngốn pin vô ích).
 *
 * Kỹ thuật được sử dụng bởi: YouTube Music, Spotify Web, ZingMP3, SoundCloud.
 */

// 1 giây mp3 silent được mã hóa base64
// Source: https://github.com/anars/blank-audio (public domain)
const SILENT_MP3_BASE64 =
  "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU3LjcyLjEwMQAAAAAAAAAAAAAA//tQwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV//////////////////////////////////////////////////////////////////8AAAAATGF2YzU3LjcyAAAAAAAAAAAAAAAAJAAAAAAAAAAAASDs90hvAAAAAAAAAAAAAAAAAAAA//tQxAADgnABGiAAQBCqgCRMAAgEAH///////////////7+n/9FTuQsQH//////2NG0jWUGlio5gLQTHRTY4uy//NExAARmvKEAVgAALAAJIAAIAAAEAAAA3lQS8RtDUNbepsx+J6RFBnKQGJAYYMpLq5LXPd7g5YAAAAAA8AAAAAAAAAA8AAAAATAAAAAAAAB/////xAQAAAAAAAVAAAADDDDDDDDDDD";

let wakeLockAudio: HTMLAudioElement | null = null;
let isWakeLockActive = false;

/**
 * Khởi tạo WakeLock audio (chỉ chạy 1 lần).
 * Phải được gọi từ một user gesture (click, touch) để tránh bị trình duyệt chặn.
 */
function ensureWakeLockAudio(): HTMLAudioElement {
  if (!wakeLockAudio) {
    wakeLockAudio = new Audio(SILENT_MP3_BASE64);
    wakeLockAudio.loop = true;
    wakeLockAudio.volume = 0.001; // Cực nhỏ, không thể nghe thấy, nhưng OS vẫn coi là "đang phát"
    wakeLockAudio.preload = "auto";
  }
  return wakeLockAudio;
}

/**
 * Bắt đầu phát silent audio để giữ tab sống trong nền.
 * Gọi hàm này khi bài nhạc bắt đầu phát.
 */
export async function playWakeLock(): Promise<void> {
  if (isWakeLockActive) return;

  try {
    const audio = ensureWakeLockAudio();
    await audio.play();
    isWakeLockActive = true;
  } catch (err) {
    // Autoplay bị chặn bởi trình duyệt — bình thường nếu chưa có user gesture.
    // Sẽ thử lại vào lần sau.
    console.warn("[WakeLock] Autoplay blocked, will retry on next play:", err);
  }
}

/**
 * Dừng silent audio khi user chủ động Pause nhạc.
 * KHÔNG gọi khi chuyển bài, chỉ gọi khi user bấm nút Pause thực sự.
 */
export function pauseWakeLock(): void {
  if (!isWakeLockActive || !wakeLockAudio) return;
  wakeLockAudio.pause();
  isWakeLockActive = false;
}

/**
 * Dọn dẹp hoàn toàn khi component unmount.
 */
export function destroyWakeLock(): void {
  if (wakeLockAudio) {
    wakeLockAudio.pause();
    wakeLockAudio.src = "";
    wakeLockAudio = null;
  }
  isWakeLockActive = false;
}

export function getWakeLockStatus(): boolean {
  return isWakeLockActive;
}
