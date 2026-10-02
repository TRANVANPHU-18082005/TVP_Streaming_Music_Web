import express from "express";
import * as trackShortController from "../controllers/trackShort.controller";
import { protect, optionalAuth, authorize } from "../middlewares/auth.middleware";
import validate from "../middlewares/validate";
import {
  createShortSchema,
  rejectShortSchema,
  shortIdParamSchema,
  updateShortSchema,
} from "../validations/trackShort.validation";

const router = express.Router();

router.get("/feed", trackShortController.getShortsFeed);
router.get("/catalog", trackShortController.listPublishedShorts);
router.get("/my", protect, trackShortController.getMyShorts);
router.post("/", protect, validate(createShortSchema), trackShortController.createShort);

router.post("/:id/view", optionalAuth, validate(shortIdParamSchema), trackShortController.recordView);
router.post("/:id/like", protect, validate(shortIdParamSchema), trackShortController.likeShort);
router.post("/:id/share", protect, validate(shortIdParamSchema), trackShortController.shareShort);
router.get("/:id", trackShortController.getShort);

router.patch("/:id", protect, validate(updateShortSchema), trackShortController.updateShort);
router.delete("/:id", protect, validate(shortIdParamSchema), trackShortController.deleteShort);

router.get("/", protect, authorize("admin"), trackShortController.getAllShorts);
router.patch("/:id/approve", protect, authorize("admin"), validate(shortIdParamSchema), trackShortController.publishShort);
router.patch("/:id/reject", protect, authorize("admin"), validate(rejectShortSchema), trackShortController.rejectShort);
router.patch("/:id/publish", protect, authorize("admin"), validate(shortIdParamSchema), trackShortController.publishShort);
router.patch("/:id/unpublish", protect, authorize("admin"), validate(shortIdParamSchema), trackShortController.unpublishShort);

export default router;
