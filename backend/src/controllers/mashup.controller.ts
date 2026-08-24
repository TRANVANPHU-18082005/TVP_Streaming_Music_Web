import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import mashupService from "../services/mashup.service";
import mongoose from "mongoose";

export const createMashup = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?._id;
  // Auto-generate cover from first short if not provided
  const data = { ...req.body };
  if (!data.coverImage && data.shorts?.length > 0) {
    // Service handles auto-cover logic
  }
  const mashup = await mashupService.createMashup(userId, data);
  res.status(httpStatus.CREATED).json({ success: true, data: mashup });
});

export const getMashup = catchAsync(async (req: Request, res: Response) => {
  const mashup = await mashupService.getMashupById(req.params.id as string);
  res.status(httpStatus.OK).json({ success: true, data: mashup });
});

export const getFeed = catchAsync(async (req: Request, res: Response) => {
  const limit  = Math.min(Number(req.query.limit) || 10, 50);
  const cursor = req.query.cursor as string | undefined;
  const { feed, nextCursor } = await mashupService.getFeed(limit, cursor);
  res.status(httpStatus.OK).json({ success: true, data: { feed, nextCursor } });
});

export const getMyMashups = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?._id?.toString();
  if (!userId) return res.status(httpStatus.UNAUTHORIZED).json({ success: false, message: "Unauthorized" });
  const { data, total } = await mashupService.getMyMashups(userId, req.query);
  res.status(httpStatus.OK).json({ success: true, data: { data, total } });
});

export const updateMashup = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?._id?.toString();
  if (!userId) return res.status(httpStatus.UNAUTHORIZED).json({ success: false, message: "Unauthorized" });
  const mashup = await mashupService.updateMashup(req.params.id as string, userId, req.body);
  res.status(httpStatus.OK).json({ success: true, data: mashup });
});

export const deleteMashup = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?._id?.toString();
  if (!userId) return res.status(httpStatus.UNAUTHORIZED).json({ success: false, message: "Unauthorized" });
  await mashupService.deleteMashup(req.params.id as string, userId);
  res.status(httpStatus.OK).json({ success: true, message: "Mashup deleted" });
});

export const likeMashup = catchAsync(async (req: Request, res: Response) => {
  const result = await mashupService.toggleLike(req.params.id as string);
  res.status(httpStatus.OK).json({ success: true, data: result });
});

export const shareMashup = catchAsync(async (req: Request, res: Response) => {
  await mashupService.recordShare(req.params.id as string);
  res.status(httpStatus.OK).json({ success: true });
});

export const publishMashup = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?._id?.toString();
  if (!userId) return res.status(httpStatus.UNAUTHORIZED).json({ success: false, message: "Unauthorized" });
  const mashup = await mashupService.togglePublish(req.params.id as string, userId, true);
  res.status(httpStatus.OK).json({ success: true, data: mashup });
});

export const unpublishMashup = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?._id?.toString();
  if (!userId) return res.status(httpStatus.UNAUTHORIZED).json({ success: false, message: "Unauthorized" });
  const mashup = await mashupService.togglePublish(req.params.id as string, userId, false);
  res.status(httpStatus.OK).json({ success: true, data: mashup });
});

export const suggestShorts = catchAsync(async (req: Request, res: Response) => {
  const { currentShortIds } = req.body;
  if (!Array.isArray(currentShortIds)) {
    return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "currentShortIds must be an array" });
  }
  const suggestions = await mashupService.suggestNextShorts(currentShortIds);
  res.status(httpStatus.OK).json({ success: true, data: suggestions });
});

export const aiGenerateMashup = catchAsync(async (req: Request, res: Response) => {
  const randomShorts = await mongoose.model('TrackShort').aggregate([
    { $match: { isPublished: true } },
    { $sample: { size: 1 } }
  ]);

  if (!randomShorts || randomShorts.length === 0) {
    return res.status(httpStatus.NOT_FOUND).json({ success: false, message: "No shorts available" });
  }
  const short1 = await mongoose.model('TrackShort').findById(randomShorts[0]._id).populate('track').lean() as any;
  if (!short1) return res.status(httpStatus.NOT_FOUND).json({ success: false, message: "Short not found" });

  const suggestions1 = await mashupService.suggestNextShorts([short1._id.toString()]);
  const short2 = suggestions1.length > 0 ? suggestions1[0] : null;

  let short3 = null;
  if (short2) {
    const suggestions2 = await mashupService.suggestNextShorts([short1._id.toString(), short2._id.toString()]);
    short3 = suggestions2.length > 0 ? suggestions2[0] : null;
  }

  const aiShorts = [short1, short2, short3].filter(Boolean);
  res.status(httpStatus.OK).json({ success: true, data: aiShorts });
});
