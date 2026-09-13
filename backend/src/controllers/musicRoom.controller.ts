// controllers/musicRoom.controller.ts

import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import musicRoomService from "../services/musicRoom.service";
import { IUser } from "../models/User";

// ─────────────────────────────────────────────────────────────────────────────
// ROOM CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/rooms
 * Tạo phòng mới — yêu cầu đăng nhập.
 */
export const createRoom = catchAsync(async (req: Request, res: Response) => {
  const room = await musicRoomService.createRoom(req.user as IUser, req.body);
  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Phòng đã được tạo thành công",
    data: room,
  });
});

/**
 * GET /api/rooms
 * Danh sách phòng public đang hoạt động.
 */
export const getPublicRooms = catchAsync(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const search = req.query.q as string | undefined;

  const result = await musicRoomService.getPublicRooms(page, limit, search);
  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});

/**
 * GET /api/rooms/:roomCode
 * Thông tin chi tiết phòng + playback state.
 */
export const getRoomByCode = catchAsync(async (req: Request, res: Response) => {
  const roomCode = req.params.roomCode as string;
  const password = req.headers["x-room-password"] as string | undefined;

  const room = await musicRoomService.getRoomByCode(roomCode, password);
  res.status(httpStatus.OK).json({
    success: true,
    data: room,
  });
});

/**
 * DELETE /api/rooms/:roomCode
 * Xóa/đóng phòng — Host or Admin only.
 */
export const deleteRoom = catchAsync(async (req: Request, res: Response) => {
  const roomCode = req.params.roomCode as string;
  const result = await musicRoomService.deleteRoom(roomCode, req.user as IUser);
  res.status(httpStatus.OK).json({
    success: true,
    message: result.message,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/rooms/:roomCode/queue
 * Thêm bài vào queue.
 */
export const addToQueue = catchAsync(async (req: Request, res: Response) => {
  const roomCode = req.params.roomCode as string;
  const { trackId } = req.body;

  if (!trackId) {
    return res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: "trackId là bắt buộc",
    });
  }

  const queue = await musicRoomService.addToQueue(
    roomCode,
    trackId,
    req.user as IUser,
  );
  res.status(httpStatus.OK).json({
    success: true,
    message: "Đã thêm bài vào queue",
    data: { queue },
  });
});

/**
 * DELETE /api/rooms/:roomCode/queue/:trackId
 * Xóa bài khỏi queue — Host only.
 */
export const removeFromQueue = catchAsync(async (req: Request, res: Response) => {
  const roomCode = req.params.roomCode as string;
  const trackId = req.params.trackId as string;

  const queue = await musicRoomService.removeFromQueue(
    roomCode,
    trackId,
    req.user as IUser,
  );
  res.status(httpStatus.OK).json({
    success: true,
    message: "Đã xóa bài khỏi queue",
    data: { queue },
  });
});

/**
 * POST /api/rooms/:roomCode/vote/:trackId
 * Vote/unvote bài tiếp theo.
 */
export const voteTrack = catchAsync(async (req: Request, res: Response) => {
  const roomCode = req.params.roomCode as string;
  const trackId = req.params.trackId as string;

  const result = await musicRoomService.voteTrack(
    roomCode,
    trackId,
    req.user as IUser,
  );
  res.status(httpStatus.OK).json({
    success: true,
    message: result.voted ? "Đã vote bài hát" : "Đã bỏ vote",
    data: result,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CHAT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/rooms/:roomCode/messages
 * Lịch sử chat.
 */
export const getChatHistory = catchAsync(async (req: Request, res: Response) => {
  const roomCode = req.params.roomCode as string;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

  const messages = await musicRoomService.getChatHistory(roomCode, page, limit);
  res.status(httpStatus.OK).json({
    success: true,
    data: messages,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MEMBER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/rooms/:roomCode/members
 * Lấy danh sách thành viên trong phòng.
 */
export const getMembers = catchAsync(async (req: Request, res: Response) => {
  const roomCode = req.params.roomCode as string;
  const members = await musicRoomService.getMembers(roomCode);
  res.status(httpStatus.OK).json({
    success: true,
    data: members,
  });
});

/**
 * POST /api/rooms/:roomCode/kick/:userId
 * Kick thành viên — Host only.
 */
export const kickUser = catchAsync(async (req: Request, res: Response) => {
  const roomCode = req.params.roomCode as string;
  const userId = req.params.userId as string;

  await musicRoomService.kickUser(roomCode, userId, req.user as IUser);
  res.status(httpStatus.OK).json({
    success: true,
    message: "Đã kick thành viên khỏi phòng",
  });
});
