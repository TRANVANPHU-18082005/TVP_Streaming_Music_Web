import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import playlistApi from "../api/playlistApi";
import { playlistKeys } from "../utils/playlistKeys";
import { handleError } from "@/utils/handleError";

export const useImportPlaylist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: playlistApi.importFromText,
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: playlistKeys.lists() });
      queryClient.invalidateQueries({ queryKey: playlistKeys.myList() });
    },
    onError: (error) =>
      handleError(error, "Không tạo được playlist từ danh sách"),
  });
};
