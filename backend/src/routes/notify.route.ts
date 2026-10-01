// src/routes/notify.route.ts
import { Router } from "express";
import notifyController from "../controllers/notify.controller";
import { protect } from "../middlewares/auth.middleware";
import validate from "../middlewares/validate";
import { notificationIdParamSchema } from "../validations/notify.validation";

const router = Router();

router.get("/", protect, notifyController.getHistory);
router.patch("/mark-read", protect, notifyController.markRead);
router.patch("/read-all", protect, notifyController.markRead);
router.patch("/:id/read", protect, validate(notificationIdParamSchema), notifyController.markOneRead);

export default router;
