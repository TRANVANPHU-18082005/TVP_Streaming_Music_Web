import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import mashupService from "../services/mashup.service";
import mongoose from "mongoose";
import aiService from "../services/ai/ai.service";
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
  const limit = Math.min(Number(req.query.limit) || 10, 50);
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
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(httpStatus.BAD_REQUEST).json({ success: false, message: "Prompt is required" });
  }

  // 1. Ask Gemini to analyze the prompt
  const aiResult = await aiService.generateMashupPlan(prompt);
  if (!aiResult.success) {
    const isOverloaded = (aiResult as any).message?.includes('503') || (aiResult as any).message?.includes('high demand');
    return res.status(isOverloaded ? httpStatus.SERVICE_UNAVAILABLE : httpStatus.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: (aiResult as any).message || "AI Analysis failed" });
  }

  const { moods = [], genres = [], keywords = [] } = aiResult?.data?.aiAnalysis || {};

  // 2. Find tracks that match the criteria
  const query: any = { isPublic: true, isDeleted: false, status: 'ready' };
  const orConditions: any[] = [];

  if (moods.length > 0) {
    orConditions.push({ "aiMetadata.moods": { $in: moods } });
  }
  if (keywords.length > 0) {
    orConditions.push({ $text: { $search: keywords.join(" ") } });
  }
  // We skip genres in OR condition for simplicity unless we resolve genre IDs, 
  // but let's just use text search on keywords and moods.

  if (orConditions.length > 0) {
    query.$or = orConditions;
  }

  // Fetch candidate tracks
  let trackCandidates = await mongoose.model('Track').find(query)
    .sort({ playCount: -1 })
    .limit(30)
    .lean();

  if (trackCandidates.length === 0) {
    // Fallback: If AI search yields nothing, just get popular tracks
    trackCandidates = await mongoose.model('Track').find({ isPublic: true, isDeleted: false, status: 'ready' })
      .sort({ playCount: -1 })
      .limit(30)
      .lean();
      
    if (trackCandidates.length === 0) {
      return res.status(httpStatus.NOT_FOUND).json({ success: false, message: "No tracks available in the system" });
    }
  }

  const trackIds = trackCandidates.map(t => t._id);

  // 3. Find shorts for these tracks
  let candidateShorts: any[] = await mongoose.model('TrackShort').find({
    track: { $in: trackIds },
    isPublished: true
  }).populate('track').lean() as any[];

  if (candidateShorts.length < 2) {
    // Fallback: Get ANY published shorts in the system
    candidateShorts = await mongoose.model('TrackShort').find({
      isPublished: true
    }).populate('track').lean() as any[];
    
    if (candidateShorts.length < 2) {
      // Final fallback: Get ANY shorts (even unpublished) for dev testing
      candidateShorts = await mongoose.model('TrackShort').find({}).populate('track').lean() as any[];
      
      if (candidateShorts.length < 2) {
        return res.status(httpStatus.NOT_FOUND).json({ success: false, message: "Hệ thống chưa có đủ video (TrackShort) để tạo mashup. Vui lòng tạo ít nhất 2 short video trước!" });
      }
    }
  }

  // 4. Select the best 3-5 shorts using compatibility score
  // Start with a random one from the top matching shorts
  const selectedShorts: any[] = [];
  const firstShort = candidateShorts[Math.floor(Math.random() * Math.min(5, candidateShorts.length))];
  selectedShorts.push(firstShort);

  const NUM_SHORTS = Math.floor(Math.random() * 3) + 3; // 3 to 5 shorts

  for (let i = 1; i < NUM_SHORTS; i++) {
    const lastShort = selectedShorts[selectedShorts.length - 1];
    if (!lastShort || !lastShort.track) break;

    // Filter out already selected tracks
    const selectedTrackIds = selectedShorts.map(s => s.track._id.toString());
    const remaining = candidateShorts.filter(s => s.track && !selectedTrackIds.includes(s.track._id.toString()));

    if (remaining.length === 0) break;

    // Score remaining candidates against the last short
    const scored = remaining.map(candidate => {
      // @ts-ignore
      const comp = mashupService.calculatePairCompatibility(lastShort.track, candidate.track);
      return { ...candidate, compatibilityScore: comp.score };
    });

    // Sort by score
    scored.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    // Pick the best one
    selectedShorts.push(scored[0]);
  }

  res.status(httpStatus.OK).json({ success: true, data: selectedShorts });
});
