import ytSearch from "yt-search";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";

/**
 * Interface cho kết quả tìm kiếm Youtube
 */
export interface YoutubeSearchResult {
  videoId: string;
  title: string;
  thumbnail: string;
  channelName: string;
  duration: string; // vd: "4:20"
  seconds: number;
}

/**
 * Tìm kiếm video trên Youtube bằng yt-search
 * Tự động thêm từ khoá "karaoke" nếu chưa có để tối ưu kết quả
 *
 * @param query Từ khoá tìm kiếm
 * @param limit Số lượng kết quả trả về (mặc định 10)
 */
export const searchYoutube = async (
  query: string,
  limit: number = 10
): Promise<YoutubeSearchResult[]> => {
  try {
    if (!query || query.trim() === "") {
      return [];
    }

    // Tự động append chữ karaoke nếu người dùng gõ thiếu
    let searchQuery = query.trim();
    if (!searchQuery.toLowerCase().includes("karaoke")) {
      searchQuery = `${searchQuery} karaoke`;
    }

    const r = await ytSearch(searchQuery);

    // Filter chỉ lấy video, loại bỏ playlist/channel/live streams
    const videos = r.videos.slice(0, limit);

    return videos.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      thumbnail: v.thumbnail || "",
      channelName: v.author?.name || "Unknown Channel",
      duration: v.timestamp,
      seconds: v.seconds,
    }));
  } catch (error) {
    console.error("[YoutubeService] Search Error:", error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Lỗi khi tìm kiếm Youtube");
  }
};

export default {
  searchYoutube,
};
