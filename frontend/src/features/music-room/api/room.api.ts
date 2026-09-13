// features/music-room/api/room.api.ts

import api from "@/lib/axios";
import type { MusicRoom, QueueItem, RoomMessage } from "../types/room.types";

const BASE = "/rooms";

// ─────────────────────────────────────────────────────────────────────────────
// ROOM CRUD
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateRoomPayload {
  name: string;
  description?: string;
  theme?: MusicRoom["theme"];
  isPublic?: boolean;
  maxMembers?: number;
  password?: string;
}

export interface RoomMember {
  userId: string;
  fullName: string;
  username: string;
  avatar?: string;
  isMuted?: boolean;
}

export interface PublicRoomsResponse {
  rooms: MusicRoom[];
  total: number;
  page: number;
  totalPages: number;
}

/** Tạo phòng mới */
export const createRoom = async (payload: CreateRoomPayload): Promise<MusicRoom> => {
  const { data } = await api.post<{ success: boolean; data: MusicRoom }>(BASE, payload);
  return data.data;
};

/** Danh sách phòng public */
export const getPublicRooms = async (page = 1, limit = 20, q?: string): Promise<PublicRoomsResponse> => {
  const params: any = { page, limit };
  if (q) params.q = q;
  const { data } = await api.get<{ success: boolean; data: PublicRoomsResponse }>(BASE, {
    params,
  });
  return data.data;
};

/** Thông tin chi tiết phòng + playback state */
export const getRoomByCode = async (roomCode: string, password?: string): Promise<MusicRoom> => {
  const { data } = await api.get<{ success: boolean; data: MusicRoom }>(
    `${BASE}/${roomCode}`,
    { headers: password ? { "x-room-password": password } : {} },
  );
  return data.data;
};

/** Xóa/đóng phòng */
export const deleteRoom = async (roomCode: string): Promise<void> => {
  await api.delete(`${BASE}/${roomCode}`);
};

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE
// ─────────────────────────────────────────────────────────────────────────────

/** Thêm bài vào queue */
export const addToQueue = async (
  roomCode: string,
  trackId: string,
): Promise<{ queue: QueueItem[] }> => {
  const { data } = await api.post<{ success: boolean; data: { queue: QueueItem[] } }>(
    `${BASE}/${roomCode}/queue`,
    { trackId },
  );
  return data.data;
};

/** Xóa bài khỏi queue */
export const removeFromQueue = async (
  roomCode: string,
  trackId: string,
): Promise<{ queue: QueueItem[] }> => {
  const { data } = await api.delete<{ success: boolean; data: { queue: QueueItem[] } }>(
    `${BASE}/${roomCode}/queue/${trackId}`,
  );
  return data.data;
};

/** Vote/unvote bài tiếp theo */
export const voteTrack = async (
  roomCode: string,
  trackId: string,
): Promise<{ queue: QueueItem[]; voted: boolean }> => {
  const { data } = await api.post<{
    success: boolean;
    data: { queue: QueueItem[]; voted: boolean };
  }>(`${BASE}/${roomCode}/vote/${trackId}`);
  return data.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// CHAT
// ─────────────────────────────────────────────────────────────────────────────

/** Lịch sử chat */
export const getChatHistory = async (
  roomCode: string,
  page = 1,
  limit = 50,
): Promise<RoomMessage[]> => {
  const { data } = await api.get<{ success: boolean; data: RoomMessage[] }>(
    `${BASE}/${roomCode}/messages`,
    { params: { page, limit } },
  );
  return data.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// MODERATION & MEMBERS
// ─────────────────────────────────────────────────────────────────────────────

/** Lấy danh sách thành viên */
export const getMembers = async (roomCode: string): Promise<RoomMember[]> => {
  const { data } = await api.get<{ success: boolean; data: RoomMember[] }>(
    `${BASE}/${roomCode}/members`
  );
  return data.data;
};

/** Kick thành viên */
export const kickUser = async (roomCode: string, userId: string): Promise<void> => {
  await api.post(`${BASE}/${roomCode}/kick/${userId}`);
};

// ─────────────────────────────────────────────────────────────────────────────
// MOOD VIDEO
// ─────────────────────────────────────────────────────────────────────────────

/** Lấy danh sách mood videos có sẵn */
export const getMoodVideos = async (page = 1, limit = 20): Promise<{ docs: any[], totalPages: number }> => {
  const { data } = await api.get<{ success: boolean; data: { data: any[], meta: { totalPages: number } } }>(
    `/mood-videos?page=${page}&limit=${limit}&isActive=true`
  );
  return { docs: data.data.data, totalPages: data.data.meta.totalPages };
};
