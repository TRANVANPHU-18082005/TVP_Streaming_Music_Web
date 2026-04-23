import fs from "fs";
import path from "path";
import { uploadToB2 } from "../../utils/b2Upload";
import { sleep } from "../../utils/fs.utils";

const MAX_UPLOAD_RETRIES = 3;
const UPLOAD_POOL_SIZE = 5;

/**
 * Upload a single file to B2 with exponential-ish retry.
 * Throws after MAX_UPLOAD_RETRIES failed attempts.
 */
export async function uploadWithRetry(
  localPath: string,
  filename: string,
  targetFolder: string,
): Promise<string> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
    try {
      return await uploadToB2(localPath, filename, targetFolder);
    } catch (err) {
      lastError = err as Error;
      if (attempt < MAX_UPLOAD_RETRIES) {
        await sleep(1_000 * attempt);
      }
    }
  }

  throw new Error(
    `[B2UploadService] "${filename}" failed after ${MAX_UPLOAD_RETRIES} attempts: ${lastError?.message}`,
  );
}

/**
 * Upload a list of files from tmpDir concurrently using a bounded worker pool.
 *
 * Returns the B2 key for index.m3u8.
 * Throws if any file fails (after retries) or if index.m3u8 is missing.
 */
export async function uploadConcurrently(
  files: string[],
  tmpDir: string,
  targetFolder: string,
  jobId: string | undefined,
): Promise<string> {
  if (files.length === 0) {
    throw new Error("[B2UploadService] No files to upload.");
  }

  let m3u8Key = "";
  const queue = [...files];
  const errors: string[] = [];

  const worker = async () => {
    while (queue.length > 0) {
      const file = queue.shift();
      if (!file) continue;
      const localPath = path.join(tmpDir, file);

      if (!fs.existsSync(localPath)) {
        errors.push(`File missing before upload: ${file}`);
        continue;
      }

      try {
        const key = await uploadWithRetry(localPath, file, targetFolder);
        if (file === "index.m3u8") m3u8Key = key;
        console.log(`[Job ${jobId}] ✅ Uploaded: ${file}`);
      } catch (err) {
        errors.push((err as Error).message);
      }
    }
  };

  await Promise.all(Array.from({ length: UPLOAD_POOL_SIZE }, () => worker()));

  if (errors.length > 0) {
    throw new Error(
      `[B2UploadService] ${errors.length} file(s) failed:\n` +
        errors.join("\n"),
    );
  }

  if (!m3u8Key) {
    throw new Error(
      "[B2UploadService] index.m3u8 was not found in the upload results.",
    );
  }

  return m3u8Key;
}
