// src/routes/interaction.route.ts
import { Router } from "express";
import interactionController from "../controllers/interaction.controller";
import { protect } from "../middlewares/auth.middleware";
import { interactionLimiter } from "../middlewares/rateLimiter";
import validate from "../middlewares/validate"; // Middleware validate dữ liệu (Joi/Zod)
import { interactionValidation } from "../validations/interaction.validation";

const router = Router();

// Tất cả các route trong này đều cần login
router.use(protect);

/**
 * @route   POST /api/v1/interactions/like/track/:trackId
 */
router.post(
  "/like/track/:trackId",
  interactionLimiter,
  validate(interactionValidation.toggleLike), // Thêm validate ID ở đây
  interactionController.toggleLike,
);

/**
 * @route   POST /api/v1/interactions/follow/artist/:artistId
 */
router.post(
  "/follow/artist/:artistId",
  interactionLimiter,
  validate(interactionValidation.toggleFollow),
  interactionController.toggleFollow,
);

/**
 * @route   POST /api/v1/interactions/check-batch
 * @desc    Kiểm tra hàng loạt trạng thái like/follow
 */
router.post(
  "/check-batch",
  validate(interactionValidation.batchCheck),
  interactionController.batchCheck,
);

export default router;
