import { Request, Response } from "express";
import analyticsService from "../services/analytics.service";

class AnalyticsController {
  /**
   * [GET] /api/analytics/realtime
   * Lấy số liệu thống kê hiện tại (snapshot)
   */
  async getRealtimeStats(req: Request, res: Response) {
    try {
      // Gọi service lấy data từ Redis & DB
      const stats = await analyticsService.getStats();

      return res.status(200).json({
        success: true,
        data: stats, // Gồm activeUsers, nowListening, trending, geoData...
      });
    } catch (error) {
      console.error("❌ Analytics Controller Error:", error);
      return res.status(500).json({
        success: false,
        message: "Lỗi máy chủ khi lấy dữ liệu thống kê.",
      });
    }
  }

  /**
   * [POST] /api/analytics/sync-now
   * (Dành cho Admin) Ép hệ thống xả Buffer (RAM) xuống Database ngay lập tức
   */
  async forceSyncViews(req: Request, res: Response) {
    try {
      // Gọi hàm ép Flush (cần thêm hàm này bên service)
      await analyticsService.forceFlush();

      return res.status(200).json({
        success: true,
        message: "Đã đồng bộ dữ liệu thống kê xuống Database thành công!",
      });
    } catch (error) {
      console.error("❌ Force Sync Error:", error);
      return res.status(500).json({
        success: false,
        message: "Đồng bộ thất bại, vui lòng thử lại sau.",
      });
    }
  }
}

export default new AnalyticsController();
