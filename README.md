# 🎵 TVP Music - Next-Gen Music Streaming Platform

**TVP Music** là một nền tảng phát nhạc trực tuyến hiệu năng cao, được thiết kế để mang lại trải nghiệm mượt mà tương tự Spotify. Dự án tận dụng sức mạnh của kiến trúc **Micro-services**, tối ưu hóa truyền tải qua chuẩn **HLS (HTTP Live Streaming)** và được bảo mật, tăng tốc bởi **Cloudflare**.

---

## 🚀 Công nghệ chủ đạo (Tech Stack)

### Frontend

- **Framework:** React 18 + Vite (TypeScript).
- **State Management:** Redux Toolkit & TanStack Query (React Query).
- **UI/UX:** Tailwind CSS + Shadcn/UI + Framer Motion (Animations chuẩn Premium).
- **Streaming Player:** Hls.js tích hợp để giải mã luồng nhạc đa phân đoạn.

### Backend & Infrastructure

- **Runtime:** Node.js + Express.js (TypeScript).
- **Database:** MongoDB (Mongoose) lưu trữ metadata bài hát, người dùng và PlayLogs.
- **Caching:** Redis (Cloud) xử lý Realtime Chart và cache API.
- **Background Jobs:** BullMQ + Redis quản lý hàng đợi xử lý âm thanh (Transcoding).
- **Audio Processing:** FFmpeg nhúng trong Worker để cắt nhỏ file âm thanh thành chuẩn HLS.

### 🌐 Cloud & Security

- **Cloudflare:** - **CDN:** Tăng tốc phân phối mảnh nhạc HLS (`.ts`) toàn cầu.
  - **Security:** Cấu hình WAF chống DDoS và quản lý CORS nghiêm ngặt.
- **Backblaze B2:** Lưu trữ Object Storage (tương thích S3) chứa thư viện Audio.
- **Cloudinary:** Tối ưu hóa và phân phối hình ảnh (Avatar, Cover Art).

---

## ✨ Tính năng nổi bật

### 🎧 Hệ thống Streaming chuẩn HLS

Thay vì tải tệp `.mp3` tĩnh, TVP Music sử dụng kỹ thuật **HLS Transcoding**:

- Tự động chuyển đổi nhạc sang định dạng đa phân đoạn khi upload.
- **Adaptive Bitrate:** Tự động điều chỉnh chất lượng âm thanh theo tốc độ mạng người dùng, loại bỏ tình trạng giật lag (Buffering).

### 📊 Bảng xếp hạng Realtime (Live Chart)

- **Realtime Aggregate:** Phân tích dữ liệu `PlayLog` trong 24 giờ qua để cập nhật Top 100 mỗi phút.
- **Biểu đồ biến động:** Theo dõi xu hướng nghe nhạc theo từng giờ cho Top 3 bài hát dẫn đầu.
- **Redis Acceleration:** Toàn bộ dữ liệu biểu đồ được phục vụ từ cache với tốc độ phản hồi cực nhanh.

### 🛡️ Quản trị hệ thống chuyên sâu (Admin Panel)

- **Artist Management:** Quản lý hồ sơ nghệ sĩ, duyệt đơn đăng ký Artist từ người dùng.
- **Genre Hierarchy:** Hệ thống thể loại cha-con linh hoạt phục vụ việc phân loại nhạc.
- **Worker Monitoring:** Theo dõi trạng thái hàng đợi transcode (Success, Failed, Retrying).

### 👤 Cá nhân hóa người dùng

- **Premium Profile:** Trang cá nhân với hiệu ứng Glassmorphism, hiển thị lịch sử hoạt động và playlist.
- **Smart Player:** Trình phát nhạc thông minh hỗ trợ hàng chờ (Queue), phát ngẫu nhiên (Shuffle) và lặp lại (Repeat).

---

## 🏗️ Kiến trúc hệ thống

1. **Client** gửi yêu cầu qua **Cloudflare CDN** để giảm tải cho máy chủ gốc.
2. **API Server** xử lý logic nghiệp vụ và đẩy các tác vụ nặng (cắt nhạc) vào **Redis Queue**.
3. **Background Worker** (sử dụng FFmpeg) lấy tác vụ, xử lý âm thanh và đẩy lên **Backblaze B2**.
4. Dữ liệu trạng thái được cập nhật vào **MongoDB** và làm mới cache trên **Redis**.

---

## 🛠️ Cài đặt dự án

### 1. Yêu cầu hệ thống

- Node.js >= 18
- Redis Server
- FFmpeg đã cài đặt trong Environment Path

### 2. Cấu hình biến môi trường (.env)

Tạo file `.env` với các thông số sau:

````env
# Database & Cache
MONGO_URI=mongodb_your_connection_string
REDIS_URL=redis_your_connection_string

# Backblaze B2 (Audio Storage)
B2_ENDPOINT=[https://s3.your-region.backblazeb2.com](https://s3.your-region.backblazeb2.com)
B2_BUCKET_NAME=your_bucket_name
B2_KEY_ID=your_key_id
B2_APP_KEY=your_application_key

# Cloudinary (Image Storage)
CLOUDINARY_URL=cloudinary://key:secret@cloudname

# Security
JWT_SECRET=your_jwt_secret

```Khởi chạy
Bash
# Cài đặt dependencies
npm install

# Chạy API Server
npm run dev

# Chạy Background Worker (ở terminal riêng)
npm run worker:dev

```Quy trình xử lý âm thanh (Pipeline)
Bước 1: Multer-S3 đẩy tệp gốc trực tiếp từ Client lên Backblaze B2.

Bước 2: API tạo Job gửi vào BullMQ với ID của bài hát.

Bước 3: Worker tải tệp gốc về -> Dùng FFmpeg cắt thành mảnh HLS 10 giây -> Upload thư mục HLS ngược lại B2.

Bước 4: Xóa tệp tạm và cập nhật trạng thái ready để người dùng có thể nghe bài hát.

🤝 Đóng góp
Chúng tôi luôn hoan nghênh các đóng góp để dự án hoàn thiện hơn. Vui lòng mở Issue hoặc gửi Pull Request.

⭐ Nếu bạn thấy dự án này thú vị, hãy tặng chúng tôi 1 sao trên GitHub nhé!


### Hướng dẫn thêm sau khi dán:
1. **Thay đổi link ảnh:** Tìm các dòng có dạng `[Image of...]` và thay bằng link ảnh chụp màn hình thực tế dự án của bạn (Ảnh Dashboard, Ảnh Player, Ảnh Chart).
2. **Cập nhật link:** Thay các placeholder như `your_bucket_name` hay link clone GitHub bằng thông tin thật của bạn.
3. **Thêm mục License:** Nếu bạn dùng mã nguồn mở, hãy thêm `## License` và ghi `MIT` ở
````
