import express from "express";
import { generatePlaylist } from "../controllers/ai/ai.controller";
import { protect } from "../middlewares/auth.middleware";

const router = express.Router();

router.use(protect);

router.post("/playlist/generate", generatePlaylist);

export default router;
