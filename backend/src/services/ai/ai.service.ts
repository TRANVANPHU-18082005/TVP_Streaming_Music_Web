import { GoogleGenerativeAI } from "@google/generative-ai";
import Track from "../../models/Track";
import Genre from "../../models/Genre";
import config from "../../config/env";
import { fetchLyrics } from "../lyrics/lrclib.service";

class AiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = config.geminiApiKey;
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-flash-latest" });
  }

  public async generatePlaylist(prompt: string) {
    if (!config.geminiApiKey) {
      throw new Error("Chưa cấu hình GEMINI_API_KEY trong hệ thống.");
    }

    const systemPrompt = `You are a music recommendation AI. The user wants a playlist based on the following prompt: "${prompt}".
Analyze the prompt and extract:
1. "genres": Array of strings (music genres like Pop, Lofi, EDM, Rap, Ballad, etc.)
2. "keywords": Array of strings (keywords representing the mood, activity, or specific words like "buổi sáng", "thư giãn", "chill", "sôi động", "tập gym").
3. "imagePrompt": A short English string (max 10 words) describing an abstract, aesthetic image representing the playlist vibe (e.g. "abstract lofi chill aesthetics purple neon").
Return ONLY a raw JSON object with keys "genres", "keywords", and "imagePrompt". No markdown formatting, no backticks.`;

    try {
      const result = await this.model.generateContent(systemPrompt);
      const response = result.response.text();
      let parsedData: any = { genres: [], keywords: [] };

      try {
        const cleanedText = response.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedData = JSON.parse(cleanedText);
      } catch (err) {
        console.error("Lỗi parse JSON từ Gemini:", err, response);
      }

      const { genres = [], keywords = [], imagePrompt = "abstract colorful aesthetic music vibes" } = parsedData;
      console.log("🤖 AI phân tích yêu cầu:", { genres, keywords, imagePrompt });

      // Sinh Cover Image bằng Pollinations AI & Upload Cloudinary
      let coverImage = "";
      if (imagePrompt) {
        coverImage = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=512&height=512&nologo=true`;
      }

      // Tìm Genre ID trong hệ thống
      const genreDocs = await Genre.find({
        name: { $regex: new RegExp(genres.join("|"), "i") },
        isActive: true,
        isDeleted: false
      }).select("_id name");

      console.log("🎯 Thể loại (Genres) khớp trong DB:", genreDocs.map(g => g.name));
      const genreIds = genreDocs.map(g => g._id);

      // Xây dựng query tìm Track
      let trackQuery: any = {
        isPublic: true,
        isDeleted: false,
        status: "ready"
      };

      const orConditions: any[] = [];

      if (genreIds.length > 0) {
        orConditions.push({ genres: { $in: genreIds } });
      }

      if (keywords.length > 0) {
        orConditions.push({
          $text: { $search: keywords.join(" ") }
        });
      }

      if (orConditions.length > 0) {
        trackQuery.$or = orConditions;
      }

      // Query database
      const tracks = await Track.find(trackQuery)
        .populate("artist", "name slug")
        .limit(20)
        .sort({ playCount: -1 })
        .lean();

      return {
        success: true,
        data: {
          analyzed: parsedData,
          tracks,
          coverImage
        }
      };
    } catch (error) {
      console.error("Lỗi khi gọi AI Playlist:", error);
      throw error;
    }
  }

  public async generateAutoMix(recentTracks: any[]) {
    if (!config.geminiApiKey) {
      throw new Error("Chưa cấu hình GEMINI_API_KEY trong hệ thống.");
    }

    if (!recentTracks || recentTracks.length === 0) {
      return { success: true, data: [] };
    }

    // Prepare info for Gemini
    const trackInfo = recentTracks.map(t => {
      const artistName = typeof t.artist === 'object' ? t.artist.name : "Unknown Artist";
      return `"${t.title}" by ${artistName}`;
    }).join(", ");

    const excludedIds = recentTracks.map(t => t._id);

    const systemPrompt = `You are an AI DJ creating an endless radio station. 
The user just listened to these last ${recentTracks.length} tracks: ${trackInfo}.
Analyze the musical flow, vibe, and genre of these tracks. 
Extract:
1. "genres": Array of strings (music genres)
2. "keywords": Array of strings (keywords for search, mood, or related artists).
Return ONLY a raw JSON object with keys "genres" and "keywords", no markdown formatting.`;

    try {
      const result = await this.model.generateContent(systemPrompt);
      const response = result.response.text();
      let parsedData: any = { genres: [], keywords: [] };

      try {
        const cleanedText = response.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedData = JSON.parse(cleanedText);
      } catch (err) {
        console.error("Lỗi parse JSON AutoMix từ Gemini:", err, response);
      }

      const { genres = [], keywords = [] } = parsedData;
      console.log("📻 AutoMix phân tích Vibe:", { genres, keywords });

      const genreDocs = await Genre.find({
        name: { $regex: new RegExp(genres.join("|"), "i") },
        isActive: true,
        isDeleted: false
      }).select("_id");

      const genreIds = genreDocs.map(g => g._id);

      let trackQuery: any = {
        isPublic: true,
        isDeleted: false,
        status: "ready",
        _id: { $nin: excludedIds } // Loại bỏ các bài đã nghe
      };

      const orConditions: any[] = [];
      if (genreIds.length > 0) orConditions.push({ genres: { $in: genreIds } });
      if (keywords.length > 0) orConditions.push({ $text: { $search: keywords.join(" ") } });

      if (orConditions.length > 0) {
        trackQuery.$or = orConditions;
      }

      // Query database
      const tracks = await Track.find(trackQuery)
        .populate("artist", "name slug")
        .limit(10) // Lấy 10 bài hát tiếp theo
        .sort({ playCount: -1 })
        .lean();

      return {
        success: true,
        data: tracks
      };
    } catch (error) {
      console.error("Lỗi khi AutoMix:", error);
      throw error;
    }
  }

  public async analyzeTrack(trackId: string) {
    if (!config.geminiApiKey) {
      throw new Error("Chưa cấu hình GEMINI_API_KEY trong hệ thống.");
    }

    const track = await Track.findById(trackId).populate("artist", "name").populate("genres", "name");
    if (!track) {
      throw new Error("Không tìm thấy bài hát");
    }

    const artistName = typeof track.artist === 'object' ? (track.artist as any).name : "Unknown Artist";
    const genresList = track.genres.map((g: any) => g.name).join(", ");

    // Bước 1: Thu thập Lyrics
    let finalLyrics = "Not available";

    if (track.plainLyrics && track.plainLyrics.trim() !== "") {
      finalLyrics = track.plainLyrics;
    } else {
      // Fallback: Tìm Lyrics online bằng lrclib
      console.log(`🤖 [AI Analysis] Bài hát "${track.title}" chưa có lời, đang thử fetch từ LRCLIB...`);
      try {
        const lyricData = await fetchLyrics(track.title, artistName, track.duration, undefined);
        if (lyricData && lyricData.plainLyrics) {
          finalLyrics = lyricData.plainLyrics;
          console.log(`🤖 [AI Analysis] Tìm thấy lời bài hát từ LRCLIB!`);
        } else {
          console.log(`🤖 [AI Analysis] LRCLIB không có dữ liệu lời.`);
        }
      } catch (err) {
        console.error("Lỗi khi fetchLyrics dự phòng:", err);
      }
    }

    // Bước 2: Chuẩn bị Prompt
    const systemPrompt = `You are an expert music analyst and critic. 
Analyze the following song:
Title: "${track.title}"
Artist: "${artistName}"
Genres: "${genresList}"
Lyrics: 
"""
${finalLyrics.substring(0, 2000)} // Truncate if too long to save tokens
"""

Provide a detailed analysis in Vietnamese formatted strictly as a JSON object with the following keys:
1. "meaning": Ý nghĩa sâu sắc của lời bài hát. (Nếu Lyrics là 'Not available', hãy dự đoán thông điệp hoặc chủ đề dựa trên Tên bài hát, Thể loại và Ca sĩ). Trình bày hấp dẫn, cuốn hút.
2. "emotion": Cảm xúc chủ đạo (ví dụ: "Buồn bã, Da diết", "Sôi động, Năng lượng", "Thư giãn, Chill"). Ngắn gọn 2-5 từ.
3. "musicalStyle": Phân tích ngắn gọn về phong cách âm nhạc, nhịp điệu, nhạc cụ đặc trưng của bài hát này.
4. "similarKeywords": Một mảng (array) chứa 3-5 từ khóa (tiếng Việt hoặc Anh không dấu) để tìm kiếm các bài hát tương tự trong database (VD: ["chill", "lofi", "acoustic"]).

Return ONLY a raw JSON object. No markdown formatting, no backticks.`;

    // Bước 3: Gọi Gemini
    try {
      const result = await this.model.generateContent(systemPrompt);
      const response = result.response.text();
      let parsedData: any = { meaning: "", emotion: "", musicalStyle: "", similarKeywords: [] };

      try {
        const cleanedText = response.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedData = JSON.parse(cleanedText);
      } catch (err) {
        console.error("Lỗi parse JSON Analyze từ Gemini:", err, response);
      }

      const { meaning = "", emotion = "", musicalStyle = "", similarKeywords = [] } = parsedData;

      // Bước 4: Query bài hát tương tự
      let similarTracks: any[] = [];
      if (similarKeywords.length > 0) {
        const trackQuery: any = {
          isPublic: true,
          isDeleted: false,
          status: "ready",
          _id: { $ne: track._id } // Loại bài hiện tại
        };

        const orConditions: any[] = [];
        orConditions.push({ $text: { $search: similarKeywords.join(" ") } });

        if (track.genres.length > 0) {
          const genreIds = track.genres.map((g: any) => g._id);
          orConditions.push({ genres: { $in: genreIds } });
        }

        if (orConditions.length > 0) {
          trackQuery.$or = orConditions;
        }

        similarTracks = await Track.find(trackQuery)
          .populate("artist", "name slug")
          .limit(5)
          .sort({ playCount: -1 })
          .lean();
      }

      // Trả về kết quả
      return {
        success: true,
        data: {
          analysis: {
            meaning,
            emotion,
            musicalStyle
          },
          similarTracks
        }
      };

    } catch (error) {
      console.error("Lỗi khi AI phân tích bài hát:", error);
      throw error;
    }
  }
}

export default new AiService();
