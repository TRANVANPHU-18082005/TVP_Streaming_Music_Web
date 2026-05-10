# --- STAGE 1: Build (Máy trạm để lắp ráp) ---
FROM node:18-bullseye-slim AS builder
WORKDIR /app

# Copy file định nghĩa thư viện
COPY package*.json ./
# Cài ĐẦY ĐỦ thư viện (bao gồm cả TypeScript) để build
RUN npm install

# Copy toàn bộ code vào máy ảo build
COPY . .
# Chuyển code TS sang JS (tạo ra thư mục dist)
RUN npm run build

# --- STAGE 2: Run (Máy thật để chạy - Siêu nhẹ) ---
FROM node:18-bullseye-slim
WORKDIR /app
ENV NODE_ENV=production

# Quan trọng: Cài chứng chỉ bảo mật để gọi API/DB bên ngoài mượt mà
RUN apt-get update && apt-get install -y ca-certificates --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Chỉ cài đặt thư viện cần thiết để CHẠY (bỏ qua TypeScript rác)
COPY package*.json ./
RUN npm ci --production

# Lấy folder 'dist' đã build xong ở Stage 1 sang Stage 2
COPY --from=builder /app/dist ./dist

# Mở cổng 8000 (khớp với fly.toml)
EXPOSE 8000

# Lệnh khởi chạy server chính thức
CMD ["node", "dist/index.js"]