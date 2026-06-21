import api from "@/lib/axios";

export const aiApi = {
  generatePlaylist: (prompt: string) => {
    return api.post("/ai/playlist/generate", { prompt });
  },
  generateAutoMix: (recentTracks: any[]) => {
    return api.post("/ai/automix", { recentTracks });
  },
  analyzeTrack: (trackId: string) => {
    return api.post("/ai/track/analyze", { trackId });
  },
};

export default aiApi;
