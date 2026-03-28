import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import playlistApi from "../api/playlistApi";
import { playlistKeys } from "../utils/playlistKeys";
import { handleError } from "@/utils/handleError";

export const usePlaylistMutations = () => {
  const queryClient = useQueryClient();

  // Helper Invalidate
  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: playlistKeys.lists() });
  const invalidateDetail = (id: string) =>
    queryClient.invalidateQueries({ queryKey: playlistKeys.detail(id) });

  // ==========================================
  // A. PLAYLIST CRUD (FormData cho Create/Update vì có coverImage)
  // ==========================================

  const createMutation = useMutation({
    mutationFn: (data: FormData) => playlistApi.create(data),
    onSuccess: () => {
      toast.success("Tạo Playlist thành công");
      invalidateList();
    },
    onError: (err) => handleError(err, "Lỗi tạo playlist"),
  });

  const updateMetadataMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormData }) =>
      playlistApi.update(id, data),
    onSuccess: (_, { id }) => {
      toast.success("Cập nhật thông tin thành công");
      invalidateList();
      invalidateDetail(id);
    },
    onError: (err) => handleError(err, "Lỗi cập nhật"),
  });

  const deleteMutation = useMutation({
    mutationFn: playlistApi.delete,
    onSuccess: () => {
      toast.success("Đã xóa playlist");
      invalidateList();
    },
    onError: (err) => handleError(err, "Lỗi xóa playlist"),
  });

  // ==========================================
  // B. TRACK OPERATIONS (JSON Body)
  // ==========================================

  // 1. Thêm bài hát
  const addTracksMutation = useMutation({
    mutationFn: ({ id, trackIds }: { id: string; trackIds: string[] }) =>
      playlistApi.addTracks(id, trackIds),
    onSuccess: (res, { id }) => {
      toast.success(res.message || "Đã thêm bài hát");
      invalidateDetail(id);
      invalidateList(); // Update trackCount ở list ngoài
    },
    onError: (err) => handleError(err, "Lỗi thêm bài hát"),
  });

  // 2. Xóa bài hát
  const removeTrackMutation = useMutation({
    mutationFn: ({ id, trackId }: { id: string; trackId: string }) =>
      playlistApi.removeTracks(id, [trackId]),
    onSuccess: (_, { id }) => {
      toast.success("Đã gỡ bài hát");
      invalidateDetail(id);
      invalidateList();
    },
    onError: (err) => handleError(err, "Lỗi xóa bài hát"),
  });

  // 3. Sắp xếp bài hát
  const reorderMutation = useMutation({
    mutationFn: ({ id, trackIds }: { id: string; trackIds: string[] }) =>
      playlistApi.reorderTracks(id, trackIds),
    onSuccess: (_, { id }) => {
      toast.success("Đã lưu thứ tự mới");
      invalidateDetail(id);
    },
    onError: (err) => handleError(err, "Lỗi sắp xếp"),
  });
  // 1. TẠO NHANH (Spotify Style)
  const quickCreateMutation = useMutation({
    mutationFn: (data?: { title?: string; visibility?: string }) =>
      playlistApi.createQuickPlaylist(data),
    onSuccess: (res) => {
      console.log(res);
      toast.success("Đã tạo danh sách phát mới");
      invalidateList();
      // Phú có thể dùng res.data.slug để redirect user ngay tại đây nếu muốn
    },
    onError: (err) => handleError(err, "Lỗi tạo playlist nhanh"),
  });

  // 2. USER THÊM NHẠC (Sử dụng API /me mới)
  const userAddTracksMutation = useMutation({
    mutationFn: ({ id, trackIds }: { id: string; trackIds: string[] }) =>
      playlistApi.userAddTracks(id, trackIds),
    onSuccess: (_, { id }) => {
      toast.success("Đã thêm vào danh sách phát");
      invalidateDetail(id); // Quan trọng: Để lấy coverImage mới từ logic Smart Cover
      invalidateList();
    },
  });

  // 3. USER XÓA NHẠC (Sử dụng API /me mới)
  const userRemoveTracksMutation = useMutation({
    mutationFn: ({ id, trackIds }: { id: string; trackIds: string[] }) =>
      playlistApi.userRemoveTracks(id, trackIds),
    onSuccess: (_, { id }) => {
      toast.success("Đã xóa khỏi danh sách phát");
      invalidateDetail(id);
      invalidateList();
    },
  });

  // 4. CHUYỂN TRẠNG THÁI RIÊNG TƯ NHANH
  const toggleVisibilityMutation = useMutation({
    mutationFn: (id: string) => playlistApi.toggleMyPlaylistVisibility(id),
    onSuccess: (res, id) => {
      toast.success(`Đã chuyển sang ${res.data.visibility}`);
      invalidateDetail(id);
      invalidateList();
    },
  });
  return {
    // --- Playlist Actions ---
    createPlaylist: createMutation.mutate,
    createPlaylistAsync: createMutation.mutateAsync,

    updatePlaylist: (id: string, data: FormData) =>
      updateMetadataMutation.mutate({ id, data }),
    updatePlaylistAsync: (id: string, data: FormData) =>
      updateMetadataMutation.mutateAsync({ id, data }),

    deletePlaylist: deleteMutation.mutate,

    // --- Track Actions ---
    addTracks: (id: string, trackIds: string[]) =>
      addTracksMutation.mutate({ id, trackIds }),
    removeTrack: (id: string, trackId: string) =>
      removeTrackMutation.mutate({ id, trackId }),
    reorderTracks: (id: string, trackIds: string[]) =>
      reorderMutation.mutate({ id, trackIds }),

    //User Playlist
    createQuickPlaylist: quickCreateMutation.mutate,
    createQuickPlaylistAsync: quickCreateMutation.mutateAsync,

    userAddTracks: userAddTracksMutation.mutate,
    userRemoveTracks: userRemoveTracksMutation.mutate,
    toggleMyVisibility: toggleVisibilityMutation.mutate,

    isQuickCreating: quickCreateMutation.isPending,

    // --- Loading States ---
    isCreating: createMutation.isPending,
    isUpdating: updateMetadataMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isTrackMutating:
      addTracksMutation.isPending ||
      removeTrackMutation.isPending ||
      reorderMutation.isPending,

    // Global Loading (Disable UI)
    isMutating:
      createMutation.isPending ||
      updateMetadataMutation.isPending ||
      deleteMutation.isPending ||
      addTracksMutation.isPending ||
      removeTrackMutation.isPending ||
      reorderMutation.isPending,
  };
};
