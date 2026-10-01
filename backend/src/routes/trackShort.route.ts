import express from "express";
import * as trackShortController from "../controllers/trackShort.controller";
import { protect, authorize } from "../middlewares/auth.middleware";
import validate from "../middlewares/validate";
import {
  createShortSchema,
  shortIdParamSchema,
  updateShortSchema,
} from "../validations/trackShort.validation";

const router = express.Router();

// Public routes
router.get("/feed", trackShortController.getShortsFeed);
router.post("/:id/view", validate(shortIdParamSchema), trackShortController.recordView);
router.get("/:id", trackShortController.getShort);

// Admin routes
router.use(protect, authorize("admin"));
router.route("/")
  .get(trackShortController.getAllShorts)
  .post(validate(createShortSchema), trackShortController.createShort);

router.route("/:id")
  .patch(validate(updateShortSchema), trackShortController.updateShort)
  .delete(validate(shortIdParamSchema), trackShortController.deleteShort);

router.patch("/:id/publish", validate(shortIdParamSchema), trackShortController.publishShort);
router.patch("/:id/unpublish", validate(shortIdParamSchema), trackShortController.unpublishShort);

export default router;
