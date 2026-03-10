# 🎨 TVP Music - Frontend & User Experience

Đây là giao diện người dùng của nền tảng TVP Music, được xây dựng với mục tiêu mang lại trải nghiệm nghe nhạc mượt mà, tốc độ phản hồi cực nhanh và giao diện chuẩn Premium với hiệu ứng Glassmorphism.

[Image of a modern music player interface with a sleek dark theme, glassmorphism sidebar, and dynamic album art colors]

---

## ⚡ Tech Stack & Core Libraries

- **Framework:** React 18 + Vite (TypeScript)
- **State Management:** - **Redux Toolkit:** Quản lý hàng chờ phát nhạc (Queue), trạng thái Player và xác thực.
  - **TanStack Query (React Query):** Quản lý server-state, caching dữ liệu API và xử lý Infinite Scrolling.
- **Styling:** - **Tailwind CSS:** Thiết kế giao diện responsive linh hoạt.
  - **Shadcn/UI:** Hệ thống component chuẩn mực (Table, Modal, Dropdown, Tabs).
- **Animations:** **Framer Motion** cho các hiệu ứng chuyển trang, staggered list và micro-interactions.
- **Streaming Logic:** **Hls.js** tích hợp để giải mã các phân đoạn âm thanh (.ts) từ máy chủ.

---

## ✨ Tính năng nổi bật trên giao diện

### 🎵 Smart Music Player

- **HLS Streaming:** Phát nhạc thông qua luồng Adaptive Bitrate, tự động điều chỉnh chất lượng theo tốc độ mạng.
- **Queue Management:** Hỗ trợ kéo thả, thêm bài hát vào hàng chờ, chế độ phát ngẫu nhiên (Shuffle) và lặp lại (Repeat).
- **Visualizer:** Hiệu ứng sóng nhạc động (Music Bars) phản hồi theo trạng thái bài hát đang phát.

### 📊 Realtime Charts & Discovery

- **Live Leaderboard:** Hiển thị Top 100 bài hát thịnh hành với dữ liệu cập nhật liên tục từ Redis.
- **Interactive Graphs:** Sử dụng biểu đồ đường (Line Chart) để minh họa biến động thứ hạng bài hát theo từng giờ.

### 🛡️ Professional Admin Dashboard

- **Hierarchy Tree:** Quản lý thể loại nhạc theo cấu trúc cha-con trực quan.
- **Batch Actions:** Chọn nhiều bài hát/người dùng để xử lý hàng loạt (Delete, Block, Change Status).
- **Monitoring:** Giao diện theo dõi tiến độ xử lý nhạc (Transcoding) của hệ thống Worker.

### 👤 Premium User Profile

- **Personalization:** Trang cá nhân với ảnh bìa rộng, hiển thị lịch sử hoạt động (Activity Feed) và playlist đã tạo.
- **Optimistic UI:** Phản hồi tức thì khi người dùng nhấn Like bài hát hoặc Follow nghệ sĩ trước khi server phản hồi.

---

## 🏗️ Cấu trúc thư mục (Architecture)

Dự án tuân thủ cấu trúc **Feature-based**, giúp dễ dàng mở rộng và bảo trì:

```text
src/
├── features/           # Các tính năng lớn (track, artist, genre, player, user)
│   ├── hooks/          # Query & Mutation hooks riêng cho từng feature
│   ├── components/     # UI components đặc thù cho feature
│   └── types/          # Định nghĩa TypeScript cho feature đó
├── store/              # Cấu hình Redux Toolkit & Slices
├── components/         # Shared UI components (Button, Table, Input...)
├── lib/                # Cấu hình Axios, Utils (cn, formatters)
└── layouts/            # Main Layout, Admin Layout, Auth Layout
```

Cài đặt & Khởi chạy
Yêu cầu
Node.js 18+

Backend API (đang chạy)

Các bước thiết lập
Clone dự án & Cài đặt:

Bash
git clone [https://github.com/username/tvp-music-frontend.git](https://github.com/username/tvp-music-frontend.git)
cd tvp-music-frontend
npm install
Cấu hình môi trường (.env):
Tạo file .env.local:

Đoạn mã
VITE_API_URL=http://localhost:5000/api/v1
VITE_CDN_URL=[https://music-cdn.yourdomain.com](https://music-cdn.yourdomain.com)
Khởi chạy:

Bash
npm run dev
📱 Khả năng thích ứng (Responsiveness)
Giao diện được tối ưu hóa cho 3 cấp độ màn hình:

Mobile: Ẩn các cột phụ trong bảng nhạc, chuyển menu sang Bottom Navigation.

Tablet: Thu gọn Sidebar, hiển thị Grid 2-3 cột cho Album/Artist.

Desktop: Trải nghiệm đầy đủ với Sidebar mở rộng, bảng nhạc chi tiết và Player thanh mảnh phía dưới.
