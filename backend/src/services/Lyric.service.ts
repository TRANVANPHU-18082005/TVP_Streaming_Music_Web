import axios from "axios";

export class LyricService {
  static parseLRC(lrc: string) {
    const lines = lrc.split("\n");
    const result: any[] = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

    lines.forEach((line) => {
      const match = timeRegex.exec(line);
      if (match) {
        const ms =
          parseInt(match[1]) * 60000 +
          parseInt(match[2]) * 1000 +
          parseInt(match[3] + "0");
        const text = line.replace(timeRegex, "").trim();
        if (text) result.push({ startTime: ms, text });
      }
    });

    return result.map((line, i) => ({
      ...line,
      endTime: result[i + 1]?.startTime || line.startTime + 5000,
    }));
  }

  static async fetchFromLRCLIB(
    title: string,
    artist: string,
    duration: number,
  ) {
    try {
      const { data } = await axios.get("https://lrclib.net/api/get", {
        params: { track_name: title, artist_name: artist, duration },
        timeout: 5000,
      });
      return data;
    } catch {
      return null;
    }
  }
}
