// src/controllers/search.controller.ts
import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import searchService from "../services/search.service";
import { SearchQueryInput } from "../validations/search.schema";

export const search = catchAsync(
  async (req: Request<{}, {}, {}, SearchQueryInput>, res: Response) => {
    const { q, limit } = req.query;

    const data = await searchService.searchEverything(q, limit);

    res.status(httpStatus.OK).json({
      status: "success",
      data,
    });
  },
);
