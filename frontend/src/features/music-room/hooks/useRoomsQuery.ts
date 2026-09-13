import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getPublicRooms, getRoomByCode, PublicRoomsResponse } from "../api/room.api";
import { roomKeys } from "../utils/roomKeys";

export const usePublicRoomsQuery = (page = 1, limit = 20, q?: string) => {
  return useQuery({
    queryKey: roomKeys.list({ page, limit, q }),
    queryFn: () => getPublicRooms(page, limit, q),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    select: (data: PublicRoomsResponse) => ({
      rooms: data.rooms,
      meta: {
        total: data.total,
        page: data.page,
        totalPages: data.totalPages,
      },
      isEmpty: data.rooms.length === 0,
    }),
  });
};

export const useRoomDetailQuery = (roomCode: string, password?: string) => {
  return useQuery({
    queryKey: roomKeys.detail(roomCode),
    queryFn: () => getRoomByCode(roomCode, password),
    enabled: !!roomCode,
    staleTime: 1 * 60 * 1000,
  });
};
