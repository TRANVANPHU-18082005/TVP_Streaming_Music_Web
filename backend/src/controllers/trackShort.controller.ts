import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import trackShortService from "../services/trackShort.service";

export const createShort = catchAsync(async (req: Request, res: Response) => {
  const short = await trackShortService.createShort(req.body);
  res.status(httpStatus.CREATED).json({ success: true, data: short });
});

export const updateShort = catchAsync(async (req: Request, res: Response) => {
  const short = await trackShortService.updateShort(req.params.id as string, req.body);
  res.status(httpStatus.OK).json({ success: true, data: short });
});

export const deleteShort = catchAsync(async (req: Request, res: Response) => {
  await trackShortService.deleteShort(req.params.id as string);
  res.status(httpStatus.OK).json({ success: true, message: "Deleted successfully" });
});

export const getShort = catchAsync(async (req: Request, res: Response) => {
  const short = await trackShortService.getShortById(req.params.id as string);
  res.status(httpStatus.OK).json({ success: true, data: short });
});

export const getAllShorts = catchAsync(async (req: Request, res: Response) => {
  const result = await trackShortService.getAllShorts(req.query);
  res.status(httpStatus.OK).json({ success: true, data: result });
});

export const getShortsFeed = catchAsync(async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const cursor = req.query.cursor as string | undefined;

  const { feed, nextCursor } = await trackShortService.getShortsFeed(limit, cursor);
  res.status(httpStatus.OK).json({ success: true, data: { feed, nextCursor } });
});

export const publishShort = catchAsync(async (req: Request, res: Response) => {
  const short = await trackShortService.togglePublish(req.params.id as string, true);
  res.status(httpStatus.OK).json({ success: true, data: short });
});

export const unpublishShort = catchAsync(async (req: Request, res: Response) => {
  const short = await trackShortService.togglePublish(req.params.id as string, false);
  res.status(httpStatus.OK).json({ success: true, data: short });
});

export const recordView = catchAsync(async (req: Request, res: Response) => {
  await trackShortService.incrementView(req.params.id as string);
  res.status(httpStatus.OK).json({ success: true });
});
