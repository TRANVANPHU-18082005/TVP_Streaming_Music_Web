import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import trackApi from "../api/trackApi";
import { trackKeys } from "../utils/trackKeys";
import { handleError } from "@/utils/handleError";
import { BulkTrackFormValues } from "../schemas/track.schema";

export const useTrackMutations = () => {
  const queryClient = useQueryClient();

  // Hàm để làm mới danh sách bài hát sau mỗi lần thay đổi dữ liệu
  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: trackKeys.lists() });

  // 1. CREATE: Upload file nhạc mới [cite: 1]
  const createMutation = useMutation({
    mutationFn: (data: FormData) => trackApi.upload(data),
    onSuccess: () => {
      toast.success("Upload bài hát thành công! Hệ thống đang xử lý...");
      invalidateList();
    },
    onError: (err) => handleError(err, "Lỗi upload bài hát"),
  });

  // 2. UPDATE: Chỉnh sửa thông tin bài hát [cite: 1]
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormData }) =>
      trackApi.update(id, data),
    onSuccess: () => {
      toast.success("Cập nhật bài hát thành công");
      invalidateList();
    },
    onError: (err) => handleError(err, "Lỗi cập nhật"),
  });

  // 3. DELETE: Xóa bài hát khỏi hệ thống
  const deleteMutation = useMutation({
    mutationFn: (id: string) => trackApi.delete(id),
    onSuccess: () => {
      toast.success("Đã xóa bài hát");
      invalidateList();
    },
    onError: (err) => handleError(err, "Lỗi xóa"),
  });

  // 4. RETRY OPERATIONS: Các tác vụ xử lý lại dành cho Admin

  // Xử lý lại toàn bộ (HLS + Lyrics + Mood)
  const retryFullMutation = useMutation({
    mutationFn: (id: string) => trackApi.retryFull(id),
    onSuccess: () => {
      toast.success("Đã gửi lệnh xử lý lại toàn bộ!");
      invalidateList();
    },
    onError: (err) => handleError(err, "Lỗi khi thử lại toàn bộ"),
  });

  // Chỉ xử lý lại HLS (Âm thanh)
  const retryTranscodeMutation = useMutation({
    mutationFn: (id: string) => trackApi.retryTranscode(id),
    onSuccess: () => {
      toast.success("Đã gửi lệnh xử lý lại âm thanh!");
      invalidateList();
    },
    onError: (err) => handleError(err, "Lỗi khi thử lại âm thanh"),
  });

  // Chỉ tìm lại lời từ LRCLIB & căn nhịp AI
  const retryLyricsMutation = useMutation({
    mutationFn: (id: string) => trackApi.retryLyrics(id),
    onSuccess: () => {
      toast.success("Hệ thống đang tìm lại lời bài hát...");
      invalidateList();
    },
    onError: (err) => handleError(err, "Lỗi khi tìm lời"),
  });

  // Chỉ chạy lại AI Forced Alignment (Nếu đã có plainLyrics)
  const retryKaraokeMutation = useMutation({
    mutationFn: (id: string) => trackApi.retryKaraoke(id),
    onSuccess: () => {
      toast.success("Đã gửi lệnh căn nhịp lại Karaoke!");
      invalidateList();
    },
    onError: (err) => handleError(err, "Lỗi khi căn nhịp"),
  });

  // Chỉ tìm lại video nền (Mood Canvas)
  const retryMoodMutation = useMutation({
    mutationFn: (id: string) => trackApi.retryMood(id),
    onSuccess: () => {
      toast.success("Đã gửi lệnh cập nhật Mood Video!");
      invalidateList();
    },
    onError: (err) => handleError(err, "Lỗi cập nhật Mood"),
  });

  // 5. BULK UPDATE: Cập nhật nhiều bài hát cùng lúc
  const bulkUpdateMutation = useMutation({
    mutationFn: ({ ids, data }: { ids: string[]; data: BulkTrackFormValues }) =>
      trackApi.bulkUpdate(ids, data),
    onSuccess: (_, vars) => {
      toast.success(`Đã cập nhật ${vars.ids.length} bài hát!`);
      invalidateList();
    },
    onError: (err) => handleError(err, "Lỗi cập nhật hàng loạt"),
  });

  // BULK RETRY MUTATIONS (Admin)
  const bulkRetryTranscodeMutation = useMutation({
    mutationFn: (ids: string[]) => trackApi.bulkRetryTranscode(ids),
    onSuccess: () => {
      toast.success("Đã gửi lệnh retranscode cho các bài hát đã chọn");
      invalidateList();
    },
    onError: (err) => handleError(err, "Lỗi gửi lệnh retranscode"),
  });

  const bulkRetryLyricsMutation = useMutation({
    mutationFn: (ids: string[]) => trackApi.bulkRetryLyrics(ids),
    onSuccess: () => {
      toast.success("Đã gửi lệnh tìm lời cho các bài hát đã chọn");
      invalidateList();
    },
    onError: (err) => handleError(err, "Lỗi gửi lệnh tìm lời"),
  });

  const bulkRetryKaraokeMutation = useMutation({
    mutationFn: (ids: string[]) => trackApi.bulkRetryKaraoke(ids),
    onSuccess: () => {
      toast.success("Đã gửi lệnh Karaoke cho các bài hát đã chọn");
      invalidateList();
    },
    onError: (err) => handleError(err, "Lỗi gửi lệnh Karaoke"),
  });

  const bulkRetryMoodMutation = useMutation({
    mutationFn: (ids: string[]) => trackApi.bulkRetryMood(ids),
    onSuccess: () => {
      toast.success("Đã gửi lệnh cập nhật Mood cho các bài hát đã chọn");
      invalidateList();
    },
    onError: (err) => handleError(err, "Lỗi gửi lệnh Mood"),
  });

  const bulkRetryFullMutation = useMutation({
    mutationFn: (ids: string[]) => trackApi.bulkRetryFull(ids),
    onSuccess: () => {
      toast.success("Đã gửi lệnh xử lý lại toàn bộ cho các bài hát đã chọn");
      invalidateList();
    },
    onError: (err) => handleError(err, "Lỗi gửi lệnh retry full"),
  });

  return {
    // Async Wrappers: Giúp Component gọi hàm trực tiếp với ID
    createTrackAsync: createMutation.mutateAsync,
    updateTrackAsync: (id: string, data: FormData) =>
      updateMutation.mutateAsync({ id, data }),
    deleteTrack: (id: string) => deleteMutation.mutate(id),

    // Các lệnh Retry đa năng
    retryFull: (id: string) => retryFullMutation.mutate(id),
    retryTranscode: (id: string) => retryTranscodeMutation.mutate(id),
    retryLyrics: (id: string) => retryLyricsMutation.mutate(id),
    retryKaraoke: (id: string) => retryKaraokeMutation.mutate(id),
    retryMood: (id: string) => retryMoodMutation.mutate(id),

    bulkUpdateTrack: bulkUpdateMutation.mutate,

    // Bulk retry actions
    bulkRetryTranscode: (
      ids: string[],
      options?: Parameters<typeof bulkRetryTranscodeMutation.mutate>[1],
    ) => bulkRetryTranscodeMutation.mutate(ids, options),
    bulkRetryLyrics: (
      ids: string[],
      options?: Parameters<typeof bulkRetryLyricsMutation.mutate>[1],
    ) => bulkRetryLyricsMutation.mutate(ids, options),
    bulkRetryKaraoke: (
      ids: string[],
      options?: Parameters<typeof bulkRetryKaraokeMutation.mutate>[1],
    ) => bulkRetryKaraokeMutation.mutate(ids, options),
    bulkRetryMood: (
      ids: string[],
      options?: Parameters<typeof bulkRetryMoodMutation.mutate>[1],
    ) => bulkRetryMoodMutation.mutate(ids, options),
    bulkRetryFull: (
      ids: string[],
      options?: Parameters<typeof bulkRetryFullMutation.mutate>[1],
    ) => bulkRetryFullMutation.mutate(ids, options),

    // Trạng thái Loading tổng hợp
    isMutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      retryFullMutation.isPending ||
      retryTranscodeMutation.isPending ||
      retryLyricsMutation.isPending ||
      retryKaraokeMutation.isPending ||
      retryMoodMutation.isPending ||
      bulkUpdateMutation.isPending ||
      bulkRetryTranscodeMutation.isPending ||
      bulkRetryLyricsMutation.isPending ||
      bulkRetryKaraokeMutation.isPending ||
      bulkRetryMoodMutation.isPending ||
      bulkRetryFullMutation.isPending,

    // Trạng thái Loading cụ thể cho từng nút bấm [cite: 1]
    isUploading: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isRetryingFull: retryFullMutation.isPending,
    isRetryingLyrics: retryLyricsMutation.isPending,
    isRetryingKaraoke: retryKaraokeMutation.isPending,
  };
};
