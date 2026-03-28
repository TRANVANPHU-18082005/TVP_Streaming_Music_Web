// src/routes/profile.route.ts
import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import * as profileController from "../controllers/profile.controller";
import {
  getLikedContentSchema,
  updateProfileSchema,
} from "../validations/profile.validate";
import validate from "../middlewares/validate";

const router = Router();

// Tất cả các route profile đều cần đăng nhập
router.use(protect);

router.get("/dashboard", profileController.getProfileDashboard);
router.get("/analytics", profileController.getAnalytics);
router.get("/playlists", profileController.getMyPlaylists);

router.get(
  "/liked",
  validate(getLikedContentSchema),
  profileController.getLikedContent,
);
router.patch(
  "/update",
  validate(updateProfileSchema),
  profileController.updateProfile,
);

export default router;
