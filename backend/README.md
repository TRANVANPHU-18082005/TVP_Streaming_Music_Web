# ⚙️ TVP Music - Backend & Infrastructure

Đây là lõi xử lý trung tâm của hệ thống TVP Music, được xây dựng dựa trên kiến trúc **Event-Driven** và **Micro-services** để đảm bảo khả năng mở rộng (scalability) và hiệu năng xử lý âm thanh thời gian thực.

---

## 🛠️ Tech Stack & Infrastructure

- **Runtime:** Node.js (TypeScript)
- **Framework:** Express.js
- **Database:** MongoDB (Mongoose) - Metadata, User, PlayLog.
- **Caching & Message Broker:** Redis - Lưu trữ Chart Realtime và quản lý hàng đợi BullMQ.
- **Background Jobs:** BullMQ - Điều phối các tác vụ Transcoding âm thanh.
- **Audio Processing:** FFmpeg - Cắt nhỏ và mã hóa luồng HLS.
- **Object Storage:** Backblaze B2 (Audio/HLS), Cloudinary (Images).
- **CDN & Security:** Cloudflare - Tăng tốc phân phối mảnh nhạc (.ts) và bảo vệ API.

---

## 🏗️ Kiến trúc hệ thống (Backend Architecture)

Hệ thống được chia làm 2 thành phần chính hoạt động độc lập:

### 1. API Server (Producer)

- Quản lý RESTful API cho Frontend.
- Xác thực người dùng (JWT), phân quyền Admin/User/Artist.
- Nhận file nhạc và đẩy tác vụ xử lý vào **Redis Queue**.
- Truy vấn dữ liệu Chart Realtime từ Redis Cache.

### 2. Background Worker (Consumer)

- Lắng nghe các Job từ hàng đợi BullMQ.
- Sử dụng **FFmpeg** để thực hiện quy trình Transcoding:
  - Chuyển đổi định dạng nguồn (.mp3, .wav...) sang chuẩn **HLS (HTTP Live Streaming)**.
  - Tạo tệp chỉ mục `.m3u8` và các phân đoạn nhạc `.ts` (10 giây/phân đoạn).
- Tự động Upload kết quả lên Backblaze B2 và cập nhật trạng thái `ready` cho bài hát.

---

## 📉 Quy trình xử lý âm thanh (Audio Pipeline)

1. **Upload:** API nhận file và upload tệp gốc (original) lên Backblaze B2.
2. **Queueing:** Một job mới được tạo trong BullMQ với thông tin `trackId`.
3. **Processing:** Worker tải tệp gốc về bộ nhớ tạm -> FFmpeg thực hiện cắt mảnh -> Upload thư mục HLS lên B2.
4. **Cleanup:** Worker xóa tệp tạm để tối ưu tài nguyên máy chủ.
5. **Ready:** Cập nhật `hlsUrl` vào MongoDB, bài hát sẵn sàng để stream qua Cloudflare CDN.

---

## 📊 Logic Bảng xếp hạng Realtime

Hệ thống sử dụng **MongoDB Aggregation Pipeline** kết hợp với **Redis Caching** để tính toán Top 100:

- **Dữ liệu:** Dựa trên lượng nghe trong 24 giờ qua từ collection `PlayLogs`.
- **Hiệu năng:** Kết quả được cache trong Redis với TTL 30-60 giây để giảm tải cho Database chính.
- **Timezone:** Xử lý chuẩn múi giờ UTC+7 (Việt Nam) để vẽ biểu đồ biến động theo giờ chính xác.

---

## 🚀 Cài đặt & Triển khai

### Yêu cầu

- Node.js 18+
- Redis Server (local hoặc cloud)
- FFmpeg (phải có trong biến môi trường PATH)

### Các bước thiết lập

1. **Cấu hình môi trường:**
   Tạo file `.env` tại thư mục gốc:

   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   REDIS_URL=your_redis_connection_string

   # Cloud Storage (Backblaze B2)
   B2_ENDPOINT=s3.your-region.backblazeb2.com
   B2_BUCKET_NAME=your_bucket
   B2_KEY_ID=your_id
   B2_APP_KEY=your_key

   # Cloudinary
   CLOUDINARY_URL=your_cloudinary_url
   ```
