import fs from "fs";
import { exec } from "child_process";
import util from "util";
import MusicTempo from "music-tempo";
import { decode } from "node-wav";
import ffmpegPath from "ffmpeg-static";

const execPromise = util.promisify(exec);

export interface AudioAnalysisResult {
  tempo: number;
  energy: number;
}

export class AudioAnalysisService {
  /**
   * Phân tích BPM (Tempo) và Energy của file audio
   * - BPM: trích xuất qua thư viện music-tempo sau khi convert sang wav
   * - Energy: tính toán RMS từ tín hiệu PCM, map vào khoảng [0, 1]
   */
  public static async analyzeAudio(filePath: string): Promise<AudioAnalysisResult | null> {
    const tempWavPath = `${filePath}_temp.wav`;
    try {
      if (!ffmpegPath) throw new Error("ffmpeg-static not found");

      // Convert audio to mono, 44100Hz wav format for analysis
      await execPromise(`"${ffmpegPath}" -i "${filePath}" -ac 1 -ar 44100 -f wav "${tempWavPath}" -y`);

      const buffer = fs.readFileSync(tempWavPath);
      const audioData = decode(buffer);
      const channelData = audioData.channelData[0]; // mono channel

      // 1. Calculate BPM using music-tempo
      const mt = new MusicTempo(channelData);
      const tempo = Math.round(mt.tempo);

      // 2. Calculate Energy (RMS)
      let sumSquares = 0;
      for (let i = 0; i < channelData.length; i++) {
        sumSquares += channelData[i] * channelData[i];
      }
      const rms = Math.sqrt(sumSquares / channelData.length);
      // Giúp tôi nâng cấp và phát triển để palyer trâu và sống dai như youtube, zingmp3 hay các web nghe nhạc nổi tiếng khác
      // Tại sao khi nghe trên điện thoại hay lap treo lâu thì  player đôi lúc tự kill không phát nhạc
      // Map RMS to energy [0, 1]
      // RMS thường rất nhỏ (ví dụ 0.05 - 0.3). 
      // Nhân với scale factor để normalize. Giả sử 0.25 là energy cực đại (1.0).
      let energy = (rms / 0.25);
      if (energy > 1) energy = 1;
      if (energy < 0) energy = 0;

      return {
        tempo,
        energy: Number(energy.toFixed(2))
      };
    } catch (error) {
      console.error("[AudioAnalysisService] Error analyzing audio:", error);
      return null;
    } finally {
      if (fs.existsSync(tempWavPath)) {
        fs.unlinkSync(tempWavPath);
      }
    }
  }
}
