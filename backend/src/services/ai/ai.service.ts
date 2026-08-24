import { GoogleGenerativeAI } from "@google/generative-ai";
import Genre from "../../models/Genre";
import Track from "../../models/Track";
import config from "../../config/env";
import mongoose from "mongoose";
import { fetchLyrics } from "../lyrics/lrclib.service";

const MOOD_ENUM = ["happy", "sad", "romantic", "energetic", "chill", "melancholic", "aggressive", "peaceful", "dreamy", "dark", "uplifting", "nostalgic"];
const CONTEXT_ENUM = ["study", "gym", "driving", "sleep", "party", "morning", "cooking", "rain", "commute", "meditation", "date", "gaming"];

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
2. "keywords": Array of strings (keywords representing vibe, activity, e.g., "buổi sáng", "thư giãn", "mưa").
3. "moods": Array of strings selected ONLY from this list: ${JSON.stringify(MOOD_ENUM)}.
4. "contexts": Array of strings selected ONLY from this list: ${JSON.stringify(CONTEXT_ENUM)}.
5. "energy": Object with "min" (0.0 to 1.0) and "max" (0.0 to 1.0), representing the desired energy level. If not specified, leave null.
6. "language": A language code like "vi", "en", "ko" if specified. If not, leave null.
7. "era": A decade or era like "2020s", "2010s", "90s" if specified. If not, leave null.
8. "emotion": A concise string capturing the core emotion (e.g., "Lãng mạn, Da diết", "Sôi động").
9. "musicalStyle": A short string describing the musical arrangement or style.
10. "imagePrompt": A short English string (max 10 words) describing an abstract, aesthetic image representing the playlist vibe (e.g. "abstract lofi chill aesthetics purple neon").
Return ONLY a raw JSON object with keys: "genres", "keywords", "moods", "contexts", "energy", "language", "era", "emotion", "musicalStyle", "imagePrompt". No markdown formatting, no backticks.`;

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

      const { 
        genres = [], 
        keywords = [], 
        moods = [], 
        contexts = [], 
        energy = null, 
        language = null, 
        era = null,
        emotion = null,
        musicalStyle = null,
        imagePrompt = "abstract colorful aesthetic music vibes" 
      } = parsedData;
      console.log("🤖 AI phân tích yêu cầu:", { genres, keywords, moods, contexts, energy, language, era, emotion, musicalStyle, imagePrompt });

      // Sinh Cover Image bằng Pollinations AI
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

      // --- CHUẨN BỊ TEXT SEARCH ---
      const searchTerms = [...keywords];
      if (emotion) searchTerms.push(emotion);
      if (musicalStyle) searchTerms.push(musicalStyle);
      const textQuery = searchTerms.length > 0 ? searchTerms.join(" ") : "";

      const baseQuery = { isPublic: true, isDeleted: false, status: "ready" };
      let tracks: any[] = [];

      // ==========================================
      // PASS 1: STRICT MATCH (Ưu tiên độ chính xác)
      // ==========================================
      let strictQuery: any = { ...baseQuery };
      if (moods.length > 0) strictQuery["aiMetadata.moods"] = { $in: moods };
      if (contexts.length > 0) strictQuery["aiMetadata.contexts"] = { $in: contexts };
      if (language) strictQuery["aiMetadata.language"] = language;
      if (era) strictQuery["aiMetadata.era"] = { $regex: new RegExp(era, "i") }; // Era là chuỗi tự do, dùng regex
      if (energy && typeof energy.min === "number" && typeof energy.max === "number") {
        strictQuery["aiMetadata.energy"] = { $gte: energy.min, $lte: energy.max };
      }

      const strictOr: any[] = [];
      if (genreIds.length > 0) strictOr.push({ genres: { $in: genreIds } });
      if (textQuery) strictOr.push({ $text: { $search: textQuery } });
      
      if (strictOr.length > 0) {
        strictQuery.$or = strictOr;
      }

      tracks = await Track.find(strictQuery, textQuery ? { score: { $meta: "textScore" } } : {})
        .populate("artist", "name slug")
        .limit(20)
        .sort(textQuery ? { score: { $meta: "textScore" }, playCount: -1 } : { playCount: -1 })
        .lean();

      // ==========================================
      // PASS 2: LOOSE MATCH (Fallback nếu thiếu bài)
      // ==========================================
      if (tracks.length < 20) {
        console.log(`⚠️ Pass 1 chỉ tìm thấy ${tracks.length} bài. Chuyển sang Pass 2 (Fallback)...`);
        const foundIds = tracks.map(t => t._id);
        const limitNeeded = 20 - tracks.length;

        let fallbackQuery: any = { ...baseQuery, _id: { $nin: foundIds } };
        const fallbackOr: any[] = [];

        // Bỏ các điều kiện khắt khe (energy, language, era). Mở rộng OR cho moods và contexts
        if (moods.length > 0) fallbackOr.push({ "aiMetadata.moods": { $in: moods } });
        if (contexts.length > 0) fallbackOr.push({ "aiMetadata.contexts": { $in: contexts } });
        if (genreIds.length > 0) fallbackOr.push({ genres: { $in: genreIds } });
        if (textQuery) fallbackOr.push({ $text: { $search: textQuery } });

        // Nếu không có bất kỳ điều kiện OR nào, ta cứ lấy ngẫu nhiên theo playCount
        if (fallbackOr.length > 0) {
          fallbackQuery.$or = fallbackOr;
        }
        
        const fallbackTracks = await Track.find(fallbackQuery, fallbackOr.length > 0 && textQuery ? { score: { $meta: "textScore" } } : {})
          .populate("artist", "name slug")
          .limit(limitNeeded)
          .sort((fallbackOr.length > 0 && textQuery) ? { score: { $meta: "textScore" }, playCount: -1 } : { playCount: -1 })
          .lean();
        
        tracks = [...tracks, ...fallbackTracks];
      }

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
      const moods = t.aiMetadata?.moods?.join(", ") || "unknown";
      return `"${t.title}" by ${artistName} (Moods: ${moods})`;
    }).join("; ");

    const excludedIds = recentTracks.map(t => t._id);

    const systemPrompt = `You are an AI DJ creating an endless radio station. 
