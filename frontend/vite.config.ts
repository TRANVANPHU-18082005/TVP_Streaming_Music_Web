import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          const p = id.replace(/\\\\/g, "/");
          if (p.includes("/features/track/components/TrackList"))
            return "track-list";
          if (
            p.includes("/features/artist/components/ArtistSelector") ||
            p.includes("/features/genre/components/GenreSelector") ||
            p.includes("/components/ui/NationalitySelector")
          )
            return "selectors";
          // keep manual chunking targeted to specific heavy components only
          // avoid grouping all admin pages into a single huge chunk
          if (p.includes("/node_modules/")) return "vendor";
        },
      },
    },
  },
});
