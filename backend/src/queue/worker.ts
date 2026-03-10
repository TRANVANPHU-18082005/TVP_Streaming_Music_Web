import { Worker, Job } from "bullmq";
import { queueRedis } from "../config/redis";
import Track from "../models/Track";
import mongoose from "mongoose";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import path from "path";
import fs from "fs";
import axios from "axios";
import { pipeline } from "stream/promises";
import dotenv from "dotenv";
import { uploadToB2 } from "../utils/b2Upload";

dotenv.config();

// Đảm bảo ffmpegPath tồn tại
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

// KẾT NỐI DB VỚI CẤU HÌNH TRÁNH DISCONNECT
mongoose
  .connect(process.env.MONGO_URI as string, {
    serverSelectionTimeoutMS: 5000,
  })
  .then(() => console.log("📦 Worker connected to MongoDB"))
  .catch((err) => console.error("❌ Worker DB Error:", err));

// =========================================================
// HELPER FUNCTIONS
// =========================================================

async function downloadFile(url: string, outputPath: string) {
  try {
    // Trim và Encode URL để tránh lỗi ký tự đặc biệt/khoảng trắng
    const cleanUrl = encodeURI(url.trim().replace(/[\n\r]/g, ""));
    const response = await axios({
      url: cleanUrl,
      method: "GET",
      responseType: "stream",
      timeout: 300000, // 5 phút
    });
    await pipeline(response.data, fs.createWriteStream(outputPath));
    return true;
  } catch (error: any) {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    throw new Error(`Download failed: ${error.message}`);
  }
}

const getDuration = (filePath: string): Promise<number> => {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return resolve(0);
      resolve(Math.ceil(metadata.format.duration || 0));
    });
  });
};

async function uploadConcurrently(
  files: string[],
  tmpDir: string,
  targetFolder: string,
  concurrencyLimit: number = 5,
) {
  let m3u8Key = "";
  // Tạo pool công việc
  const queue = [...files];

  const workerPool = async () => {
    while (queue.length > 0) {
      const file = queue.shift();
      if (!file) continue;

      let retries = 3;
      while (retries > 0) {
        try {
          const key = await uploadToB2(
            path.join(tmpDir, file),
            file,
            targetFolder,
          );
          if (file.endsWith("index.m3u8")) m3u8Key = key;
          break; // Thành công thì thoát vòng lặp retry
        } catch (err: any) {
          retries--;
          if (retries === 0)
            throw new Error(`Upload failed for ${file}: ${err.message}`);
          await new Promise((r) => setTimeout(r, 2000)); // Đợi 2s thử lại
        }
      }
    }
  };

  await Promise.all(Array(concurrencyLimit).fill(null).map(workerPool));
  return m3u8Key;
}

