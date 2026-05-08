import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import artistApi from "../api/artistApi";
import { artistKeys } from "../utils/artistKeys";
import { handleError } from "@/utils/handleError";

export const useArtistMutations = () => {
  const queryClient = useQueryClient();

  // Helper Invalidate
  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: artistKeys.lists() });
  const invalidateDetail = (id: string) =>
    queryClient.invalidateQueries({ queryKey: artistKeys.detail(id) });

  // ==========================================
  // 1. CREATE (FormData)
  // ==========================================
  const createMutation = useMutation({
    mutationFn: (data: FormData) => artistApi.create(data),
    onSuccess: () => {
      toast.success("Tạo nghệ sĩ thành công");
      invalidateList();
    },
    onError: (err) => handleError(err, "Lỗi tạo nghệ sĩ"),
  });

  // ==========================================
  // 2. UPDATE (FormData)
  // ==========================================
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormData }) =>
      artistApi.update(id, data),
    onSuccess: (_, { id }) => {
      toast.success("Cập nhật thành công");
      invalidateList();
      invalidateDetail(id);
    },
    onError: (err) => handleError(err, "Lỗi cập nhật"),
  });

  // ==========================================
  // 3. DELETE
  // ==========================================
  const deleteMutation = useMutation({
    mutationFn: artistApi.delete,
    onSuccess: () => {
      toast.success("Đã xóa nghệ sĩ");
      invalidateList();
    },
    onError: (err) => handleError(err, "Lỗi xóa nghệ sĩ"),
  });

  // ==========================================
  // 4. TOGGLE STATUS / VERIFY (JSON)
  // ==========================================
  const toggleStatusMutation = useMutation({
    mutationFn: (id: string) => artistApi.toggleStatus(id),
    onSuccess: () => {
      toast.success("Đã thay đổi trạng thái");
      invalidateList();
    },
    onError: (err) => handleError(err, "Lỗi thay đổi trạng thái"),
  });

  return {
    // --- Wrappers ---
    createArtist: createMutation.mutate,
    createArtistAsync: createMutation.mutateAsync,

    updateArtist: (id: string, data: FormData) =>
      updateMutation.mutate({ id, data }),
    updateArtistAsync: (id: string, data: FormData) =>
      updateMutation.mutateAsync({ id, data }),

    deleteArtist: deleteMutation.mutate,
    deleteArtistAsync: deleteMutation.mutateAsync,

    toggleArtistStatus: toggleStatusMutation.mutate,
    toggleArtistStatusAsync: toggleStatusMutation.mutateAsync,

    // --- Loading States ---
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isToggling: toggleStatusMutation.isPending,

    // Global Loading
    isMutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      toggleStatusMutation.isPending,
  };
};
