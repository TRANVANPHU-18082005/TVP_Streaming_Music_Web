import { GoogleGenerativeAI } from "@google/generative-ai";
import Track from "../../models/Track";
import Genre from "../../models/Genre";
import config from "../../config/env";

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
Return ONLY a raw JSON object with keys "genres" and "keywords", no markdown formatting, no backticks.`;

    try {
      const result = await this.model.generateContent(systemPrompt);
      const response = result.response.text();
      let parsedData = { genres: [], keywords: [] };

      try {
        const cleanedText = response.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedData = JSON.parse(cleanedText);
      } catch (err) {
        console.error("Lỗi parse JSON từ Gemini:", err, response);
      }

      const { genres = [], keywords = [] } = parsedData;
      console.log("🤖 AI phân tích yêu cầu:", { genres, keywords });

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
          tracks
        }
      };
    } catch (error) {
      console.error("Lỗi khi gọi AI Playlist:", error);
      throw error;
    }
  }
}

export default new AiService();
