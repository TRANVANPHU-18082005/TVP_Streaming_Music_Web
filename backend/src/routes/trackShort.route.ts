import express from "express";
import * as trackShortController from "../controllers/trackShort.controller";
import { protect, authorize } from "../middlewares/auth.middleware";

const router = express.Router();

// Public routes
router.get("/feed", trackShortController.getShortsFeed);
router.post("/:id/view", trackShortController.recordView);
router.get("/:id", trackShortController.getShort);

// Admin routes
router.use(protect, authorize("admin"));
router.route("/")
  .get(trackShortController.getAllShorts)
  .post(trackShortController.createShort);

router.route("/:id")
  .patch(trackShortController.updateShort)
  .delete(trackShortController.deleteShort);

router.patch("/:id/publish", trackShortController.publishShort);
router.patch("/:id/unpublish", trackShortController.unpublishShort);

export default router;
