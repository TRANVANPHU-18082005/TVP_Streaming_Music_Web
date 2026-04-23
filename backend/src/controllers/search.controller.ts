// src/controllers/search.controller.ts
import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import searchService from "../services/search.service";
import {
  SearchQueryInput,
  SuggestQueryInput,
  TrendingQueryInput,
} from "../validations/search.schema";

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

/** Suggestion - Gọi khi đang gõ (Autocomplete) */
export const suggest = catchAsync(
  async (req: Request<{}, {}, {}, SuggestQueryInput>, res: Response) => {
    const { q, limit } = req.query;
    const data = await searchService.suggest(q, limit);

    res.status(httpStatus.OK).send({
      status: "success",
      data,
    });
  },
);

/** Trending - Lấy từ khóa hot từ Redis */
export const getTrending = catchAsync(
  async (req: Request<{}, {}, {}, TrendingQueryInput>, res: Response) => {
    const { top } = req.query;
    const data = await searchService.getTrending(top);

    res.status(httpStatus.OK).send({
      status: "success",
      data,
    });
  },
);
