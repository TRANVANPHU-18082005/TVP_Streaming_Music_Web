// src/routes/search.route.ts
import express from "express";
import validate from "../middlewares/validate";
import * as searchController from "../controllers/search.controller";
import { searchSchema } from "../validations/search.schema";

const router = express.Router();

/**
 * @route GET /api/v1/search
 * @desc Search tracks, artists, albums and playlists
 */
router.get("/", validate(searchSchema), searchController.search);

export default router;
