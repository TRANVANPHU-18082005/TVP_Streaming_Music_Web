import { useMutation } from "@tanstack/react-query";
import aiApi from "../api/aiApi";
import { ITrack } from "@/features/track";
import { handleError } from "@/utils/handleError";

interface TrackAnalysisData {
  analysis: {
    meaning: string;
    emotion: string;
    musicalStyle: string;
  };
  similarTracks: ITrack[];
}

export const useAiTrackAnalysis = () => {
  return useMutation({
    mutationFn: async (trackId: string) => {
      const res = await aiApi.analyzeTrack(trackId);
      return res.data.data as TrackAnalysisData;
    },
    onError: (error: any) => handleError(error, "Lỗi khi AI phân tích bài hát"),
  });
};
