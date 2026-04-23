import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import { AudioMeta } from "../../types/worker.types";

const FFPROBE_TIMEOUT_MS = 30_000;
const MAX_DURATION_SEC = 60 * 60; // 1 hour

/**
 * Extract duration and bitrate from an audio file using ffprobe.
 *
 * Rejects if:
 * - File not found
 * - ffprobe times out (30s)
 * - Duration is 0 or > 1 hour
 */
export function getAudioMetadata(filePath: string): Promise<AudioMeta> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`[MetadataService] File not found: ${filePath}`));
    }

    const timer = setTimeout(() => {
      reject(
        new Error(
          `[MetadataService] ffprobe timed out after ${FFPROBE_TIMEOUT_MS}ms.`,
        ),
      );
    }, FFPROBE_TIMEOUT_MS);

    ffmpeg(filePath).ffprobe((err, metadata) => {
      clearTimeout(timer);

      if (err) {
        return reject(
          new Error(`[MetadataService] ffprobe error: ${err.message}`),
        );
      }
      if (!metadata?.format) {
        return reject(
          new Error("[MetadataService] Could not parse audio metadata format."),
        );
      }

      const duration = Math.ceil(metadata.format.duration ?? 0);
      const bitrate = Math.ceil((metadata.format.bit_rate ?? 0) / 1000);

      if (duration <= 0) {
        return reject(
          new Error("[MetadataService] Audio duration is 0 or missing."),
        );
      }
      if (duration > MAX_DURATION_SEC) {
        return reject(
          new Error(
            `[MetadataService] Audio duration ${duration}s exceeds maximum ${MAX_DURATION_SEC}s.`,
          ),
        );
      }

      resolve({ duration, bitrate });
    });
  });
}
