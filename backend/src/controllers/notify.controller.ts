// src/controllers/notify.controller.ts
import { Request, Response } from "express";
import notifyService from "../services/notify.service";

class NotifyController {
  async getHistory(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await notifyService.getMyNotifications(
      (req as any).user._id,
      page,
      limit,
    );
    return res.json({ success: true, data: result });
  }

  async markRead(req: Request, res: Response) {
    await notifyService.markAsRead((req as any).user._id);
    return res.json({ success: true, message: "Đã đọc tất cả" });
  }

  async markOneRead(req: Request, res: Response) {
    const id = req.params.id as string;
    await notifyService.markOneRead(id, (req as any).user._id);
    return res.json({
      success: true,
      message: "Đã đánh dấu 1 thông báo là đã đọc",
    });
  }
}

export default new NotifyController();
