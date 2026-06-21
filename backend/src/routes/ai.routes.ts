import express from "express";
import { generatePlaylist, generateAutoMix, analyzeTrack } from "../controllers/ai/ai.controller";
import { protect } from "../middlewares/auth.middleware";

const router = express.Router();

router.use(protect);

router.post("/playlist/generate", generatePlaylist);
router.post("/automix", generateAutoMix);
router.post("/track/analyze", analyzeTrack);

export default router;
