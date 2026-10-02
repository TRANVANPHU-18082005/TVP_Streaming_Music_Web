// routes/musicRoom.route.ts

import express from "express";
import { protect, optionalAuth } from "../middlewares/auth.middleware";
import validate from "../middlewares/validate";
import * as roomController from "../controllers/musicRoom.controller";
import {
  addCollectionSchema,
  assignHostSchema,
  addToQueueSchema,
  createRoomSchema,
  kickRoomMemberSchema,
  roomCodeParamSchema,
  roomTrackParamSchema,
  setCoHostSchema,
  updateRoomSettingsSchema,
} from "../validations/musicRoom.validation";

const router = express.Router();

// ── Public (có thể xem không cần login) ─────────────────────────────────────
/** Danh sách phòng public */
router.get("/", optionalAuth, roomController.getPublicRooms);

/** Phòng đang host của user hiện tại */
router.get("/mine", protect, roomController.getMyRoom);

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

/** Thêm playlist, album hoặc nhiều bài */
router.post(
  "/:roomCode/queue/collection",
  protect,
  validate(addCollectionSchema),
  roomController.addCollection,
);

/** Đổi chế độ hàng chờ */
router.patch(
  "/:roomCode/settings",
  protect,
  validate(updateRoomSettingsSchema),
  roomController.updateSettings,
);

/** Chuyển quyền host */
router.post(
  "/:roomCode/host",
  protect,
  validate(assignHostSchema),
  roomController.assignHost,
);

/** Chỉ định hoặc gỡ co-host */
router.post(
  "/:roomCode/cohosts",
  protect,
  validate(setCoHostSchema),
  roomController.setCoHost,
);

/** Xóa bài khỏi queue */
router.delete("/:roomCode/queue/:trackId", protect, validate(roomTrackParamSchema), roomController.removeFromQueue);

/** Vote/unvote bài tiếp theo */
router.post("/:roomCode/vote/:trackId", protect, validate(roomTrackParamSchema), roomController.voteTrack);

/** Lấy danh sách thành viên trong phòng */
router.get("/:roomCode/members", protect, roomController.getMembers);

/** Kick thành viên */
router.post("/:roomCode/kick/:userId", protect, validate(kickRoomMemberSchema), roomController.kickUser);

export default router;
