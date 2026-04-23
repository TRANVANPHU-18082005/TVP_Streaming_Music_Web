import fs from "fs";
import path from "path";

const MAX_TMP_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

export const TMP_ROOT = path.resolve(__dirname, "../../../tmp");

export function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

export function safeRmDir(dir: string): void {
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch (err) {
    console.error(
      `[fs.utils] Failed to clean up dir "${dir}":`,
      (err as Error).message,
    );
  }
}

export function safeRmFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* best-effort */
  }
}

/**
 * Remove tmp subdirectories older than MAX_TMP_AGE_MS.
 * Called once on worker startup to prevent disk bloat.
 */
export function cleanStaleTmpDirs(): void {
  try {
    if (!fs.existsSync(TMP_ROOT)) return;
    const now = Date.now();
    for (const entry of fs.readdirSync(TMP_ROOT)) {
      const fullPath = path.join(TMP_ROOT, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && now - stat.mtimeMs > MAX_TMP_AGE_MS) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log(`[fs.utils] Cleaned stale tmp dir: ${fullPath}`);
        }
      } catch {
        /* best-effort per-entry */
      }
    }
  } catch (err) {
    console.warn("[fs.utils] cleanStaleTmpDirs error:", (err as Error).message);
  }
}

/**
 * Sum the size (bytes) of all files in dir that do NOT start with "input".
 * Used to measure generated assets (HLS segments, lyric JSONs).
 */
export function calculateGeneratedFilesSize(dir: string): number {
  let total = 0;
  try {
    for (const file of fs.readdirSync(dir)) {
      if (!file.startsWith("input")) {
        const stats = fs.statSync(path.join(dir, file));
        total += stats.size;
      }
    }
  } catch (err) {
    console.error("[fs.utils] calculateGeneratedFilesSize error:", err);
  }
  return total;
}