The user just listened to these last ${recentTracks.length} tracks: ${trackInfo}.
Analyze the musical flow, vibe, and genre of these tracks. 
Extract:
1. "genres": Array of strings (music genres)
2. "keywords": Array of strings (keywords for search, mood, or related artists).
3. "moods": Array of strings selected ONLY from this list: ${JSON.stringify(MOOD_ENUM)}.
Return ONLY a raw JSON object with keys "genres", "keywords" and "moods", no markdown formatting.`;

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

      const { genres = [], keywords = [], moods = [] } = parsedData;
      console.log("📻 AutoMix phân tích Vibe:", { genres, keywords, moods });

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

      if (moods.length > 0) {
        trackQuery["aiMetadata.moods"] = { $in: moods };
      }

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
5. "moods": Array of strings selected ONLY from this list: ${JSON.stringify(MOOD_ENUM)}. Choose 1-3 most relevant.
6. "contexts": Array of strings selected ONLY from this list: ${JSON.stringify(CONTEXT_ENUM)}. Choose 1-3 most relevant.
7. "language": Ngôn ngữ chính của bài hát (e.g. "vi", "en", "ko").
8. "era": Thập niên phát hành (e.g. "2020s", "2010s").
9. "colorHex": Một mã màu hex (e.g. "#7c3aed") phản ánh chân thực nhất vibe của bài hát.
10. "energy": Estimated energy level from 0.0 (very calm/acoustic) to 1.0 (very energetic/loud). Only used if actual audio analysis fails.
11. "tempo": Estimated BPM (integer, e.g., 120). Only used if actual audio analysis fails.

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

      const { 
        meaning = "", 
        emotion = "", 
        musicalStyle = "", 
        similarKeywords = [],
        moods = [],
        contexts = [],
        language = "",
        era = "",
        colorHex = "",
        energy = null,
        tempo = null
      } = parsedData;

      // Save to Track
      track.aiMetadata = {
        meaning,
        emotion,
        musicalStyle,
        similarKeywords,
        moods,
        contexts,
        language,
        era,
        colorHex,
        energy,
        tempo,
        analyzedAt: new Date(),
        analysisVersion: 1
      };
      await track.save();

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

  public async generateMashupPlan(prompt: string) {
    if (!config.geminiApiKey) {
      throw new Error("Chưa cấu hình GEMINI_API_KEY trong hệ thống.");
    }

    const systemPrompt = `You are an expert DJ and music producer. The user wants a mashup based on: "${prompt}".
Analyze the prompt and extract:
1. "genres": Array of strings (music genres).
2. "moods": Array of strings selected ONLY from this list: ${JSON.stringify(MOOD_ENUM)}.
3. "energyProfile": A string describing the energy curve (e.g., "build-up", "chill", "peak", "wave").
4. "keywords": Array of keywords for searching.
Return ONLY a raw JSON object with keys: "genres", "moods", "energyProfile", "keywords". No markdown formatting, no backticks.`;

    try {
      const result = await this.model.generateContent(systemPrompt);
      const response = result.response.text();
      let parsedData: any = { genres: [], moods: [], keywords: [] };

      try {
        const cleanedText = response.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedData = JSON.parse(cleanedText);
      } catch (err) {
        console.error("Lỗi parse JSON Mashup từ Gemini:", err, response);
      }

      const { genres = [], moods = [], keywords = [] } = parsedData;

      // Find shorts matching these criteria
      let shortQuery: any = { isPublished: true };
      const orConditions: any[] = [];
      
      if (moods.length > 0) {
        // Need to join with Track to filter by moods, but for simplicity, just fetch recent shorts and filter
        // A better approach would be aggregate, but we will fetch and filter in memory for now.
      }

      // We'll just fetch a pool of recent shorts and rank them
      const pool = await mongoose.model('TrackShort').find({ isPublished: true }).populate('track').limit(100).lean();
      
      // Filter pool based on AI criteria (mood, genre, keyword)
      // This is a simplified version. Ideally we use the MashupService compatibility algorithm.
      // But we just need to return the AI parsed data for now, and let controller handle the rest.
      
      return {
        success: true,
        data: {
          aiAnalysis: parsedData,
          poolSize: pool.length
          // Implementation of full AI matching can be expanded here
        }
      };
    } catch (error) {
      console.error("Lỗi khi gọi AI Mashup:", error);
      throw error;
    }
  }
}

export default new AiService();