// =========================================================
// MAIN WORKER ENGINE
// =========================================================
const worker = new Worker(
  "audio-transcoding",
  async (job: Job) => {
    if (job.name !== "transcode") return;

    const { trackId, fileUrl } = job.data;
    console.log(`\n⚙️ [Worker] Processing Job ${job.id} | Track: ${trackId}`);

    // Tạo thư mục tạm an toàn
    const tmpDir = path.resolve(__dirname, "../../tmp", trackId);

    try {
      // --- 1. VALIDATION & PATH EXTRACTION ---
      if (!fileUrl) throw new Error("fileUrl is missing in job data");

      const bucketName = process.env.B2_BUCKET_NAME?.trim();
      if (!bucketName)
        throw new Error("B2_BUCKET_NAME is not configured in .env");

      const bucketMarker = `${bucketName}/`;
      if (!fileUrl.includes(bucketMarker)) {
        throw new Error(`URL does not contain bucket name: ${bucketName}`);
      }

      const relativePath = fileUrl.split(bucketMarker)[1];
      const pathParts = relativePath.split("/");
      // Lấy tracks/folder-name
      const trackFolderKey = `${pathParts[0]}/${pathParts[1]}`;

      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

      const inputExt = path.extname(new URL(fileUrl).pathname) || ".mp3";
      const inputPath = path.join(tmpDir, `input_file${inputExt}`);
      const outputHlsPath = path.join(tmpDir, "index.m3u8");

      await Track.findByIdAndUpdate(trackId, { status: "processing" });

      // --- 2. EXECUTION ---
      console.log(` ⬇️ [1/4] Downloading original...`);
      await downloadFile(fileUrl, inputPath);
      const realDuration = await getDuration(inputPath);

      console.log(` 🔄 [2/4] Transcoding HLS (${realDuration}s)...`);
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            "-profile:v baseline",
            "-level 3.0",
            "-start_number 0",
            "-hls_time 10",
            "-hls_list_size 0",
            "-f hls",
            "-c:a aac",
            "-b:a 128k",
            `-hls_segment_filename ${path.join(tmpDir, "segment_%03d.ts")}`,
          ])
          .output(outputHlsPath)
          .on("end", () => resolve(true))
          .on("error", (err) =>
            reject(new Error(`FFmpeg error: ${err.message}`)),
          )
          .run();
      });

      console.log(` ⬆️ [3/4] Uploading to B2: ${trackFolderKey}/hls/`);
      const filesList = fs
        .readdirSync(tmpDir)
        .filter((f) => f.endsWith(".ts") || f.endsWith(".m3u8"));

      const m3u8Key = await uploadConcurrently(
        filesList,
        tmpDir,
        `${trackFolderKey}/hls`,
        5,
      );

      if (!m3u8Key) throw new Error("Playlist (m3u8) key not generated");

      // --- 3. FINALIZING ---
      const isDev = process.env.NODE_ENV !== "production";
      const baseUrl = isDev
        ? (process.env.B2_ENDPOINT || "").trim().replace(/\/$/, "")
        : (process.env.CLOUDFLARE_DOMAIN || "").trim().replace(/\/$/, "");

      const finalHlsUrl = `${baseUrl}/${bucketName}/${m3u8Key}`;

      await Track.findByIdAndUpdate(trackId, {
        status: "ready",
        hlsUrl: finalHlsUrl,
        duration: realDuration > 0 ? realDuration : job.data.duration || 0,
        errorReason: "",
      });

      console.log(`✅ [SUCCESS] Track ${trackId} ready!\n`);
      return { hlsUrl: finalHlsUrl };
    } catch (error: any) {
      // Log đầy đủ Stack Trace ra Console để debug
      console.error(`❌ [ERROR] Job ${job.id}:`, error.stack);

      await Track.findByIdAndUpdate(trackId, {
        status: "failed",
        errorReason: error.message?.substring(0, 500),
      });
      throw error; // Ném lỗi để BullMQ thực hiện Retry
    } finally {
      // Dọn dẹp máy local sau khi xong
      if (fs.existsSync(tmpDir)) {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (e) {
          console.error("Cleanup error:", e);
        }
      }
    }
  },
  {
    connection: queueRedis,
    concurrency: 1, // Laptop chỉ nên xử lý 1 file/lần để tránh treo máy
    limiter: { max: 10, duration: 5000 },
    drainDelay: 10,
    stalledInterval: 30000,
  },
);

// SỰ KIỆN LOGGING CHI TIẾT
worker.on("active", (job) => console.log(`🚀 Job ${job.id} is active`));
worker.on("completed", (job) => console.log(`🏆 Job ${job.id} completed`));
worker.on("failed", (job, err) =>
  console.log(`❌ Job ${job?.id} failed: ${err.message}`),
);
worker.on("error", (err) => console.error(`🚨 Worker error: ${err.message}`));

const shutdown = async () => {
  console.log("Shutting down worker...");
  await worker.close();
  await mongoose.disconnect();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("👷 Audio Transcode Worker is running...");
