import Hls from "hls.js";

/** Highlight clips only need a short buffer, not a full-track download. */
const HIGHLIGHT_HLS: Partial<Hls["config"]> = {
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  backBufferLength: 15,
  enableWorker: true,
  autoStartLoad: false,
};

export function isHlsSource(src: string): boolean {
  const path = src.split("?")[0]?.split("#")[0] ?? "";
  return path.endsWith(".m3u8");
}

export function isAutoplayBlocked(err: unknown): boolean {
  return err instanceof DOMException && err.name === "NotAllowedError";
}

export interface HighlightAttachment {
  whenReady: Promise<void>;
  /** Begin loading at `startSeconds` (HLS) or seek a progressive file. */
  prime: (startSeconds: number) => Promise<void>;
  destroy: () => void;
}

/**
 * Attach hls.js when the URL is an HLS playlist and the browser needs it.
 * Safari plays `.m3u8` natively, so that path sets `audio.src` directly.
 */
export function attachHighlightSource(
  audio: HTMLAudioElement,
  src: string,
): HighlightAttachment {
  let hls: Hls | null = null;
  let destroyed = false;
  let manifestReady = false;

  const whenReady = new Promise<void>((resolve, reject) => {
    if (!src) {
      reject(new Error("missing audio source"));
      return;
    }

    if (isHlsSource(src) && Hls.isSupported()) {
      hls = new Hls(HIGHLIGHT_HLS);
      hls.loadSource(src);
      hls.attachMedia(audio);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        manifestReady = true;
        if (!destroyed) resolve();
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal && !destroyed) {
          reject(new Error(data.details || "hls fatal"));
        }
      });
      return;
    }

    const onMeta = () => {
      if (!destroyed) resolve();
    };
    const onErr = () => {
      if (!destroyed) reject(new Error("audio element error"));
    };
    audio.addEventListener("loadedmetadata", onMeta, { once: true });
    audio.addEventListener("error", onErr, { once: true });
    audio.src = src;
    audio.load();
  });

  const prime = (startSeconds: number) => {
    const start = Number.isFinite(startSeconds) && startSeconds > 0 ? startSeconds : 0;
    return whenReady.then(
      () =>
        new Promise<void>((resolve) => {
          if (destroyed) {
            resolve();
            return;
          }
          const applySeek = () => {
            try {
              if (Math.abs(audio.currentTime - start) > 0.2) {
                audio.currentTime = start;
              }
            } catch {
              /* readyState may still be low on the first fragment */
            }
            resolve();
          };

          if (hls) {
            if (manifestReady) hls.startLoad(start);
            else hls.once(Hls.Events.MANIFEST_PARSED, () => hls?.startLoad(start));
          }

          if (audio.readyState >= 1) {
            applySeek();
            return;
          }
          audio.addEventListener("loadedmetadata", applySeek, { once: true });
        }),
    );
  };

  return {
    whenReady,
    prime,
    destroy: () => {
      destroyed = true;
      if (hls) {
        hls.destroy();
        hls = null;
      }
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    },
  };
}
