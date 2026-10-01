import express from "express";
import * as mashupController from "../controllers/mashup.controller";
import { protect } from "../middlewares/auth.middleware";
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
router.post("/:id/like", validate(mashupIdParamSchema), protect, mashupController.likeMashup);
router.post("/:id/share", validate(mashupIdParamSchema), protect, mashupController.shareMashup);

// Auth required routes
router.use(protect);

router.get("/my", mashupController.getMyMashups);
router.post("/ai-generate", validate(aiGenerateMashupSchema), mashupController.aiGenerateMashup);
router.post("/suggest", validate(suggestShortsSchema), mashupController.suggestShorts);
router.post("/create", validate(createMashupSchema), mashupController.createMashup);

// Specific Mashup operations (Put /:id AFTER /my and other static paths)
router.get("/:id", mashupController.getMashup);
router.put("/:id", validate(updateMashupSchema), mashupController.updateMashup);
router.delete("/:id", validate(mashupIdParamSchema), mashupController.deleteMashup);
router.post("/:id/publish", validate(mashupIdParamSchema), mashupController.publishMashup);
router.post("/:id/draft", validate(mashupIdParamSchema), mashupController.unpublishMashup);

export default router;
