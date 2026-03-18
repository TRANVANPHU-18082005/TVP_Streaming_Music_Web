// src/controllers/analytics.controller.ts
import { Request, Response } from "express";
import analyticsService from "../services/analytics.service";

class AnalyticsController {
  /**
   * [GET] /api/analytics/realtime
   * Lấy số liệu thống kê hiện tại cho Admin Dashboard
   */
  async getRealtimeStats(req: Request, res: Response) {
    try {
      const stats = await analyticsService.getStats();
      return res.status(200).json({
        success: true,
        data: stats,
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
   * [POST] /api/analytics/heartbeat
   * API dự phòng cho Socket (hoặc dùng song song) để báo User đang online
   */
  async userHeartbeat(req: Request, res: Response) {
    try {
      const { trackId } = req.body;
      const userId = (req as any).user?._id; // Lấy từ protect middleware

      if (userId) {
        analyticsService.pingUserActivity(userId.toString(), trackId);
      }

      return res.status(204).send(); // Trả về No Content cho nhẹ
    } catch (error) {
      return res.status(500).json({ success: false });
    }
  }

  /**
   * [POST] /api/analytics/sync-now
   */
  async forceSyncViews(req: Request, res: Response) {
    try {
      await analyticsService.forceFlush();
      return res.status(200).json({
        success: true,
        message: "Đã đồng bộ dữ liệu thống kê xuống Database thành công!",
      });
    } catch (error) {
      console.error("❌ Force Sync Error:", error);
      return res.status(500).json({
        success: false,
        message: "Đồng bộ thất bại.",
      });
    }
  }
  /**
   * [GET] /api/analytics/my-summary
   */
  async getFullUserProfile(req: any, res: any) {
    try {
      const userId = req.user._id;

      // Chạy song song 3 tác vụ nặng để giảm latency
      const [summary, topTracks, recentPlayed] = await Promise.all([
        analyticsService.getUserMusicSummary(userId),
        analyticsService.getUserTopTracks(userId, 5),
        analyticsService.getRecentPlayed(userId, 10),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          summary, // { totalPlays, artistCount, totalMinutes }
          topTracks, // Top 5 bài nghe nhiều nhất
          recentPlayed, // 10 bài nghe gần đây nhất (không trùng)
        },
      });
    } catch (error) {
      console.error("❌ Get Full Profile Error:", error);
      return res.status(500).json({
        success: false,
        message: "Lỗi khi tổng hợp dữ liệu cá nhân.",
      });
    }
  }
}

export default new AnalyticsController();
