// routes/musicRoom.route.ts

import express from "express";
import { protect, optionalAuth } from "../middlewares/auth.middleware";
import validate from "../middlewares/validate";
import * as roomController from "../controllers/musicRoom.controller";
import {
  addToQueueSchema,
  createRoomSchema,
  kickRoomMemberSchema,
  roomCodeParamSchema,
  roomTrackParamSchema,
} from "../validations/musicRoom.validation";

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
router.post("/", protect, validate(createRoomSchema), roomController.createRoom);

/** Đóng phòng */
router.delete("/:roomCode", protect, validate(roomCodeParamSchema), roomController.deleteRoom);

/** Thêm bài vào queue */
router.post("/:roomCode/queue", protect, validate(addToQueueSchema), roomController.addToQueue);

/** Xóa bài khỏi queue */
router.delete("/:roomCode/queue/:trackId", protect, validate(roomTrackParamSchema), roomController.removeFromQueue);

/** Vote/unvote bài tiếp theo */
router.post("/:roomCode/vote/:trackId", protect, validate(roomTrackParamSchema), roomController.voteTrack);

/** Lấy danh sách thành viên trong phòng */
router.get("/:roomCode/members", protect, roomController.getMembers);

/** Kick thành viên */
router.post("/:roomCode/kick/:userId", protect, validate(kickRoomMemberSchema), roomController.kickUser);

export default router;
