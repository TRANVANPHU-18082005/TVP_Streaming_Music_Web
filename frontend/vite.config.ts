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
          // 🚀 FIX 1: Sửa Regex từ /\\\\/g thành /\\/g để bắt đúng 1 dấu gạch chéo ngược Windows
          const p = id.replace(/\\/g, "/");

          // Gom cụm các Component nội bộ dùng chung (Nếu Phú muốn ép chunk cố định)
          if (p.includes("/features/track/components/TrackList")) {
            return "track-list";
          }
          if (
            p.includes("/features/artist/components/ArtistSelector") ||
            p.includes("/features/genre/components/GenreSelector") ||
            p.includes("/components/ui/NationalitySelector")
          ) {
            return "selectors";
          }

          // Phân tách các thư viện bên thứ ba (node_modules)
          if (p.includes("node_modules")) {
            // 1. Tách riêng Framer Motion
            if (p.includes("framer-motion")) {
              return "framer-motion";
            }
            // 2. Tách riêng bộ Icon Lucide React
            if (p.includes("lucide-react")) {
              return "lucide-icons";
            }
            // 3. Tách riêng bộ lõi React, Router, Redux, React Query
            if (
              p.includes("react") ||
              p.includes("redux") ||
              p.includes("@tanstack")
            ) {
              return "react-core";
            }
            // Các thư viện nhỏ lẻ khác gom vào 1 file vendor chung
            return "vendor";
          }
        },
      },
    },
    // Phú có thể thêm dòng này để tăng giới hạn cảnh báo từ 500kB lên 800kB cho thoải mái nhé
    chunkSizeWarningLimit: 800,
  },
});
