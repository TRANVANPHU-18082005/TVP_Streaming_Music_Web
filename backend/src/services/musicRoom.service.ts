// services/musicRoom.service.ts

import mongoose from "mongoose";
import httpStatus from "http-status";
import MusicRoom, { IMusicRoom, IQueueItem } from "../models/MusicRoom";
import RoomMessage from "../models/RoomMessage";
import Track from "../models/Track";
import User, { IUser } from "../models/User";
import ApiError from "../utils/ApiError";
import { cacheRedis } from "../config/redis";
import { getIO } from "../socket";

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
  },
) => {
  const key = redisKeys.state(roomCode);
  await cacheRedis.hset(key, {
    currentTrackId: state.currentTrackId ?? "",
    startedAt: String(state.startedAt ?? 0),
    isPaused: state.isPaused ? "1" : "0",
    pausedAt: String(state.pausedAt),
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
  return {
    currentTrackId: raw.currentTrackId || null,
    startedAt: parseInt(raw.startedAt, 10) || null,
    isPaused: raw.isPaused === "1",
    pausedAt: parseFloat(raw.pausedAt) || 0,
  };
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
}

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

  const roomData: Partial<IMusicRoom> = {
    name: dto.name.trim(),
    description: dto.description,
    theme: dto.theme ?? "bar",
    host: user._id as mongoose.Types.ObjectId,
    isPublic,
    maxMembers,
    isActive: true,
    memberCount: 0,
    queue: [],
    currentTrackIndex: -1,
    isPaused: false,
  };

  if (!isPublic && dto.password) {
    roomData.password = dto.password;
  }

  const room = await MusicRoom.create(roomData);
  return room;
};

/**
 * Lấy danh sách phòng public đang hoạt động.
 */
export const getPublicRooms = async (page = 1, limit = 20, search?: string) => {
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

  // Kiểm tra password cho private room
  if (!room.isPublic && password !== room.password) {
    throw new ApiError(httpStatus.FORBIDDEN, "Mật khẩu phòng không đúng");
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

/**
 * Chuyển sang bài tiếp theo trong queue.
 */
export const playNext = async (roomCode: string, user: IUser) => {
  const room = await MusicRoom.findOne({ roomCode, isActive: true });
  if (!room) throw new ApiError(httpStatus.NOT_FOUND, "Phòng không tồn tại");
  if (room.host.toString() !== user._id?.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, "Chỉ Host mới có thể điều khiển phát nhạc");
  }
  if (room.queue.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Queue trống, không có bài để phát");
  }

  // Lấy bài có vote cao nhất (đã sort)
  const sorted = [...room.queue].sort((a, b) => b.votes - a.votes);
  const nextTrack = sorted[0];

  // Cập nhật state
  const now = new Date();
  room.currentTrack = nextTrack.track;
  room.startedAt = now;
  room.isPaused = false;
  room.pausedAt = 0;
  // Xóa bài đang phát khỏi queue
  room.queue = room.queue.filter(
    (item) => item.track.toString() !== nextTrack.track.toString(),
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
        { path: "moodVideo" }
      ],
    }
  ]);

  try {
    getIO().to(`music_room:${roomCode}`).emit("room:queue_update", { 
      queue: room.queue,
      currentTrack: room.currentTrack,
    });
  } catch (err) {
    console.error("[Socket] room:queue_update error:", err);
  }

  const playbackState = {
    currentTrackId: room.currentTrack?._id?.toString() ?? nextTrack.track.toString(),
    startedAt: now.getTime(),
    isPaused: false,
    pausedAt: 0,
    track: room.currentTrack,
  };

  // Cache vào Redis
  await savePlaybackStateToRedis(roomCode, playbackState);

  return playbackState;
};

/**
 * Pause/Resume phát nhạc.
 */
export const togglePause = async (
  roomCode: string,
  user: IUser,
  currentPosition: number,
) => {
  const room = await MusicRoom.findOne({ roomCode, isActive: true });
  if (!room) throw new ApiError(httpStatus.NOT_FOUND, "Phòng không tồn tại");
  if (room.host.toString() !== user._id?.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, "Chỉ Host mới có thể điều khiển phát nhạc");
  }

  const now = new Date();
  if (room.isPaused) {
    // Resume: tính startedAt mới dựa trên pausedAt
    room.startedAt = new Date(now.getTime() - room.pausedAt! * 1000);
    room.isPaused = false;
    room.pausedAt = 0;
  } else {
    // Pause
    room.isPaused = true;
    room.pausedAt = currentPosition;
  }
  room.lastActivityAt = now;
  await room.save();

  const playbackState = {
    currentTrackId: room.currentTrack?._id?.toString() ?? room.currentTrack?.toString() ?? null,
    startedAt: room.startedAt?.getTime() ?? null,
    isPaused: room.isPaused,
    pausedAt: room.pausedAt ?? 0,
  };

  await savePlaybackStateToRedis(roomCode, playbackState);

  return playbackState;
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
  await MusicRoom.updateOne(
    { roomCode },
    { host: new mongoose.Types.ObjectId(newHostId) },
  );
};

/**
 * Lấy danh sách thành viên trong phòng từ Redis và DB
 */
export const getMembers = async (roomCode: string) => {
  const memberIds = await cacheRedis.hkeys(`room:sessions:${roomCode}`);
  if (!memberIds || memberIds.length === 0) return [];
  
  const validMemberIds = memberIds.filter((id: string) => !id.startsWith("guest_"));
  if (validMemberIds.length === 0) return [];

  const room = await MusicRoom.findOne({ roomCode, isActive: true }).select("mutedUsers").lean();
  const mutedUsersSet = new Set((room?.mutedUsers || []).map((id: any) => id.toString()));

  const users = await User.find({ _id: { $in: validMemberIds } })
    .select("_id fullName username avatar")
    .lean();
    
  // Map kết quả thành array
  return users.map((u: any) => ({
    userId: u._id.toString(),
    fullName: u.fullName,
    username: u.username,
    avatar: u.avatar,
    isMuted: mutedUsersSet.has(u._id.toString())
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

  // Xóa khỏi Redis members set
  await cacheRedis.srem(redisKeys.members(roomCode), targetUserId);

  // Emit kick event qua socket
  try {
    getIO().to(targetUserId).emit("room:kicked", {
      roomCode,
      reason: "Bạn đã bị Host kick khỏi phòng",
    });
  } catch {}
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
};

export default musicRoomService;
