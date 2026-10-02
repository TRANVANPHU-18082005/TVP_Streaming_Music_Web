// services/musicRoom.service.ts

import mongoose from "mongoose";
import httpStatus from "http-status";
import MusicRoom, { IMusicRoom, IQueueItem, QueueMode } from "../models/MusicRoom";
import RoomMessage from "../models/RoomMessage";
import Track from "../models/Track";
import Playlist from "../models/Playlist";
import User, { IUser } from "../models/User";
import {
  acquireRoomPlayLock,
  endsAtFrom,
  pausePosition,
  pickNextQueueItem,
  releaseRoomPlayLock,
  resumeStartedAt,
  stampServerNow,
} from "./musicRoom.playback";
import { RoomErrorCode } from "../config/constants";
import ApiError from "../utils/ApiError";
import { cacheRedis } from "../config/redis";
import { getIO } from "../socket";
import { hashRoomPassword, roomPasswordMatches } from "../utils/roomPassword";
import {
  buildCacheKey,
  invalidateCachePrefixes,
  rememberJson,
} from "../utils/cacheHelper";

// ─────────────────────────────────────────────────────────────────────────────
// REDIS KEY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const redisKeys = {
  members: (code: string) => `room:members:${code}`,
  state: (code: string) => `room:state:${code}`,
  votes: (code: string) => `room:votes:${code}`,
  requests: (code: string) => `room:requests:${code}`,
  msgRateLimit: (userId: string) => `room:ratelimit:msg:${userId}`,
};

// ─────────────────────────────────────────────────────────────────────────────
// PLAYBACK STATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lưu trạng thái phát nhạc vào Redis (TTL 24h).
 * Client dùng startedAt để tự tính currentTime, tránh server phải push liên tục.
 */
export const savePlaybackStateToRedis = async (
  roomCode: string,
  state: {
    currentTrackId: string | null;
    startedAt: number | null;
    isPaused: boolean;
    pausedAt: number;
    endsAt?: number | null;
  },
) => {
  const key = redisKeys.state(roomCode);
  await cacheRedis.hset(key, {
    currentTrackId: state.currentTrackId ?? "",
    startedAt: String(state.startedAt ?? 0),
    isPaused: state.isPaused ? "1" : "0",
    pausedAt: String(state.pausedAt),
    endsAt: String(state.endsAt ?? 0),
  });
  await cacheRedis.expire(key, 86400); // 24h
};

/**
 * Lấy trạng thái phát nhạc từ Redis.
 */
