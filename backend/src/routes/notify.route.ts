// src/routes/notify.route.ts
import { Router } from "express";
import notifyController from "../controllers/notify.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", protect, notifyController.getHistory);
router.patch("/mark-read", protect, notifyController.markRead);

export default router;
