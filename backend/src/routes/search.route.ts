// src/routes/v1/search.route.ts
import express from "express";
import validate from "../middlewares/validate";
import * as searchController from "../controllers/search.controller";
import * as searchSchema from "../validations/search.schema";

const router = express.Router();

/**
 * @desc Lấy danh sách từ khóa hot
 */
router.get(
  "/trending",
  validate(searchSchema.trendingSchema),
  searchController.getTrending,
);

/**
 * @desc Autocomplete khi user đang gõ
 */
router.get(
  "/suggest",
  validate(searchSchema.suggestSchema),
  searchController.suggest,
);

/**
 * @desc Tìm kiếm tổng hợp (Full search)
 */
router.get("/", validate(searchSchema.searchSchema), searchController.search);

export default router;