export const getPlaybackStateFromRedis = async (roomCode: string) => {
  const key = redisKeys.state(roomCode);
  const raw = await cacheRedis.hgetall(key);
  if (!raw || !raw.startedAt) return null;
  return stampServerNow({
    currentTrackId: raw.currentTrackId || null,
    startedAt: parseInt(raw.startedAt, 10) || null,
    isPaused: raw.isPaused === "1",
    pausedAt: parseFloat(raw.pausedAt) || 0,
    endsAt: parseInt(raw.endsAt, 10) || null,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// ROOM CRUD
// ─────────────────────────────────────────────────────────────────────────────

interface CreateRoomDto {
  name: string;
  description?: string;
  theme?: IMusicRoom["theme"];
  isPublic?: boolean;
  maxMembers?: number;
  password?: string;
  queueMode?: QueueMode;
  trackId?: string;
  playlistId?: string;
}

const userIdOf = (user: { _id?: unknown }) => String(user._id ?? "");

const isRoomHostUser = (room: { host: { toString(): string } }, userId: string) =>
  room.host.toString() === userId;

const isRoomCoHost = (room: { coHosts?: { toString(): string }[] }, userId: string) =>
  (room.coHosts ?? []).some((id) => id.toString() === userId);

export const canControlPlayback = (
  room: { host: { toString(): string }; coHosts?: { toString(): string }[] },
  userId: string,
) => isRoomHostUser(room, userId) || isRoomCoHost(room, userId);

/**
 * Tạo phòng mới.
 */
export const createRoom = async (user: IUser, dto: CreateRoomDto) => {
  // Kiểm tra user đã có phòng active chưa — mỗi user chỉ được host 1 phòng cùng lúc
  const existingRoom = await MusicRoom.findOne({ host: user._id, isActive: true }).lean();
  if (existingRoom) {
    throw new ApiError(
      httpStatus.CONFLICT,
      `Bạn đang có phòng "${existingRoom.name}" đang hoạt động. Hãy đóng phòng cũ trước khi tạo phòng mới.`,
      "ROOM_ALREADY_EXISTS",
      true,
      "",
      undefined,
      { roomCode: existingRoom.roomCode, roomName: existingRoom.name },
    );
  }

  const isPublic = dto.isPublic !== false;
  const maxMembers = isPublic ? 50 : Math.min(dto.maxMembers ?? 20, 50);
  const queueMode: QueueMode = dto.queueMode ?? (isPublic ? "open" : "approval");

  const roomData: Partial<IMusicRoom> = {
    name: dto.name.trim(),
    description: dto.description,
    theme: dto.theme ?? "bar",
    host: user._id as mongoose.Types.ObjectId,
    isPublic,
    maxMembers,
    queueMode,
    isActive: true,
    memberCount: 0,
    queue: [],
    currentTrackIndex: -1,
    isPaused: false,
  };

  if (!isPublic && dto.password) {
    roomData.password = await hashRoomPassword(dto.password);
  }

  const room = await MusicRoom.create(roomData);
  if (dto.playlistId) {
    await addCollectionToQueue(room.roomCode, user, { playlistId: dto.playlistId });
  } else if (dto.trackId) {
    await addToQueue(room.roomCode, dto.trackId, user);
  }
  if (dto.playlistId || dto.trackId) {
    const queued = await MusicRoom.findOne({ roomCode: room.roomCode, isActive: true }).select("queue");
    if (queued && queued.queue.length > 0) {
      await playNext(room.roomCode, user);
    }
  }
  const safeRoom = room.toObject();
  delete safeRoom.password;
  if (isPublic) invalidateCachePrefixes(["room:public:*"]);
  return safeRoom;
};

export const getMyActiveRoom = async (user: IUser) => {
  return MusicRoom.findOne({ host: user._id, isActive: true })
    .populate("host", "fullName username avatar")
    .populate("currentTrack", "title coverImage duration artist")
    .select("-password")
    .lean();
};

/**
 * Lấy danh sách phòng public đang hoạt động.
 */
export const getPublicRooms = async (page = 1, limit = 20, search?: string) => {
  const cacheKey = buildCacheKey("room:public", "guest", {
    page,
    limit,
    search: search ?? "",
  });
  return rememberJson(cacheKey, 20, () => loadPublicRooms(page, limit, search));
};

const loadPublicRooms = async (page = 1, limit = 20, search?: string) => {
  const skip = (page - 1) * limit;

  const filter: any = { isPublic: true, isActive: true };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { roomCode: { $regex: search, $options: "i" } },
    ];
  }

  const [rooms, total] = await Promise.all([
    MusicRoom.find(filter)
      .sort({ memberCount: -1, lastActivityAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("host", "fullName username avatar")
      .populate("currentTrack", "title coverImage duration")
      .lean(),
    MusicRoom.countDocuments(filter),
  ]);

  return {
    rooms,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Lấy thông tin chi tiết một phòng theo roomCode.
 */
export const getRoomByCode = async (roomCode: string, password?: string) => {
  const room = await MusicRoom.findOne({ roomCode, isActive: true })
    .populate("host", "fullName username avatar")
    .populate({
      path: "currentTrack",
      select: "title coverImage duration artist hlsUrl trackUrl moodVideo",
      populate: [
        { path: "artist", select: "name" },
        { path: "moodVideo" }
      ],
    })
    .populate({
      path: "queue.track",
      select: "title coverImage duration artist",
      populate: { path: "artist", select: "name" },
    })
    .populate("currentMoodVideo")
    .select("+password");

  if (!room) {
    throw new ApiError(httpStatus.NOT_FOUND, "Phòng không tồn tại hoặc đã đóng");
  }

  // Private rooms accept a bcrypt hash only. Plaintext rows fail closed
  // until `npm run migrate:room-passwords` rewrites them.
  if (!room.isPublic && !(await roomPasswordMatches(room.password, password))) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Mật khẩu phòng không đúng",
      RoomErrorCode.WRONG_PASSWORD,
    );
  }

  // Lấy playback state từ Redis (ưu tiên Redis vì realtime hơn)
  const redisState = await getPlaybackStateFromRedis(roomCode);

  const roomObj = room.toObject() as any;
  // Xóa password khỏi response
  delete roomObj.password;

  return {
    ...roomObj,
    playbackState: redisState ?? {
      currentTrackId: room.currentTrack?._id?.toString() ?? room.currentTrack?.toString() ?? null,
      startedAt: room.startedAt?.getTime() ?? null,
      isPaused: room.isPaused,
      pausedAt: room.pausedAt ?? 0,
    },
  };
};

/**
 * Xóa phòng (soft delete) — chỉ Host.
 */
export const deleteRoom = async (roomCode: string, user: IUser) => {
  const room = await MusicRoom.findOne({ roomCode });
  if (!room) throw new ApiError(httpStatus.NOT_FOUND, "Phòng không tồn tại");

  const isHost = room.host.toString() === user._id?.toString();
  const isAdmin = user.role === "admin";
  if (!isHost && !isAdmin) {
    throw new ApiError(httpStatus.FORBIDDEN, "Chỉ Host mới có thể đóng phòng");
  }

  room.isActive = false;
  await room.save();
  if (room.isPublic) invalidateCachePrefixes(["room:public:*"]);

  // Dọn Redis
  await Promise.all([
    cacheRedis.del(redisKeys.members(roomCode)),
    cacheRedis.del(redisKeys.state(roomCode)),
    cacheRedis.del(redisKeys.votes(roomCode)),
  ]);

  // Thông báo tất cả members phòng bị đóng
  try {
    getIO().to(`music_room:${roomCode}`).emit("room:closed", {
      roomCode,
      reason: "Host đã đóng phòng",
    });
  } catch {}

  return { message: "Phòng đã được đóng" };
};

// ─────────────────────────────────────────────────────────────────────────────
// TRACK REQUEST MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export interface ITrackRequest {
  trackId: string;
  trackTitle: string;
  coverImage?: string;
  artistName?: string;
  count: number;
  requestedBy: string[]; // Danh sách userId
  lastRequestedAt: number;
}

/**
 * Listener gửi yêu cầu bài hát
 */
export const requestTrack = async (roomCode: string, trackId: string, user: IUser) => {
  const room = await MusicRoom.findOne({ roomCode, isActive: true });
  if (!room) throw new ApiError(httpStatus.NOT_FOUND, "Phòng không tồn tại");

  const track = await Track.findOne({ _id: trackId, isPublic: true, status: "ready" }).populate("artist", "name").lean();
  if (!track) throw new ApiError(httpStatus.NOT_FOUND, "Bài hát không tồn tại");

  // Cập nhật hoạt động phòng
  await MusicRoom.updateOne({ _id: room._id }, { lastActivityAt: new Date() });

  const key = redisKeys.requests(roomCode);
  const existingRaw = await cacheRedis.hget(key, trackId);
  let requestData: ITrackRequest;

  if (existingRaw) {
    requestData = JSON.parse(existingRaw);
    if (!requestData.requestedBy.includes(user._id?.toString() ?? "")) {
      requestData.requestedBy.push(user._id?.toString() ?? "");
      requestData.count += 1;
    }
    requestData.lastRequestedAt = Date.now();
  } else {
    requestData = {
      trackId: track._id?.toString() ?? "",
      trackTitle: track.title,
      coverImage: track.coverImage,
      artistName: (track.artist as any)?.name ?? "Unknown",
      count: 1,
      requestedBy: [user._id?.toString() ?? ""],
      lastRequestedAt: Date.now(),
    };
  }

  await cacheRedis.hset(key, trackId, JSON.stringify(requestData));
  await cacheRedis.expire(key, 86400); // 24h

  return requestData;
};

/**
 * Lấy danh sách yêu cầu bài hát của phòng (để Host xem)
 */
export const getTrackRequests = async (roomCode: string) => {
  const key = redisKeys.requests(roomCode);
  const rawRequests = await cacheRedis.hgetall(key);
  const requests: ITrackRequest[] = [];
  
  for (const trackId in rawRequests) {
    requests.push(JSON.parse(rawRequests[trackId]));
  }

  // Sort: count giảm dần, nếu bằng thì thời gian gần nhất lên trên
  requests.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.lastRequestedAt - a.lastRequestedAt;
  });

  return requests;
};

