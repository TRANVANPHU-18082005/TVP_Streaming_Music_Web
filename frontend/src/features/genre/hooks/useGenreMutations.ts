import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import genreApi from "../api/genreApi";
import { genreKeys } from "../utils/genreKeys";
import { handleError } from "@/utils/handleError";

export const useGenreMutations = () => {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: genreKeys.lists() });
    queryClient.invalidateQueries({ queryKey: genreKeys.tree() }); // Nếu có API lấy cây danh mục
  };
  // 1. Create Genre
  const createMutation = useMutation({
    mutationFn: (data: FormData) => genreApi.create(data),
    onSuccess: () => {
      toast.success("Tạo thể loại thành công");
      invalidate();
    },
    onError: (err) => handleError(err, "Lỗi tạo thể loại"),
  });
  // 2. Update Genre
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormData }) =>
      genreApi.update(id, data),
    onSuccess: () => {
      toast.success("Cập nhật thành công");
      invalidate();
    },
    onError: (err) => handleError(err, "Lỗi cập nhật"),
  });
  // 3. Toggle Genre Status
  const toggleMutation = useMutation({
    mutationFn: (id: string) => genreApi.toggleStatus(id),
    onSuccess: () => {
      toast.success("Cập nhật trạng thái thành công");
      invalidate();
    },
    onError: (err) => handleError(err, "Lỗi cập nhật trạng thái"),
  });
  // 4. Delete Genre
  const deleteMutation = useMutation({
    mutationFn: genreApi.delete,
    onSuccess: () => {
      toast.success("Đã xóa thể loại");
      invalidate();
    },
    onError: (err) => handleError(err, "Lỗi xóa"),
  });

  // 5. Restore Genre (Admin)
  const restoreMutation = useMutation({
    mutationFn: (id: string) => genreApi.restore(id),
    onSuccess: () => {
      toast.success("Đã khôi phục thể loại");
      invalidate();
    },
    onError: (err) => handleError(err, "Lỗi khôi phục thể loại"),
  });

  return {
    createGenreAsync: createMutation.mutateAsync,
    updateGenreAsync: updateMutation.mutateAsync,
    deleteGenre: deleteMutation.mutate,
    toggleGenreStatus: toggleMutation.mutateAsync,
    restoreGenre: restoreMutation.mutate,
    restoreGenreAsync: restoreMutation.mutateAsync,
    isMutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      restoreMutation.isPending,
  };
};
