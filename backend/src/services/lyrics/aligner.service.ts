import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { KaraokeOutput } from "../../types/worker.types";
import { normaliseForAligner } from "./lrc-parser";
import { safeRmFile } from "../../utils/fs.utils";
import {
  KaraokeJson,
  postProcessKaraoke,
  validateKaraoke,
} from "../../utils/karaoke.postprocess";

// 1. Xác định đường dẫn script với cơ chế Fallback
// 1. Xác định đường dẫn script với cơ chế Fallback
const getAlignerScriptPath = (): string => {
  // Phú kiểm tra cả 2 tên biến cho chắc ăn
  const envPath =
    process.env.FORCED_ALIGNER_SCRIPT || process.env.ALIGNER_SCRIPT;

  if (envPath) {
    return path.resolve(envPath);
  }

  // Fallback: Tính toán tương đối từ src/services/lyrics/aligner.service.ts
  return path.resolve(__dirname, "../../../scripts/forced_aligner.py");
};

const ALIGNER_SCRIPT = getAlignerScriptPath();

// 2. Kiểm tra file tồn tại ngay khi khởi động (Guard)
if (!fs.existsSync(ALIGNER_SCRIPT)) {
  console.error(
    `[Aligner] ❌ Critical: Aligner script not found at ${ALIGNER_SCRIPT}`,
  );
} else {
  console.log(`[Aligner] ✅ Aligner script located at: ${ALIGNER_SCRIPT}`);
}
const PYTHON_BIN = process.env.PYTHON_BIN ?? "python3";
const ALIGNER_TIMEOUT_MS = 10 * 60_000; // 10 min

/**
 * Run the Python forced aligner against an audio file + plain lyrics.
 *
 * - Lyrics are written to a temp file (not passed as CLI arg) to avoid
 *   shell/locale encoding corruption of non-ASCII characters (e.g. Vietnamese).
 * - Python is forced to UTF-8 I/O via PYTHONIOENCODING env var.
 * - Returns null (non-throwing) if alignment fails, times out, or produces
 *   an invalid/empty output — callers should fall back to lower lyric tiers.
 */
export async function runForcedAlignment(
  audioPath: string,
  plainLyrics: string,
  outputJsonPath: string,
  jobId: string | undefined,
): Promise<KaraokeOutput | null> {
  const cleanedLyrics = normaliseForAligner(plainLyrics);

  if (!cleanedLyrics.trim()) {
    console.log(
      `[Job ${jobId}] ℹ️ No usable lyrics after normalisation — skipping alignment.`,
    );
    return null;
  }

  if (!fs.existsSync(audioPath)) {
    console.warn(
      `[Job ${jobId}] ⚠️ Audio file missing for alignment: ${audioPath}`,
    );
    return null;
  }

  // Write lyrics to a temp file — avoids CLI arg encoding issues on Linux
  const lyricsFilePath = outputJsonPath.replace(/\.json$/, "_lyrics_input.txt");
  try {
    await fs.promises.writeFile(lyricsFilePath, cleanedLyrics, "utf8");
  } catch (writeErr) {
    console.warn(
      `[Job ${jobId}] ⚠️ Cannot write lyrics temp file: ${(writeErr as Error).message}`,
    );
    return null;
  }

  return new Promise((resolve, reject) => {
    const args = [
      ALIGNER_SCRIPT,
      "--audio",
      audioPath,
      "--lyrics-file",
      lyricsFilePath,
      "--out",
      outputJsonPath,
    ];

    console.log(
      `[Job ${jobId}] 🎤 Spawning forced aligner (lyrics-file mode)...`,
    );

    const child = spawn(PYTHON_BIN, args, {
      stdio: ["ignore", "ignore", "pipe"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });

    const stderrLines: string[] = [];
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      safeRmFile(lyricsFilePath);
      reject(
        new Error(
          `[AlignerService] Timed out after ${ALIGNER_TIMEOUT_MS / 1000}s.`,
        ),
      );
    }, ALIGNER_TIMEOUT_MS);

    child.stderr?.on("data", (chunk: Buffer) => {
      const lines = chunk.toString("utf8").split("\n").filter(Boolean);
      stderrLines.push(...lines);
      if (stderrLines.length > 500)
        stderrLines.splice(0, stderrLines.length - 500);
      lines.forEach((ln) => console.log(`  [Aligner] ${ln}`));
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      safeRmFile(lyricsFilePath);
      reject(
        new Error(`[AlignerService] Failed to spawn Python: ${err.message}`),
      );
    });

    child.on("close", async (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      safeRmFile(lyricsFilePath); // Dọn dẹp file txt tạm

      if (code !== 0) {
        const detail = stderrLines.slice(-5).join("\n");
        return reject(
          new Error(
            `[AlignerService] Python exited with code ${code}.\n${detail}`,
          ),
        );
      }

      if (!fs.existsSync(outputJsonPath)) {
        return reject(new Error(`[AlignerService] Output JSON not found.`));
      }

      try {
        // 1. Đọc dữ liệu thô từ Python xuất ra
        const rawContent = await fs.promises.readFile(outputJsonPath, "utf-8");
        const rawData = JSON.parse(rawContent) as KaraokeJson;

        console.log(`[Job ${jobId}] 🛠️ Post-Processing...`);

        // 2. Chạy bộ lọc làm sạch dữ liệu (PP-1 đến PP-7)
        const cleaned = postProcessKaraoke(rawData);

        // 3. Kiểm tra chất lượng sau khi làm sạch
        const issues = validateKaraoke(cleaned);
        if (issues.length > 0) {
          console.warn(
            `[Job ${jobId}] ⚠️ ${issues.length} issues found after post-process.`,
          );
          // In ra 3 lỗi đầu tiên để debug nếu cần
          issues
            .slice(0, 3)
            .forEach((iss) => console.warn(`   - ${iss.issue}`));
        }

        // 4. Ghi đè file sạch vào disk để lát nữa Worker upload lên B2
        await fs.promises.writeFile(
          outputJsonPath,
          JSON.stringify(cleaned, null, 2),
        );

        if (!cleaned.lines?.length) {
          console.warn(`[Job ${jobId}] ⚠️ No valid lines remaining.`);
          return resolve(null);
        }

        console.log(`[Job ${jobId}] ✅ Finalizing cleanup. Done.`);

        // Trả về dữ liệu đã được làm sạch hoàn toàn
        resolve({ type: "karaoke", lines: cleaned.lines });
      } catch (err) {
        return reject(
          new Error(
            `[AlignerService] Final cleanup failed: ${(err as Error).message}`,
          ),
        );
      }
    });
  });
}
