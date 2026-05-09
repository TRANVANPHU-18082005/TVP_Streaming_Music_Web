import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import playlistApi from "../api/playlistApi";
import { playlistKeys } from "../utils/playlistKeys";
import { handleError } from "@/utils/handleError";

export const usePlaylistMutations = () => {
  const queryClient = useQueryClient();

  // Helper Invalidate tập trung
  const invalidatePlaylist = (id?: string) => {
    // 1. Luôn làm mới danh sách (Sidebar, Library)
    queryClient.invalidateQueries({ queryKey: playlistKeys.lists() });
    queryClient.invalidateQueries({ queryKey: playlistKeys.myList() }); // Cache cho Sidebar

    // 2. Làm mới chi tiết nếu có ID
    if (id) {
      queryClient.invalidateQueries({ queryKey: playlistKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: playlistKeys.tracks() });
    }
  };

  // ==========================================
  // A. PLAYLIST CORE (Full Update với FormData)
  // ==========================================

  const createMutation = useMutation({
    mutationFn: (data: FormData) => playlistApi.create(data),
    onSuccess: () => {
      toast.success("Tạo Playlist hệ thống thành công");
      invalidatePlaylist();
    },
    onError: (err) => handleError(err, "Lỗi tạo playlist"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormData }) =>
      playlistApi.update(id, data),
    onSuccess: (_, { id }) => {
      toast.success("Cập nhật thông tin thành công");
      invalidatePlaylist(id);
    },
    onError: (err) => handleError(err, "Lỗi cập nhật"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => playlistApi.delete(id),
    onSuccess: () => {
      toast.success("Đã xóa playlist");
      invalidatePlaylist();
    },
    onError: (err) => handleError(err, "Lỗi xóa playlist"),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => playlistApi.restore(id),
    onSuccess: () => {
      toast.success("Đã khôi phục playlist");
      invalidatePlaylist();
    },
    onError: (err) => handleError(err, "Lỗi khôi phục playlist"),
  });

  // ==========================================
  // B. QUICK ACTIONS (Spotify Style - Tốc độ cao)
  // ==========================================

  // Tạo nhanh (Không cần file)
  const quickCreateMutation = useMutation({
    mutationFn: (data?: { title?: string; visibility?: string }) =>
      playlistApi.createQuickPlaylist(data),
    onSuccess: (res) => {
      toast.success("Đã tạo danh sách phát mới");
      invalidatePlaylist();
      // Gợi ý: return res.data để component có thể redirect
      return res.data;
    },
    onError: (err) => handleError(err, "Lỗi tạo playlist nhanh"),
  });

  // Sửa nhanh (Chỉ tên/trạng thái - Không cần file)
  const quickEditMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { title?: string; visibility?: string };
    }) => playlistApi.quickEditMyPlaylist(id, data),
    onSuccess: (_, { id }) => {
      toast.success("Đã cập nhật");
      invalidatePlaylist(id);
    },
    onError: (err) => handleError(err, "Lỗi chỉnh sửa nhanh"),
  });

  // Toggle riêng tư (Atomic Switch)
  const toggleVisibilityMutation = useMutation({
    mutationFn: (id: string) => playlistApi.toggleMyPlaylistVisibility(id),
    onSuccess: (res, id) => {
      toast.success(`Chế độ hiển thị: ${res.data.visibility}`);
      invalidatePlaylist(id);
    },
    onError: (err) => handleError(err, "Lỗi chuyển đổi trạng thái"),
  });

  // ==========================================
  // C. TRACK MANAGEMENT (Cập nhật mảng tracks)
  // ==========================================

  const addTracksMutation = useMutation({
    mutationFn: ({ id, trackIds }: { id: string; trackIds: string[] }) =>
      playlistApi.addTracks(id, trackIds),
    onSuccess: (res, { id }) => {
      toast.success(res.message);
      invalidatePlaylist(id);
    },
    onError: (err) => handleError(err, "Lỗi thêm bài hát"),
  });

  const removeTracksMutation = useMutation({
    mutationFn: ({ id, trackIds }: { id: string; trackIds: string[] }) =>
      playlistApi.removeTracks(id, trackIds),
    onSuccess: (res, { id }) => {
      toast.success(res.message);
      invalidatePlaylist(id);
    },
    onError: (err) => handleError(err, "Lỗi xóa bài hát"),
  });

  const reorderMutation = useMutation({
    mutationFn: ({ id, trackIds }: { id: string; trackIds: string[] }) =>
      playlistApi.reorderTracks(id, trackIds),
    onSuccess: (_, { id }) => {
      toast.success("Thứ tự đã được lưu");
      invalidatePlaylist(id);
    },
    onError: (err) => handleError(err, "Lỗi sắp xếp"),
  });

  return {
    // --- Playlist Actions ---
    createPlaylist: createMutation.mutate,
    createPlaylistAsync: createMutation.mutateAsync,

    updatePlaylist: (id: string, data: FormData) =>
      updateMutation.mutate({ id, data }),
    updatePlaylistAsync: (id: string, data: FormData) =>
      updateMutation.mutateAsync({ id, data }),

    deletePlaylist: deleteMutation.mutate,
    deletePlaylistAsync: deleteMutation.mutateAsync,
    restorePlaylist: restoreMutation.mutate,
    restorePlaylistAsync: restoreMutation.mutateAsync,

    // --- Quick User Actions ---
    createQuickPlaylist: quickCreateMutation.mutate,
    createQuickPlaylistAsync: quickCreateMutation.mutateAsync,

    quickEditPlaylist: (
      id: string,
      data: { title?: string; visibility?: string },
    ) => quickEditMutation.mutate({ id, data }),

    toggleVisibility: toggleVisibilityMutation.mutate,

    // --- Track Actions ---
    addTracks: (id: string, trackIds: string[]) =>
      addTracksMutation.mutate({ id, trackIds }),
    removeTracks: (id: string, trackIds: string[]) =>
      removeTracksMutation.mutate({ id, trackIds }),
    reorderTracks: (id: string, trackIds: string[]) =>
      reorderMutation.mutate({ id, trackIds }),

    // --- Loading States ---
    isCreating: createMutation.isPending || quickCreateMutation.isPending,
    isUpdating:
      updateMutation.isPending ||
      quickEditMutation.isPending ||
      toggleVisibilityMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isTrackMutating:
      addTracksMutation.isPending ||
      removeTracksMutation.isPending ||
      reorderMutation.isPending,

    // Global Pending State
    isMutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      quickCreateMutation.isPending ||
      addTracksMutation.isPending,
  };
};
