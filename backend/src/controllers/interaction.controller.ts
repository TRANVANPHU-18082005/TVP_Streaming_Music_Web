import { Request, Response } from "express";
import catchAsync from "../utils/catchAsync";
import InteractionService from "../services/interaction.service";

export const toggleLike = catchAsync(async (req: Request, res: Response) => {
  const result = await InteractionService.toggleLikeTrack(
    req.user!._id.toString(),
    req.body.trackId
  );
  res.json({ success: true, data: result });
});

export const getLiked = catchAsync(async (req: Request, res: Response) => {
  const tracks = await InteractionService.getLikedTracks(
    req.user!._id.toString()
  );
  res.json({ success: true, data: tracks });
});
