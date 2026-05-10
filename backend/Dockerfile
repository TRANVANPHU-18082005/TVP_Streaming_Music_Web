FROM node:18-bullseye-slim
WORKDIR /app
ENV NODE_ENV=production
# Install minimal runtime deps for native binaries (if needed)
RUN apt-get update && apt-get install -y ca-certificates --no-install-recommends && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --production

# Copy source and build
COPY . .
RUN npm run build

# Expose port (app uses 8000 by default)
EXPOSE 8000

# Default start (API server)
CMD ["node", "dist/index.js"]