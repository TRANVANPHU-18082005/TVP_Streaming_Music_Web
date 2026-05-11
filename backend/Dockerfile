FROM node:18-bullseye-slim AS builder
WORKDIR /app

# Install full dependencies and build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Cài chứng chỉ bảo mật
RUN apt-get update && apt-get install -y ca-certificates --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Install only production deps
COPY package*.json ./
RUN npm ci --production

# Copy built artifacts
COPY --from=builder /app/dist ./dist

EXPOSE 8000
CMD ["node", "dist/index.js"]