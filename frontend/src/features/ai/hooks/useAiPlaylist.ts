import { useMutation } from "@tanstack/react-query";
import aiApi from "../api/aiApi";
import { ITrack } from "@/features/track";
import { handleError } from "@/utils/handleError";

export const useAiPlaylist = () => {
  return useMutation({
    mutationFn: async (prompt: string) => {
      const res = await aiApi.generatePlaylist(prompt);
      return res.data.data as { analyzed: any; tracks: ITrack[]; coverImage?: string };
    },
    onError: (error: any) => handleError(error, "Lỗi khi tạo playlist bằng AI"),
  });
};
