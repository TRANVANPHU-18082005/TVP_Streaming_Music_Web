import express from "express";
import { generatePlaylist, generateAutoMix, analyzeTrack } from "../controllers/ai/ai.controller";
import { protect } from "../middlewares/auth.middleware";
import validate from "../middlewares/validate";
import {
  analyzeTrackSchema,
  generateAutoMixSchema,
  generatePlaylistSchema,
} from "../validations/ai.validation";

const router = express.Router();

router.use(protect);

router.post("/playlist/generate", validate(generatePlaylistSchema), generatePlaylist);
router.post("/automix", validate(generateAutoMixSchema), generateAutoMix);
router.post("/track/analyze", validate(analyzeTrackSchema), analyzeTrack);

export default router;
