import express from "express";
import * as mashupController from "../controllers/mashup.controller";
import { protect } from "../middlewares/auth.middleware";

const router = express.Router();

// Public routes
router.get("/feed", mashupController.getFeed);
router.post("/:id/like", mashupController.likeMashup); // Can be public for now, or protected later
router.post("/:id/share", mashupController.shareMashup);

// Auth required routes
router.use(protect);

router.get("/my", mashupController.getMyMashups);
router.get("/ai-generate", mashupController.aiGenerateMashup);
router.post("/suggest", mashupController.suggestShorts);
router.post("/create", mashupController.createMashup);

// Specific Mashup operations (Put /:id AFTER /my and other static paths)
router.get("/:id", mashupController.getMashup);
router.put("/:id", mashupController.updateMashup);
router.delete("/:id", mashupController.deleteMashup);
router.post("/:id/publish", mashupController.publishMashup);
router.post("/:id/draft", mashupController.unpublishMashup);

export default router;