/**
 * Host duyệt/xóa yêu cầu bài hát
 */
export const handleRequest = async (roomCode: string, trackId: string, action: "approve" | "reject", user: IUser) => {
  const room = await MusicRoom.findOne({ roomCode, isActive: true });
  if (!room) throw new ApiError(httpStatus.NOT_FOUND, "Phòng không tồn tại");
  if (room.host.toString() !== user._id?.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, "Chỉ Host mới có quyền duyệt yêu cầu");
  }

  const key = redisKeys.requests(roomCode);
  const rawRequest = await cacheRedis.hget(key, trackId);
  if (!rawRequest) return { success: false, message: "Yêu cầu không tồn tại hoặc đã được xử lý" };

  if (action === "approve") {
    // Add to queue
    await addToQueue(roomCode, trackId, user);
  }

  // Remove from requests
  await cacheRedis.hdel(key, trackId);
  return { success: true };
};

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thêm bài hát vào queue.
 */
export const addToQueue = async (
  roomCode: string,
  trackId: string,
  user: IUser,
) => {
  const [room, track] = await Promise.all([
    MusicRoom.findOne({ roomCode, isActive: true }),
    Track.findOne({ _id: trackId, isPublic: true, status: "ready", isDeleted: false }).lean(),
  ]);

  if (!room) throw new ApiError(httpStatus.NOT_FOUND, "Phòng không tồn tại");
  if (!track) throw new ApiError(httpStatus.NOT_FOUND, "Bài hát không tồn tại hoặc chưa sẵn sàng");
  assertCanAddToQueue(room, user);
  if (room.queue.length >= 30) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Queue đã đầy (tối đa 30 bài)");
  }

  // Kiểm tra trùng bài trong queue
  const alreadyInQueue = room.queue.some(
    (item) => item.track.toString() === trackId,
  );
  if (alreadyInQueue) {
    throw new ApiError(httpStatus.CONFLICT, "Bài hát đã có trong queue");
  }

  const queueItem: Partial<IQueueItem> = {
    track: new mongoose.Types.ObjectId(trackId),
    addedBy: user._id as mongoose.Types.ObjectId,
    addedAt: new Date(),
    votes: 0,
    voters: [],
  };

  room.queue.push(queueItem as IQueueItem);
  room.lastActivityAt = new Date();
  await room.save();

  await room.populate({
    path: "queue.track",
    select: "title coverImage duration artist",
    populate: { path: "artist", select: "name" },
  });

  try {
    getIO().to(`music_room:${roomCode}`).emit("room:queue_update", { queue: room.queue });
  } catch (err) {
    console.error("[Socket] room:queue_update error:", err);
  }

  return room.queue;
};

/**
 * Xóa bài khỏi queue — Host only.
 */
export const removeFromQueue = async (
  roomCode: string,
  trackId: string,
  user: IUser,
) => {
  const room = await MusicRoom.findOne({ roomCode, isActive: true });
  if (!room) throw new ApiError(httpStatus.NOT_FOUND, "Phòng không tồn tại");

  const isHost = room.host.toString() === user._id?.toString();
  if (!isHost) throw new ApiError(httpStatus.FORBIDDEN, "Chỉ Host mới có thể xóa bài khỏi queue");

  const initialLength = room.queue.length;
  room.queue = room.queue.filter((item) => item.track.toString() !== trackId) as mongoose.Types.DocumentArray<IQueueItem>;

  if (room.queue.length === initialLength) {
    throw new ApiError(httpStatus.NOT_FOUND, "Bài hát không có trong queue");
  }

  room.lastActivityAt = new Date();
  await room.save();

  await room.populate({
    path: "queue.track",
    select: "title coverImage duration artist",
    populate: { path: "artist", select: "name" },
  });

  try {
    getIO().to(`music_room:${roomCode}`).emit("room:queue_update", { queue: room.queue });
  } catch (err) {
    console.error("[Socket] room:queue_update error:", err);
  }

  return room.queue;
};

