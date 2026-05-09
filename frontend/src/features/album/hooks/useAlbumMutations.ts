import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import albumApi from "../api/albumApi";
import { albumKeys } from "../utils/albumKeys";
import { handleError } from "@/utils/handleError";
// import { CreateAlbumInput, UpdateAlbumInput } from "@/features/album/types"; // ❌ Bỏ dòng này
// ✅ Chúng ta dùng FormData cho Create/Update vì có upload ảnh

export const useAlbumMutations = () => {
  const queryClient = useQueryClient();

  // ==========================================
  // 1. CREATE (FormData)
  // ==========================================
  const createMutation = useMutation({
    // 🔥 FIX: Explicitly set type as FormData
    mutationFn: (data: FormData) => albumApi.create(data),
    onSuccess: () => {
      toast.success("Tạo Album thành công");
      queryClient.invalidateQueries({ queryKey: albumKeys.lists() });
    },
    onError: (err) => handleError(err, "Lỗi tạo album"),
  });

  // ==========================================
  // 2. UPDATE (FormData)
  // ==========================================
  const updateMutation = useMutation({
    // 🔥 FIX: Data phải là FormData, không phải UpdateAlbumInput
    mutationFn: ({ id, data }: { id: string; data: FormData }) =>
      albumApi.update(id, data),
    onSuccess: (_, variables) => {
      toast.success("Cập nhật thành công");
      queryClient.invalidateQueries({ queryKey: albumKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: albumKeys.detail(variables.id),
      });
    },
    onError: (err) => handleError(err, "Lỗi cập nhật"),
  });

  // ==========================================
  // 3. DELETE
  // ==========================================
  const deleteMutation = useMutation({
    mutationFn: albumApi.delete,
    onSuccess: () => {
      toast.success("Đã xóa Album");
      queryClient.invalidateQueries({ queryKey: albumKeys.lists() });
    },
    onError: (err) => handleError(err, "Lỗi xóa album"),
  });

  // ==========================================
  // 5. RESTORE (Admin)
  // ==========================================
  const restoreMutation = useMutation({
    mutationFn: (id: string) => albumApi.restore(id),
    onSuccess: () => {
      toast.success("Đã khôi phục Album");
      queryClient.invalidateQueries({ queryKey: albumKeys.lists() });
    },
    onError: (err) => handleError(err, "Lỗi khôi phục album"),
  });

  // ==========================================
  // 4. TOGGLE VISIBILITY (JSON)
  const toggleMutation = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      albumApi.togglePublicStatus(id, isPublic),
    onSuccess: (_, variables) => {
      toast.success(
        variables.isPublic
          ? "Album đã được công khai"
          : "Album đã được ẩn khỏi công chúng",
      );
      queryClient.invalidateQueries({ queryKey: albumKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: albumKeys.detail(variables.id),
      });
    },
    onError: (err) => handleError(err, "Lỗi cập nhật trạng thái"),
  });

  return {
    createAlbumAsync: createMutation.mutateAsync,

    // 2. Update Wrapper
    updateAlbumAsync: updateMutation.mutateAsync,

    // 3. Delete Wrapper
    deleteAlbum: deleteMutation.mutate,
    // 5. Restore Wrapper
    restoreAlbum: restoreMutation.mutate,
    restoreAlbumAsync: restoreMutation.mutateAsync,

    // 4. Toggle Wrapper
    toggleVisibility: (id: string, isPublic: boolean) =>
      toggleMutation.mutate({ id, isPublic }),

    // --- Loading States (Aggregated) ---
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isRestoring: restoreMutation.isPending,
    isToggling: toggleMutation.isPending,

    // Loading chung cho Table Action (Disable nút khi đang làm bất cứ gì)
    isMutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      restoreMutation.isPending ||
      toggleMutation.isPending,
  };
};
