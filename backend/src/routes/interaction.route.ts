import { Router } from "express";
import * as interactionController from "../controllers/interaction.controller";
import { protect } from "../middlewares/auth.middleware";
import { interactionLimiter } from "../middlewares/rateLimiter";
import {
  toggleLikeSchema,
  toggleFollowSchema,
  batchCheckSchema,
} from "../validations/interaction.validation";
import validate from "../middlewares/validate";
const router = Router();

// ============================================================
// AUTH GUARD — Toàn bộ interaction đều yêu cầu đăng nhập
// ============================================================
router.use(protect);

// ============================================================
// ROUTES
// ============================================================

/**
 * 🚀 TOGGLE LIKE
 * Dùng cho Track, Album, Playlist
 * Body: { targetId, targetType }
 */
router.post(
  "/toggle-like",
  validate(toggleLikeSchema), // Chặn rác từ vòng gửi xe
  interactionLimiter, // Chống spam click (đã có tầng 2 ở Service)
  interactionController.toggleLike,
);

/**
 * 👥 TOGGLE FOLLOW ARTIST
 * Path param: artistId
 */
router.post(
  "/follow/artist/:artistId",
  validate(toggleFollowSchema),
  interactionLimiter,
  interactionController.toggleFollow,
);

/**
 * ⚡ BATCH CHECK STATUS
 * Kiểm tra trạng thái hàng loạt để đồng bộ UI
 * Body: { ids, type, targetType? }
 */
router.post(
  "/check-batch",
  validate(batchCheckSchema),
  interactionController.batchCheck,
);

export default router;
