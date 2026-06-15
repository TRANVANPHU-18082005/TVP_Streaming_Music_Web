import api from "@/lib/axios";

export const aiApi = {
  generatePlaylist: (prompt: string) => {
    return api.post("/ai/playlist/generate", { prompt });
  },
};

export default aiApi;
