import express from "express";
import { protect } from "../middlewares/auth.middleware";
import * as interactionController from "../controllers/interaction.controller";

const router = express.Router();
router.use(protect);

router.post("/like/track", interactionController.toggleLike);
router.get("/liked/tracks", interactionController.getLiked);

export default router;