/**
 * Vote bài tiếp theo — mỗi user vote 1 lần/bài.
 */
export const voteTrack = async (
  roomCode: string,
  trackId: string,
  user: IUser,
) => {
  const room = await MusicRoom.findOne({ roomCode, isActive: true });
  if (!room) throw new ApiError(httpStatus.NOT_FOUND, "Phòng không tồn tại");

  const queueItem = room.queue.find((item) => item.track.toString() === trackId);
  if (!queueItem) {
    throw new ApiError(httpStatus.NOT_FOUND, "Bài hát không có trong queue");
  }

  const userId = user._id as mongoose.Types.ObjectId;
  const alreadyVoted = queueItem.voters.some(
    (v) => v.toString() === userId.toString(),
  );

  if (alreadyVoted) {
    // Toggle: bỏ vote
    queueItem.voters = queueItem.voters.filter(
      (v) => v.toString() !== userId.toString(),
    ) as mongoose.Types.Array<mongoose.Types.ObjectId>;
    queueItem.votes = Math.max(0, queueItem.votes - 1);
  } else {
    queueItem.voters.push(userId);
    queueItem.votes += 1;
  }

  room.lastActivityAt = new Date();
  await room.save();

  await room.populate({
    path: "queue.track",
    select: "title coverImage duration artist",
    populate: { path: "artist", select: "name" },
  });

  // Sort queue theo votes (bài nhiều vote lên trên)
  const sorted = [...room.queue].sort((a, b) => b.votes - a.votes);

  try {
    getIO().to(`music_room:${roomCode}`).emit("room:queue_update", { queue: sorted });
  } catch (err) {
    console.error("[Socket] room:queue_update error:", err);
  }

  return { queue: sorted, voted: !alreadyVoted };
};

// ─────────────────────────────────────────────────────────────────────────────
// PLAYBACK CONTROL (Host only)
// ─────────────────────────────────────────────────────────────────────────────

const assertCanAddToQueue = (
  room: { host: { toString(): string }; coHosts?: { toString(): string }[]; queueMode?: string },
  user: IUser,
) => {
  if (room.queueMode !== "approval") return;
  const userId = userIdOf(user);
  if (canControlPlayback(room, userId)) return;
  throw new ApiError(
    httpStatus.BAD_REQUEST,
    "Phòng này cần host duyệt bài. Hãy gửi yêu cầu.",
    "QUEUE_APPROVAL",
  );
};

const emitRoom = (roomCode: string, event: string, payload: unknown) => {
  try {
    getIO().to(`music_room:${roomCode}`).emit(event, payload);
  } catch (err) {
    console.error(`[Socket] ${event} error:`, err);
  }
};

/**
 * Chuyển sang bài tiếp theo trong queue.
 * user = null khi cron gọi (server quyết định hết bài).
 */
export const playNext = async (roomCode: string, user: IUser | null) => {
  const locked = await acquireRoomPlayLock(cacheRedis, roomCode);
  if (!locked) {
    throw new ApiError(httpStatus.CONFLICT, "Đang chuyển bài", "PLAY_LOCK");
  }

  try {
    const room = await MusicRoom.findOne({ roomCode, isActive: true });
    if (!room) throw new ApiError(httpStatus.NOT_FOUND, "Phòng không tồn tại");
    if (user && !canControlPlayback(room, userIdOf(user))) {
      throw new ApiError(httpStatus.FORBIDDEN, "Chỉ Host mới có thể điều khiển phát nhạc");
    }
    if (room.queue.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Queue trống, không có bài để phát", "QUEUE_EMPTY");
    }

    const picked = pickNextQueueItem(
      room.queue.map((item) => ({
        trackId: item.track.toString(),
        addedBy: item.addedBy.toString(),
        votes: item.votes ?? 0,
      })),
      room.lastPlayedBy ? room.lastPlayedBy.toString() : null,
    );
    if (!picked) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Queue trống, không có bài để phát", "QUEUE_EMPTY");
    }

    const now = new Date();
    room.currentTrack = new mongoose.Types.ObjectId(picked.trackId);
    room.lastPlayedBy = new mongoose.Types.ObjectId(picked.addedBy);
    room.startedAt = now;
    room.isPaused = false;
    room.pausedAt = 0;
    room.queue = room.queue.filter(
      (item) => item.track.toString() !== picked.trackId,
    ) as mongoose.Types.DocumentArray<IQueueItem>;
    room.lastActivityAt = now;
    await room.save();

    await room.populate([
      {
        path: "queue.track",
        select: "title coverImage duration artist",
        populate: { path: "artist", select: "name" },
      },
      {
        path: "currentTrack",
        select: "title coverImage duration artist hlsUrl trackUrl moodVideo",
        populate: [
          { path: "artist", select: "name" },
          { path: "moodVideo" },
        ],
      },
    ]);

    const duration = Number((room.currentTrack as { duration?: number } | null)?.duration ?? 0);
    const endsAt = endsAtFrom(now.getTime(), duration);
    room.endsAt = endsAt ? new Date(endsAt) : null;
    await room.save();

    emitRoom(roomCode, "room:queue_update", {
      queue: room.queue,
      currentTrack: room.currentTrack,
    });

    const playbackState = stampServerNow({
      currentTrackId: room.currentTrack?._id?.toString() ?? picked.trackId,
      startedAt: now.getTime(),
      isPaused: false,
      pausedAt: 0,
      endsAt,
      track: room.currentTrack,
    });

    await savePlaybackStateToRedis(roomCode, playbackState);
    emitRoom(roomCode, "room:playback_update", playbackState);
    return playbackState;
  } finally {
    await releaseRoomPlayLock(cacheRedis, roomCode);
  }
};

