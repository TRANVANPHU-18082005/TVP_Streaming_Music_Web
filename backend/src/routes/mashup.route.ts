import express from "express";
import * as mashupController from "../controllers/mashup.controller";
import { protect, authorize, optionalAuth } from "../middlewares/auth.middleware";
import validate from "../middlewares/validate";
import {
  aiGenerateMashupSchema,
  createMashupSchema,
  mashupIdParamSchema,
  suggestShortsSchema,
  updateMashupSchema,
} from "../validations/mashup.validation";

const router = express.Router();

// Public routes
router.get("/feed", mashupController.getFeed);
router.get("/admin", protect, authorize("admin"), mashupController.getAdminMashups);
router.post(
  "/admin/:id/publish",
  protect,
  authorize("admin"),
  validate(mashupIdParamSchema),
  mashupController.adminSetPublish,
);
router.get("/:id", optionalAuth, mashupController.getMashup);

// Auth required routes
router.use(protect);

router.post("/:id/like", validate(mashupIdParamSchema), mashupController.likeMashup);
router.post("/:id/share", validate(mashupIdParamSchema), mashupController.shareMashup);
router.get("/my", mashupController.getMyMashups);
router.post("/ai-generate", validate(aiGenerateMashupSchema), mashupController.aiGenerateMashup);
router.post("/suggest", validate(suggestShortsSchema), mashupController.suggestShorts);
router.post("/create", validate(createMashupSchema), mashupController.createMashup);

// Specific Mashup operations (Put /:id AFTER /my and other static paths)
router.put("/:id", validate(updateMashupSchema), mashupController.updateMashup);
router.delete("/:id", validate(mashupIdParamSchema), mashupController.deleteMashup);
router.post("/:id/publish", validate(mashupIdParamSchema), mashupController.publishMashup);
router.post("/:id/draft", validate(mashupIdParamSchema), mashupController.unpublishMashup);

export default router;
