import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createRoom,
  deleteRoom,
  addToQueue,
  removeFromQueue,
  voteTrack,
  kickUser,
} from "../api/room.api";
import { roomKeys } from "../utils/roomKeys";
import { handleError } from "@/utils/handleError";

export const useRoomMutations = () => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: () => {
      toast.success("Tạo phòng thành công");
      queryClient.invalidateQueries({ queryKey: roomKeys.lists() });
    },
    onError: (err) => handleError(err, "Lỗi tạo phòng"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRoom,
    onSuccess: (_, roomCode) => {
      toast.success("Đã xóa phòng");
      queryClient.invalidateQueries({ queryKey: roomKeys.lists() });
      queryClient.invalidateQueries({ queryKey: roomKeys.detail(roomCode) });
    },
    onError: (err) => handleError(err, "Lỗi xóa phòng"),
  });

  const addToQueueMutation = useMutation({
    mutationFn: ({ roomCode, trackId }: { roomCode: string; trackId: string }) =>
      addToQueue(roomCode, trackId),
    onSuccess: () => {
      toast.success("Đã thêm bài hát vào hàng đợi");
    },
    onError: (err) => handleError(err, "Lỗi thêm bài hát"),
  });

  const removeFromQueueMutation = useMutation({
    mutationFn: ({ roomCode, trackId }: { roomCode: string; trackId: string }) =>
      removeFromQueue(roomCode, trackId),
    onSuccess: () => {
      toast.success("Đã xóa bài hát khỏi hàng đợi");
    },
    onError: (err) => handleError(err, "Lỗi xóa bài hát"),
  });

  const voteTrackMutation = useMutation({
    mutationFn: ({ roomCode, trackId }: { roomCode: string; trackId: string }) =>
      voteTrack(roomCode, trackId),
    onError: (err) => handleError(err, "Lỗi vote bài hát"),
  });

  const kickUserMutation = useMutation({
    mutationFn: ({ roomCode, userId }: { roomCode: string; userId: string }) =>
      kickUser(roomCode, userId),
    onSuccess: () => {
      toast.success("Đã kick thành viên");
    },
    onError: (err) => handleError(err, "Lỗi kick thành viên"),
  });

  return {
    createRoomAsync: createMutation.mutateAsync,
    deleteRoomAsync: deleteMutation.mutateAsync,
    addToQueueAsync: addToQueueMutation.mutateAsync,
    removeFromQueueAsync: removeFromQueueMutation.mutateAsync,
    voteTrackAsync: voteTrackMutation.mutateAsync,
    kickUserAsync: kickUserMutation.mutateAsync,

    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isAddingToQueue: addToQueueMutation.isPending,
    isRemovingFromQueue: removeFromQueueMutation.isPending,
    isVoting: voteTrackMutation.isPending,
    isKicking: kickUserMutation.isPending,

    isMutating:
      createMutation.isPending ||
      deleteMutation.isPending ||
      addToQueueMutation.isPending ||
      removeFromQueueMutation.isPending ||
      voteTrackMutation.isPending ||
      kickUserMutation.isPending,
  };
};