/**
 * Pause/Resume phát nhạc.
 */
export const togglePause = async (roomCode: string, user: IUser) => {
  const room = await MusicRoom.findOne({ roomCode, isActive: true }).populate(
    "currentTrack",
    "duration",
  );
  if (!room) throw new ApiError(httpStatus.NOT_FOUND, "Phòng không tồn tại");
  if (!canControlPlayback(room, userIdOf(user))) {
    throw new ApiError(httpStatus.FORBIDDEN, "Chỉ Host mới có thể điều khiển phát nhạc");
  }
  if (!room.currentTrack) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Phòng chưa có bài để phát");
  }

  const nowMs = Date.now();
  if (room.isPaused) {
    const startedAt = resumeStartedAt(nowMs, room.pausedAt ?? 0);
    room.startedAt = new Date(startedAt);
    room.isPaused = false;
    room.pausedAt = 0;
    const duration = Number((room.currentTrack as { duration?: number }).duration ?? 0);
    const endsAt = endsAtFrom(startedAt, duration);
    room.endsAt = endsAt ? new Date(endsAt) : null;
  } else {
    room.isPaused = true;
    room.pausedAt = pausePosition(nowMs, room.startedAt?.getTime() ?? null);
    room.endsAt = null;
  }
  room.lastActivityAt = new Date(nowMs);
  await room.save();

  const playbackState = stampServerNow({
    currentTrackId: room.currentTrack?._id?.toString() ?? room.currentTrack?.toString() ?? null,
    startedAt: room.startedAt?.getTime() ?? null,
    isPaused: room.isPaused,
    pausedAt: room.pausedAt ?? 0,
    endsAt: room.endsAt?.getTime() ?? null,
  });

  await savePlaybackStateToRedis(roomCode, playbackState);
  emitRoom(roomCode, "room:playback_update", playbackState);
  return playbackState;
};

const settleEndedRoom = async (roomCode: string) => {
  const room = await MusicRoom.findOne({ roomCode, isActive: true });
  if (!room || room.isPaused || !room.endsAt || room.endsAt.getTime() > Date.now()) return;
  if (room.queue.length > 0) return;

  const nowMs = Date.now();
  room.isPaused = true;
  room.pausedAt = pausePosition(nowMs, room.startedAt?.getTime() ?? null);
  room.endsAt = null;
  room.lastActivityAt = new Date(nowMs);
  await room.save();

  const playbackState = stampServerNow({
    currentTrackId: room.currentTrack?.toString() ?? null,
    startedAt: room.startedAt?.getTime() ?? null,
    isPaused: true,
    pausedAt: room.pausedAt ?? 0,
    endsAt: null,
  });
  await savePlaybackStateToRedis(roomCode, playbackState);
  emitRoom(roomCode, "room:playback_update", playbackState);
  emitRoom(roomCode, "room:queue_empty", {
    message: "Hết nhạc rồi. Hãy thêm bài mới để nghe tiếp.",
  });
};

