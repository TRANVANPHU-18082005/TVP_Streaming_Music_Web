import {
  useMutation,
  useQueryClient,
  type MutateOptions,
} from "@tanstack/react-query";
import { toast } from "sonner";
import moodVideoApi from "../api/moodVideoApi";
import { moodVideoKeys } from "../utils/moodVideoKeys";
import { handleError } from "@/utils/handleError";

export const useMoodVideoMutations = () => {
  const queryClient = useQueryClient();

  // ==========================================
  // 1. CREATE (FormData - Multipart)
  // ==========================================
  const createMutation = useMutation({
    mutationFn: (data: FormData) => moodVideoApi.create(data),
    onSuccess: () => {
      toast.success("Tải lên video tâm trạng thành công");
      queryClient.invalidateQueries({ queryKey: moodVideoKeys.lists() });
    },
    onError: (err) => handleError(err, "Lỗi tạo Mood Video"),
  });

  // ==========================================
  // 2. UPDATE (FormData hoặc JSON)
  // ==========================================
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormData | any }) =>
      moodVideoApi.update(id, data),
    onSuccess: (_, variables) => {
      toast.success("Cập nhật video thành công");
      queryClient.invalidateQueries({ queryKey: moodVideoKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: moodVideoKeys.detail(variables.id),
      });
    },
    onError: (err) => handleError(err, "Lỗi cập nhật video"),
  });

  // ==========================================
  // 3. DELETE
  // ==========================================
  const deleteMutation = useMutation({
    mutationFn: moodVideoApi.delete,
    onSuccess: () => {
      toast.success("Đã xóa Mood Video");
      queryClient.invalidateQueries({ queryKey: moodVideoKeys.lists() });
    },
    // Backend chặn xóa nếu video đang được gán cho Track nào đó
    onError: (err) => handleError(err, "Không thể xóa video đang được sử dụng"),
  });

  // ==========================================
  // 4. TOGGLE ACTIVE STATUS (JSON)
  // ==========================================
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      moodVideoApi.update(id, { isActive }),
    onSuccess: () => {
      toast.success("Đã thay đổi trạng thái hiển thị");
      queryClient.invalidateQueries({ queryKey: moodVideoKeys.lists() });
    },
    onError: (err) => handleError(err, "Lỗi thay đổi trạng thái"),
  });

  return {
    // --- Wrappers (Type Safe) ---

    // 1. Create
    createMoodVideo: (
      data: FormData,
      options?: MutateOptions<any, unknown, FormData>,
    ) => createMutation.mutate(data, options),

    createMoodVideoAsync: createMutation.mutateAsync,

    // 2. Update
    updateMoodVideo: (
      id: string,
      data: FormData | any,
      options?: MutateOptions<
        any,
        unknown,
        { id: string; data: FormData | any }
      >,
    ) => updateMutation.mutate({ id, data }, options),

    updateMoodVideoAsync: (id: string, data: FormData | any) =>
      updateMutation.mutateAsync({ id, data }),

    // 3. Delete
    deleteMoodVideo: (
      id: string,
      options?: MutateOptions<any, unknown, string>,
    ) => deleteMutation.mutate(id, options),

    // 4. Toggle Active Status
    toggleActive: (id: string, isActive: boolean) =>
      toggleMutation.mutate({ id, isActive }),

    // --- Loading States ---
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isToggling: toggleMutation.isPending,

    // Trạng thái bận chung (dùng để disable nút trên Table/Form)
    isMutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      toggleMutation.isPending,
  };
};
