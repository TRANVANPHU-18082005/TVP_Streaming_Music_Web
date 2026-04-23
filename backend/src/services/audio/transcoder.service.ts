import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { deleteFolderFromB2 } from "../../utils/fileCleanup";

const HLS_SEGMENT_SEC = 10;
const HLS_MAX_BITRATE_KBPS = 320;
const TRANSCODE_TIMEOUT_MS = 30 * 60 * 1000;

export function transcodeToHLS(
  inputPath: string,
  outputM3u8: string,
  jobId: string | undefined,
  sourceBitrate: number,
  trackFolderKey: string, // ← thêm param để biết prefix B2
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      return reject(
        new Error(`[TranscoderService] Input file not found: ${inputPath}`),
      );
    }

    const outputDir = path.dirname(outputM3u8);
    try {
      if (fs.existsSync(outputDir)) {
        const files = fs.readdirSync(outputDir);
        for (const file of files) {
          if (file.endsWith(".ts") || file.endsWith(".m3u8")) {
            fs.unlinkSync(path.join(outputDir, file));
          }
        }
        console.log(
          `[Job ${jobId}] 🧹 Pre-transcode: Cleaned old local HLS segments in: ${outputDir}`,
        );
      } else {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    } catch (err) {
      console.warn(`[Job ${jobId}] ⚠️ Cleanup failed (non-fatal):`, err);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    }

    const safeBitrate = Math.min(
      HLS_MAX_BITRATE_KBPS,
      sourceBitrate > 0 ? sourceBitrate : HLS_MAX_BITRATE_KBPS,
    );

    let proc: ReturnType<typeof ffmpeg> | null = null;
    const stderrLines: string[] = [];

    // Xóa HLS cũ trên B2 trước khi transcode — async, không block ffmpeg
    // Chạy song song để tiết kiệm thời gian
    const b2CleanupPromise = deleteFolderFromB2(`${trackFolderKey}/hls/`)
      .then(() =>
        console.log(
          `[Job ${jobId}] 🧹 Pre-transcode: Cleaned old B2 HLS folder: ${trackFolderKey}/hls/`,
        ),
      )
      .catch(() =>
        console.warn(
          `[Job ${jobId}] ⚠️ Minor: Failed to clean old B2 HLS folder (non-fatal).`,
        ),
      );

    const timer = setTimeout(() => {
      proc?.kill("SIGKILL");
      reject(
        new Error(
          `[TranscoderService] Timed out after ${TRANSCODE_TIMEOUT_MS / 1000}s.`,
        ),
      );
    }, TRANSCODE_TIMEOUT_MS);

    proc = ffmpeg(inputPath)
      .outputOptions([
        "-vn",
        "-c:a",
        "aac",
        "-b:a",
        `${safeBitrate}k`,
        "-ar",
        "44100",
        "-ac",
        "2",
        "-f",
        "hls",
        "-hls_time",
        String(HLS_SEGMENT_SEC),
        "-hls_list_size",
        "0",
        "-start_number",
        "0",
        "-hls_flags",
        "independent_segments",
        "-segment_time_delta",
        "0.5",
      ])
      .output(outputM3u8)
      .on("stderr", (line: string) => {
        stderrLines.push(line);
        if (stderrLines.length > 200) stderrLines.shift();
      })
      .on("progress", (progress) => {
        if (progress.percent != null) {
          console.log(
            `[Job ${jobId}] 🔄 Transcoding: ${Math.round(progress.percent)}% (target: ${safeBitrate}kbps)`,
          );
        }
      })
      .on("end", () => {
        clearTimeout(timer);

        const tsFiles = fs
          .readdirSync(outputDir)
          .filter((f) => f.endsWith(".ts"));

        if (tsFiles.length <= 1) {
          console.warn(
            `[Job ${jobId}] ⚠️ Only ${tsFiles.length} .ts segment(s) found — segmentation may have failed.`,
          );
        } else {
          console.log(
            `[Job ${jobId}] ✅ Segmented into ${tsFiles.length} chunks (~${HLS_SEGMENT_SEC}s each).`,
          );
        }

        if (!fs.existsSync(outputM3u8)) {
          return reject(
            new Error(
              "[TranscoderService] Transcoding completed but m3u8 not found.",
            ),
          );
        }

        // Đợi B2 cleanup xong trước khi resolve
        // (upload ngay sau đó sẽ không bị race condition ghi đè rồi bị xóa)
        b2CleanupPromise.then(() => resolve());
      })
      .on("error", (err) => {
        clearTimeout(timer);
        const detail = stderrLines.slice(-10).join("\n");
        reject(
          new Error(
            `[TranscoderService] ffmpeg error: ${err.message}\nStderr tail:\n${detail}`,
          ),
        );
      });

    proc.run();
  });
}
