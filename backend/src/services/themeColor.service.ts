// services/themeColor.service.ts
import Vibrant from "node-vibrant/node";

class ThemeColorService {
  private readonly DEFAULT_COLOR = "#1db954"; // Màu thương hiệu Soundwave

  /**
   * Chiết xuất màu chủ đạo từ ảnh bìa
   * Tối ưu hóa cho tốc độ xử lý Backend
   */
  async extractThemeColor(imagePath: string): Promise<string> {
    if (!imagePath) return this.DEFAULT_COLOR;

    try {
      // Tạo một Race giữa việc xử lý ảnh và Timeout (tránh file ảnh quá nặng làm treo server)
      const colorPromise = this.processImage(imagePath);
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("Extraction Timeout")), 3000),
      );

      return await Promise.race([colorPromise, timeoutPromise]);
    } catch (error) {
      console.error(
        "[ThemeColor] Error or Timeout:",
        error instanceof Error ? error.message : error,
      );
      return this.DEFAULT_COLOR;
    }
  }

  private async processImage(imagePath: string): Promise<string> {
    // node-vibrant có thể import khác nhau tùy môi trường, xử lý fallback cho TypeScript
    const vibrantInstance = (Vibrant as any).default || Vibrant;

    const palette = await vibrantInstance
      .from(imagePath)
      .quality(5) // 1 (best/slow) -> 10 (fast/low). 5 là mức cân bằng chuẩn production.
      .maxColorCount(32) // Giới hạn số lượng màu quét để tăng tốc độ xử lý
      .getPalette();

    // Thứ tự ưu tiên màu sắc để giao diện trông "sang" nhất
    const color =
      palette.Vibrant ||
      palette.DarkVibrant ||
      palette.Muted ||
      palette.DarkMuted;

    return color ? color.getHex() : this.DEFAULT_COLOR;
  }
}

export default new ThemeColorService();
