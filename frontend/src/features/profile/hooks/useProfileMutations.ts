import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import profileApi from "../api/profileApi";
import { profileKeys } from "../utils/profileKeys";
import { handleError } from "@/utils/handleError";

export const useProfileMutations = () => {
  const queryClient = useQueryClient();

  const updateProfileMutation = useMutation({
    mutationFn: (data: FormData) => profileApi.updateProfile(data),
    onSuccess: (res) => {
      toast.success("Cập nhật hồ sơ thành công");

      // 🚀 QUAN TRỌNG: Làm mới toàn bộ cache liên quan đến Profile
      queryClient.invalidateQueries({ queryKey: profileKeys.all });

      // Cập nhật lại thông tin User trong Global Auth State (nếu có)
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
    onError: (err) => handleError(err, "Không thể cập nhật hồ sơ"),
  });

  return {
    updateProfile: updateProfileMutation.mutate,
    isUpdating: updateProfileMutation.isPending,
  };
};
