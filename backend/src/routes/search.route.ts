import express from "express";
import validate from "../middlewares/validate";
import * as searchController from "../controllers/search.controller";
import { searchSchema } from "../validations/search.schema";

const router = express.Router();

router.get("/", validate(searchSchema), searchController.search);

export default router;
