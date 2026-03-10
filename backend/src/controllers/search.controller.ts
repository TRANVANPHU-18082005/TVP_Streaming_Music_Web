import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import { SearchQueryInput } from "../validations/search.schema";
import searchService from "../services/search.service";

export const search = catchAsync(
  async (req: Request<{}, {}, {}, SearchQueryInput>, res: Response) => {
    const { q, limit } = req.query;

    const data = await searchService.searchEverything(q, limit);

    res.status(httpStatus.OK).json({
      status: "success",
      data,
    });
  }
);
