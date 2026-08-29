import axios, { AxiosError } from "axios";
import { RawLyricData } from "../../types/worker.types";
import { parseLRC } from "./lrc-parser";

const LYRICS_TIMEOUT_MS = 16_000;

export async function fetchLyrics(
  trackTitle: string,
  artistName: string,
  duration: number | undefined,
  jobId: string | undefined,
): Promise<RawLyricData> {
  const empty: RawLyricData = {
    bestAvailable: "none",
    syncedLines: [],
    plainLyrics: "",
  };

  try {
    // --- BƯỚC 1: Thử gọi lệnh GET (Yêu cầu khớp chính xác duration) ---
    console.log(`[Job ${jobId}] 🔍 LRCLIB: Trying precise GET...`);
    const lrcRes = await axios.get<{
      syncedLyrics?: string;
      plainLyrics?: string;
    }>("https://lrclib.net/api/get", {
      params: {
        track_name: trackTitle,
        artist_name: artistName,
        duration: duration ? Math.round(duration) : undefined,
      },
      timeout: LYRICS_TIMEOUT_MS,
      validateStatus: (s) => s < 500,
    });

    if (
      lrcRes.status === 200 &&
      (lrcRes.data.syncedLyrics || lrcRes.data.plainLyrics)
    ) {
      return processLyricResponse(lrcRes.data, jobId);
    }

    // --- BƯỚC 2: FALLBACK SEARCH (Nếu GET thất bại hoặc không ra lời) ---
    console.log(`[Job ${jobId}] ℹ️ GET failed. Trying fuzzy SEARCH...`);
    const searchRes = await axios.get<
      Array<{
        syncedLyrics?: string;
        plainLyrics?: string;
        duration?: number;
      }>
    >("https://lrclib.net/api/search", {
      params: { q: `${trackTitle} ${artistName}` },
      timeout: LYRICS_TIMEOUT_MS,
    });

    if (searchRes.data && searchRes.data.length > 0) {
      // Tìm bài có thời lượng gần nhất (lệch không quá 10s)
      const bestMatch =
        searchRes.data.find(
          (item) => item.duration && duration !== undefined && Math.abs(item.duration - duration) < 10,
        ) || searchRes.data[0]; // Hoặc lấy bừa kết quả đầu tiên

      console.log(`[Job ${jobId}] ✅ Found match via fuzzy search.`);
      return processLyricResponse(bestMatch, jobId);
    }

    console.log(`[Job ${jobId}] ℹ️ No lyrics found even with search.`);
    throw new Error(`Không tìm thấy lyrics nào cho bài hát "${trackTitle}" trên LRCLIB.`);
  } catch (err) {
    // Nếu lỗi đã là do chúng ta chủ động throw ở trên thì ném ra luôn
    if (err instanceof Error && err.message.includes("Không tìm thấy lyrics")) {
      throw err;
    }
    const msg =
      err instanceof AxiosError
        ? `HTTP ${err.response?.status}: ${err.message}`
        : (err as Error).message;
    console.warn(`[Job ${jobId}] ⚠️ LRCLIB fetch failed: ${msg}`);
    throw new Error(`Lỗi khi kết nối tới LRCLIB: ${msg}`);
  }
}

// Hàm phụ để xử lý dữ liệu trả về (Tái sử dụng code)
function processLyricResponse(
  data: any,
  jobId: string | undefined,
): RawLyricData {
  const rawSynced = data.syncedLyrics?.trim() ?? "";
  const rawPlain = data.plainLyrics?.trim() ?? "";

  if (rawSynced) {
    const parsedLines = parseLRC(rawSynced);
    if (parsedLines.length > 0) {
      return {
        bestAvailable: "synced",
        syncedLines: parsedLines,
        plainLyrics: rawPlain || parsedLines.map((l: any) => l.text).join("\n"),
      };
    }
  }

  if (rawPlain) {
    return {
      bestAvailable: "plain",
      syncedLines: [],
      plainLyrics: rawPlain,
    };
  }

  throw new Error("LRCLIB trả về kết quả nhưng không chứa dữ liệu lyrics (cả synced và plain đều rỗng).");
}