export const advanceDueRooms = async () => {
  const due = await MusicRoom.find({
    isActive: true,
    isPaused: false,
    endsAt: { $ne: null, $lte: new Date() },
  })
    .select("roomCode")
    .limit(30)
    .lean();

  for (const row of due) {
    try {
      await playNext(row.roomCode, null);
    } catch (err) {
      const code = (err as ApiError).errorCode;
      if (code === "PLAY_LOCK") continue;
      if (code === "QUEUE_EMPTY") {
        await settleEndedRoom(row.roomCode);
        continue;
      }
      console.error(`[RoomPlayback] ${row.roomCode}:`, err);
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CHAT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gửi tin nhắn chat (kèm rate-limit Redis 5 msg / 5s).
 */
export const sendMessage = async (
  roomCode: string,
  user: IUser,
  content: string,
  type: "text" | "reaction" = "text",
  reaction?: string,
) => {
  // Rate-limit: 5 tin nhắn / 5 giây
  const rlKey = redisKeys.msgRateLimit(user._id?.toString() ?? "");
  const count = await cacheRedis.incr(rlKey);
  if (count === 1) await cacheRedis.expire(rlKey, 5);
  if (count > 5) {
    throw new ApiError(httpStatus.TOO_MANY_REQUESTS, "Gửi tin quá nhanh, vui lòng chậm lại");
  }

  const room = await MusicRoom.findOne({ roomCode, isActive: true }).lean();
  if (!room) throw new ApiError(httpStatus.NOT_FOUND, "Phòng không tồn tại");

  const msg = await RoomMessage.create({
    room: room._id,
    sender: user._id,
    senderName: user.fullName || user.username,
    senderAvatar: user.avatar || "",
    content: content.slice(0, 300),
    type,
    reaction: type === "reaction" ? reaction : undefined,
  });

  // Cập nhật thời gian hoạt động phòng
  await MusicRoom.updateOne({ _id: room._id }, { lastActivityAt: new Date() });

  return msg;
};

/**
 * Lấy lịch sử chat (phân trang ngược — tin mới nhất trước).
 */
export const getChatHistory = async (
  roomCode: string,
  page = 1,
  limit = 50,
) => {
  const room = await MusicRoom.findOne({ roomCode }).lean();
  if (!room) throw new ApiError(httpStatus.NOT_FOUND, "Phòng không tồn tại");

  const skip = (page - 1) * limit;
  const messages = await RoomMessage.find({ room: room._id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return messages.reverse(); // Trả về thứ tự cũ → mới để FE hiển thị
};

// ─────────────────────────────────────────────────────────────────────────────
// HOST TRANSFER & MEMBER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chuyển quyền Host sang user khác.
 */
export const transferHost = async (
  roomCode: string,
  newHostId: string,
) => {
  const nextHostId = new mongoose.Types.ObjectId(newHostId);
  await MusicRoom.updateOne(
    { roomCode },
    {
      $set: { host: nextHostId },
      $pull: { coHosts: nextHostId },
    },
  );
};

export const assignHost = async (roomCode: string, user: IUser, newHostId: string) => {
  const room = await MusicRoom.findOne({ roomCode, isActive: true });
  if (!room) throw new ApiError(httpStatus.NOT_FOUND, "Phòng không tồn tại");
  if (!isRoomHostUser(room, userIdOf(user))) {
    throw new ApiError(httpStatus.FORBIDDEN, "Chỉ Host mới chuyển được quyền host");
  }
  if (newHostId === userIdOf(user)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Bạn đang là host");
  }
  const present = await cacheRedis.hexists(`room:sessions:${roomCode}`, newHostId);
  if (!present) throw new ApiError(httpStatus.BAD_REQUEST, "Người này chưa ở trong phòng");
  await transferHost(roomCode, newHostId);
  emitRoom(roomCode, "room:host_changed", { newHostId });
  return { newHostId };
};

/**
 * Lấy danh sách thành viên trong phòng từ Redis và DB
 */
export const getMembers = async (roomCode: string) => {
  const memberIds = await cacheRedis.hkeys(`room:sessions:${roomCode}`);
  if (!memberIds || memberIds.length === 0) return [];
  
  const validMemberIds = memberIds.filter((id: string) => !id.startsWith("guest_"));
  if (validMemberIds.length === 0) return [];

  const room = await MusicRoom.findOne({ roomCode, isActive: true }).select("mutedUsers coHosts host").lean();
  const mutedUsersSet = new Set((room?.mutedUsers || []).map((id: any) => id.toString()));
  const coHostSet = new Set((room?.coHosts || []).map((id: any) => id.toString()));

  const users = await User.find({ _id: { $in: validMemberIds } })
    .select("_id fullName username avatar")
    .lean();
    
  // Map kết quả thành array
  return users.map((u: any) => ({
    userId: u._id.toString(),
    fullName: u.fullName,
    username: u.username,
    avatar: u.avatar,
    isMuted: mutedUsersSet.has(u._id.toString()),
    isCoHost: coHostSet.has(u._id.toString()),
    isHost: room?.host?.toString() === u._id.toString(),
  }));
};

/**
 * Kick user khỏi phòng (Host only).
 */
export const kickUser = async (
  roomCode: string,
  targetUserId: string,
  user: IUser,
) => {
  const room = await MusicRoom.findOne({ roomCode });
  if (!room) throw new ApiError(httpStatus.NOT_FOUND, "Phòng không tồn tại");
  if (room.host.toString() !== user._id?.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, "Chỉ Host mới có thể kick thành viên");
  }
  if (room.host.toString() === targetUserId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Không thể kick chính mình");
  }
  room.coHosts = room.coHosts.filter((id) => id.toString() !== targetUserId) as typeof room.coHosts;
  await room.save();

  await cacheRedis.srem(redisKeys.members(roomCode), targetUserId);
  await cacheRedis.hdel(`room:sessions:${roomCode}`, targetUserId);
  const memberCount = await cacheRedis.hlen(`room:sessions:${roomCode}`);
  await MusicRoom.updateOne({ roomCode }, { memberCount, lastActivityAt: new Date() });

  try {
    const io = getIO();
    const roomSocketKey = `music_room:${roomCode}`;
    const reason = "Bạn đã bị Host đưa khỏi phòng";
    const sockets = await io.in(roomSocketKey).fetchSockets();
    for (const client of sockets) {
      if (client.data?.userId !== targetUserId) continue;
      client.leave(roomSocketKey);
      client.emit("room:kicked", { roomCode, reason });
    }
    io.to(roomSocketKey).emit("room:member_left", { userId: targetUserId, memberCount });
  } catch (err) {
    console.error("[Socket] room:kicked error:", err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CLEANUP (Dùng bởi Cron)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Đóng tất cả các phòng không hoạt động > 2 tiếng.
 */
export const cleanupInactiveRooms = async () => {
  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);

  const inactiveRooms = await MusicRoom.find({
    isActive: true,
    $or: [
      { memberCount: 0, lastActivityAt: { $lt: oneHourAgo } },
      { lastActivityAt: { $lt: twelveHoursAgo } }
    ]
  }).lean();

  if (inactiveRooms.length === 0) return { cleaned: 0 };

  const codes = inactiveRooms.map((r) => r.roomCode);

  // Soft delete
  await MusicRoom.updateMany(
    { roomCode: { $in: codes } },
    { isActive: false },
  );

  // Dọn Redis
  const pipeline = cacheRedis.pipeline();
  for (const code of codes) {
    pipeline.del(redisKeys.members(code));
    pipeline.del(redisKeys.state(code));
    pipeline.del(redisKeys.votes(code));
  }
  await pipeline.exec();

  // Notify rooms bị đóng
  try {
    const io = getIO();
    for (const code of codes) {
      io.to(`music_room:${code}`).emit("room:closed", {
        roomCode: code,
        reason: "Phòng đã bị đóng do không hoạt động",
      });
    }
  } catch {}

  console.log(`[RoomCleanup] Đã đóng ${codes.length} phòng không hoạt động`);
  return { cleaned: codes.length };
};

// ─────────────────────────────────────────────────────────────────────────────
// KARAOKE MODE
// ─────────────────────────────────────────────────────────────────────────────

export const toggleKaraokeMode = async (roomCode: string, user: IUser, enabled: boolean) => {
  const room = await MusicRoom.findOne({ roomCode, isActive: true });
  if (!room) throw new ApiError(httpStatus.NOT_FOUND, "Phòng không tồn tại");
  if (room.host.toString() !== user._id.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, "Chỉ Host mới có quyền chuyển chế độ Karaoke");
  }

  room.karaokeMode = enabled;
  if (!enabled) {
    room.currentKaraokeVideoId = "";
    room.currentSinger = undefined;
    room.karaokeQueue = [];
  }
  await room.save();

  const io = getIO();
  io.to(`music_room:${roomCode}`).emit("room:karaoke_toggled", { enabled });

  return room;
};

export const addKaraokeQueue = async (
  roomCode: string,
  user: IUser,
  youtubeVideoId: string,
  youtubeTitle: string
) => {
  const room = await MusicRoom.findOne({ roomCode, isActive: true });
  if (!room) throw new ApiError(httpStatus.NOT_FOUND, "Phòng không tồn tại");
  if (!room.karaokeMode) throw new ApiError(httpStatus.BAD_REQUEST, "Phòng chưa bật Karaoke Mode");

  room.karaokeQueue.push({
    user: user._id,
    youtubeVideoId,
    youtubeTitle,
    addedAt: new Date(),
  } as any);

  await room.save();

  const populatedRoom = await MusicRoom.findById(room._id).populate("karaokeQueue.user", "username fullName avatar");
  const newlyAdded = populatedRoom!.karaokeQueue[populatedRoom!.karaokeQueue.length - 1];

  const io = getIO();
  io.to(`music_room:${roomCode}`).emit("room:karaoke_queue_added", { queueItem: newlyAdded });

  return newlyAdded;
};

export const nextKaraokeSinger = async (roomCode: string, user: IUser) => {
  const room = await MusicRoom.findOne({ roomCode, isActive: true });
  if (!room) throw new ApiError(httpStatus.NOT_FOUND, "Phòng không tồn tại");
  if (room.host.toString() !== user._id.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, "Chỉ Host mới có quyền chuyển bài hát");
  }
  if (!room.karaokeMode) throw new ApiError(httpStatus.BAD_REQUEST, "Phòng chưa bật Karaoke Mode");

  if (room.karaokeQueue.length === 0) {
    room.currentKaraokeVideoId = "";
    room.currentSinger = undefined;
    await room.save();
    getIO().to(`music_room:${roomCode}`).emit("room:karaoke_ended");
    return null;
  }

  const nextItem = room.karaokeQueue.shift()!;
  room.currentKaraokeVideoId = nextItem.youtubeVideoId;
  room.currentSinger = nextItem.user;
  await room.save();

  const populatedRoom = await MusicRoom.findById(room._id).populate("currentSinger", "username fullName avatar");
  
  getIO().to(`music_room:${roomCode}`).emit("room:karaoke_next", {
    videoId: nextItem.youtubeVideoId,
    singer: populatedRoom!.currentSinger,
  });

  return nextItem;
};

export const shareKaraokeRecording = async (roomCode: string, user: IUser, recordingId: string, audioUrl: string, title: string) => {
  const room = await MusicRoom.findOne({ roomCode, isActive: true });
  if (!room) throw new ApiError(httpStatus.NOT_FOUND, "Phòng không tồn tại");
  
  getIO().to(`music_room:${roomCode}`).emit("room:karaoke_shared", {
    userId: user._id,
    user: { fullName: user.fullName, avatar: user.avatar, username: user.username },
    recordingId,
    audioUrl,
    title
  });
  
  const msg = new RoomMessage({
    roomCode,
    sender: user._id,
    content: `Đã chia sẻ bản thu âm Karaoke: ${title}`,
    isSystemMsg: true,
  });
  await msg.save();

  getIO().to(`music_room:${roomCode}`).emit("room:message", {
    _id: msg._id,
    sender: { _id: "system", fullName: "Hệ thống", username: "system", avatar: "" },
    content: `🎤 ${user.fullName} vừa chia sẻ một bản thu âm Karaoke: ${title}. Nhấn Play để cùng nghe nhé!`,
    isSystemMsg: true,
    createdAt: msg.createdAt,
    metadata: { recordingId, audioUrl, title }
  });

  return true;
};

export const addCollectionToQueue = async (
  roomCode: string,
  user: IUser,
  source: { trackIds?: string[]; playlistId?: string; albumId?: string },
) => {
  const room = await MusicRoom.findOne({ roomCode, isActive: true });
  if (!room) throw new ApiError(httpStatus.NOT_FOUND, "Phòng không tồn tại");
  assertCanAddToQueue(room, user);

  let ids: string[] = source.trackIds ?? [];
  if (source.playlistId) {
    const playlist = await Playlist.findById(source.playlistId).select("tracks visibility user").lean();
    if (!playlist) throw new ApiError(httpStatus.NOT_FOUND, "Playlist không tồn tại");
    const ownerId = playlist.user?.toString();
    if (playlist.visibility === "private" && ownerId !== userIdOf(user)) {
      throw new ApiError(httpStatus.FORBIDDEN, "Playlist này không công khai");
    }
    ids = (playlist.tracks ?? []).map((id) => id.toString());
  } else if (source.albumId) {
    const tracks = await Track.find({
      album: source.albumId,
      isPublic: true,
      status: "ready",
      isDeleted: false,
    })
      .select("_id")
      .limit(30)
      .lean();
    ids = tracks.map((track) => track._id.toString());
  }

  if (ids.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Không có bài để thêm");
  }

  const existing = new Set(room.queue.map((item) => item.track.toString()));
  if (room.currentTrack) existing.add(room.currentTrack.toString());
  const roomLeft = 30 - room.queue.length;
  const candidates = [...new Set(ids)].filter((id) => !existing.has(id)).slice(0, roomLeft);
  const ready = await Track.find({
    _id: { $in: candidates },
    isPublic: true,
    status: "ready",
    isDeleted: false,
  })
    .select("_id")
    .lean();
  const readyIds = new Set(ready.map((track) => track._id.toString()));
  const userObjectId = user._id as mongoose.Types.ObjectId;
  let added = 0;
  for (const id of candidates) {
    if (!readyIds.has(id)) continue;
    room.queue.push({
      track: new mongoose.Types.ObjectId(id),
      addedBy: userObjectId,
      addedAt: new Date(),
      votes: 0,
      voters: [],
    } as IQueueItem);
    added += 1;
  }
  if (added === 0) {
    throw new ApiError(httpStatus.CONFLICT, "Các bài này đã có trong hàng chờ hoặc chưa sẵn sàng");
  }
  room.lastActivityAt = new Date();
  await room.save();
  await room.populate({
    path: "queue.track",
    select: "title coverImage duration artist",
    populate: { path: "artist", select: "name" },
  });
  emitRoom(roomCode, "room:queue_update", { queue: room.queue });
  return { queue: room.queue, added };
};

export const updateRoomSettings = async (
  roomCode: string,
  user: IUser,
  patch: { queueMode?: QueueMode },
) => {
  const room = await MusicRoom.findOne({ roomCode, isActive: true });
  if (!room) throw new ApiError(httpStatus.NOT_FOUND, "Phòng không tồn tại");
  if (!isRoomHostUser(room, userIdOf(user))) {
    throw new ApiError(httpStatus.FORBIDDEN, "Chỉ Host mới đổi được cài đặt phòng");
  }
  if (patch.queueMode) room.queueMode = patch.queueMode;
  room.lastActivityAt = new Date();
  await room.save();
  emitRoom(roomCode, "room:settings_updated", { queueMode: room.queueMode });
  return { queueMode: room.queueMode };
};

export const setCoHost = async (
  roomCode: string,
  user: IUser,
  targetUserId: string,
  enabled: boolean,
) => {
  const room = await MusicRoom.findOne({ roomCode, isActive: true });
  if (!room) throw new ApiError(httpStatus.NOT_FOUND, "Phòng không tồn tại");
  if (!isRoomHostUser(room, userIdOf(user))) {
    throw new ApiError(httpStatus.FORBIDDEN, "Chỉ Host mới chỉ định được co-host");
  }
  if (targetUserId === userIdOf(user)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Host không thể tự thêm mình làm co-host");
  }
  const present = await cacheRedis.hexists(`room:sessions:${roomCode}`, targetUserId);
  if (enabled && !present) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Người này chưa ở trong phòng");
  }
  room.coHosts = room.coHosts.filter((id) => id.toString() !== targetUserId) as typeof room.coHosts;
  if (enabled) {
    if (room.coHosts.length >= 3) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Phòng chỉ có tối đa 3 co-host");
    }
    room.coHosts.push(new mongoose.Types.ObjectId(targetUserId));
  }
  await room.save();
  const coHosts = room.coHosts.map((id) => id.toString());
  emitRoom(roomCode, "room:cohosts_updated", { coHosts });
  return { coHosts };
};

const musicRoomService = {
  createRoom,
  getPublicRooms,
  getRoomByCode,
  deleteRoom,
  addToQueue,
  removeFromQueue,
  voteTrack,
  playNext,
  togglePause,
  sendMessage,
  getChatHistory,
  transferHost,
  kickUser,
  cleanupInactiveRooms,
  getPlaybackStateFromRedis,
  savePlaybackStateToRedis,
  requestTrack,
  getTrackRequests,
  handleRequest,
  getMembers,
  getMyActiveRoom,
  assignHost,
  addCollectionToQueue,
  updateRoomSettings,
  setCoHost,
  advanceDueRooms,
  canControlPlayback,
  toggleKaraokeMode,
  addKaraokeQueue,
  nextKaraokeSinger,
  shareKaraokeRecording
};

export default musicRoomService;
