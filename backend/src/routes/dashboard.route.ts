import express from "express";
import * as dashboardController from "../controllers/dashboard.controller";
import * as dashboardValidation from "../validations/dashboard.validation";

// Middlewares
import { authorize, protect } from "../middlewares/auth.middleware";
import validate from "../middlewares/validate";

const router = express.Router();

router.get(
  "/analytics",
  protect, // 1. Phải đăng nhập
  authorize("admin"), // 2. Phải là role Admin
  validate(dashboardValidation.getAnalyticsSchema), // 3. Validate Zod
  dashboardController.getAnalytics // 4. Controller
);

export default router;
