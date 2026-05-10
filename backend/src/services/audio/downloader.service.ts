import axios, { AxiosError } from "axios";
import fs from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { sanitiseUrl } from "../../utils/url.utils";
import { safeRmFile } from "../../utils/fs.utils";

const MAX_DOWNLOAD_SIZE_MB = 512;
const MAX_DOWNLOAD_SIZE = MAX_DOWNLOAD_SIZE_MB * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Download a remote URL to a local file path.
 *
 * Guards:
 * - SSRF prevention via sanitiseUrl()
 * - Hard size limit: 512 MB (header + streaming)
 * - Timeout: 5 min
 */
export async function downloadFile(
  url: string,
  outputPath: string,
): Promise<void> {
  const safeUrl = sanitiseUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  let response;
  try {
    response = await axios({
      url: safeUrl,
      method: "GET",
      responseType: "stream",
      signal: controller.signal as any,
      maxContentLength: MAX_DOWNLOAD_SIZE,
      maxBodyLength: MAX_DOWNLOAD_SIZE,
    });
  } catch (err) {
    clearTimeout(timer);
    const msg =
      err instanceof AxiosError ? err.message : (err as Error).message;
    throw new Error(`[DownloaderService] HTTP request failed: ${msg}`);
  } finally {
    clearTimeout(timer);
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `[DownloaderService] Unexpected HTTP status: ${response.status}`,
    );
  }

  const contentLength = parseInt(String(response.headers["content-length"] ?? "0"), 10);
  if (contentLength > MAX_DOWNLOAD_SIZE) {
    throw new Error(
      `[DownloaderService] File too large: ${(contentLength / 1024 / 1024).toFixed(1)} MB (max ${MAX_DOWNLOAD_SIZE_MB} MB).`,
    );
  }

  let bytesReceived = 0;
  const stream = response.data as Readable;

  stream.on("data", (chunk: Buffer) => {
    bytesReceived += chunk.length;
    if (bytesReceived > MAX_DOWNLOAD_SIZE) {
      stream.destroy(
        new Error(
          `[DownloaderService] Download exceeded ${MAX_DOWNLOAD_SIZE_MB} MB limit.`,
        ),
      );
    }
  });

  try {
    await pipeline(stream, fs.createWriteStream(outputPath));
  } catch (err) {
    safeRmFile(outputPath);
    throw new Error(
      `[DownloaderService] Stream pipeline failed: ${(err as Error).message}`,
    );
  }
}
