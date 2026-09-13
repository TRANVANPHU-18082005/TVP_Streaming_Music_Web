// routes/musicRoom.route.ts

import express from "express";
import { protect, optionalAuth } from "../middlewares/auth.middleware";
import * as roomController from "../controllers/musicRoom.controller";

const router = express.Router();

// ── Public (có thể xem không cần login) ─────────────────────────────────────
/** Danh sách phòng public */
router.get("/", optionalAuth, roomController.getPublicRooms);

/** Thông tin phòng (private room cần header x-room-password) */
router.get("/:roomCode", optionalAuth, roomController.getRoomByCode);

/** Lịch sử chat (cần login để xem) */
router.get("/:roomCode/messages", protect, roomController.getChatHistory);

// ── Protected (bắt buộc đăng nhập) ─────────────────────────────────────────
/** Tạo phòng mới */
router.post("/", protect, roomController.createRoom);

/** Đóng phòng */
router.delete("/:roomCode", protect, roomController.deleteRoom);

/** Thêm bài vào queue */
router.post("/:roomCode/queue", protect, roomController.addToQueue);

/** Xóa bài khỏi queue */
router.delete("/:roomCode/queue/:trackId", protect, roomController.removeFromQueue);

/** Vote/unvote bài tiếp theo */
router.post("/:roomCode/vote/:trackId", protect, roomController.voteTrack);

/** Lấy danh sách thành viên trong phòng */
router.get("/:roomCode/members", protect, roomController.getMembers);

/** Kick thành viên */
router.post("/:roomCode/kick/:userId", protect, roomController.kickUser);

export default router;
