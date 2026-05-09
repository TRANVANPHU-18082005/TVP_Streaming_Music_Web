# 1. Chọn Base Image: Node.js bản nhẹ (Alpine)
FROM node:18-alpine

# 2. Thiết lập thư mục làm việc trong container
WORKDIR /app

# 3. Copy file package để cài thư viện trước (Tận dụng cache Docker)
COPY package*.json ./

# 4. Cài đặt toàn bộ thư viện (bao gồm cả ffmpeg-static)
RUN npm install

# 5. Copy toàn bộ code nguồn vào
COPY . .

# 6. Build TypeScript sang JavaScript (Ra thư mục dist)
RUN npm run build

# 7. Mở port 8000 (Để Render biết app chạy port nào)
EXPOSE 8000

# 8. Lệnh chạy server khi container khởi động
# Lưu ý: Chạy file js trong dist (entry: dist/index.js)
CMD ["node", "dist/index.js"]