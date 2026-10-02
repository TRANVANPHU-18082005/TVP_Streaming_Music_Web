import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import trackShortService from "../services/trackShort.service";

const actorFrom = (req: Request) => ({
  id: String(req.user!._id),
  role: req.user!.role,
});

export const createShort = catchAsync(async (req: Request, res: Response) => {
  const short = await trackShortService.createShort(req.body, actorFrom(req));
  res.status(httpStatus.CREATED).json({ success: true, data: short });
});

export const updateShort = catchAsync(async (req: Request, res: Response) => {
  const short = await trackShortService.updateShort(req.params.id as string, req.body, actorFrom(req));
  res.status(httpStatus.OK).json({ success: true, data: short });
});

export const deleteShort = catchAsync(async (req: Request, res: Response) => {
  await trackShortService.deleteShort(req.params.id as string, actorFrom(req));
  res.status(httpStatus.OK).json({ success: true, message: "Deleted successfully" });
});

export const getShort = catchAsync(async (req: Request, res: Response) => {
  const short = await trackShortService.getShortById(req.params.id as string);
  res.status(httpStatus.OK).json({ success: true, data: short });
});

export const getMyShorts = catchAsync(async (req: Request, res: Response) => {
  const result = await trackShortService.getMyShorts(String(req.user!._id), {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
  });
  res.status(httpStatus.OK).json({ success: true, data: result });
});

export const getAllShorts = catchAsync(async (req: Request, res: Response) => {
  const result = await trackShortService.getAllShorts(req.query as Record<string, unknown>);
  res.status(httpStatus.OK).json({ success: true, data: result });
});

export const listPublishedShorts = catchAsync(async (req: Request, res: Response) => {
  const result = await trackShortService.listPublished({
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
    search: typeof req.query.search === "string" ? req.query.search : undefined,
  });
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

export const rejectShort = catchAsync(async (req: Request, res: Response) => {
  const short = await trackShortService.rejectShort(req.params.id as string, req.body?.reason);
  res.status(httpStatus.OK).json({ success: true, data: short });
});

export const recordView = catchAsync(async (req: Request, res: Response) => {
  const identity = req.user?._id ? String(req.user._id) : req.ip || "guest";
  await trackShortService.incrementView(req.params.id as string, identity);
  res.status(httpStatus.OK).json({ success: true });
});

export const likeShort = catchAsync(async (req: Request, res: Response) => {
  const result = await trackShortService.toggleLike(String(req.user!._id), req.params.id as string);
  res.status(httpStatus.OK).json({ success: true, data: result });
});

export const shareShort = catchAsync(async (req: Request, res: Response) => {
  await trackShortService.recordShare(req.params.id as string);
  res.status(httpStatus.OK).json({ success: true });
});
