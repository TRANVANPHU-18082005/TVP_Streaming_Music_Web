import dotenv from "dotenv";

// Load env files based on NODE_ENV for consistent dev/prod modes
const nodeEnv = process.env.NODE_ENV || "development";
if (nodeEnv !== "production") {
  // Load mode-specific first, then fallback to generic .env
  dotenv.config({ path: `.env.${nodeEnv}` });
  dotenv.config();
} else {
  // In production, assume environment provided by host/platform
  dotenv.config({ path: `.env.production` });
}

// Required in production — add keys here if your app needs them
const requiredInProd = [
  // Core
  "MONGO_URI",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  // Queue / Storage
  // "QUEUE_REDIS_URL",
  // "B2_KEY_ID",
  // "B2_APP_KEY",
];

if (nodeEnv === "production") {
  const missing = requiredInProd.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error("❌ Missing required env vars:", missing.join(", "));
    throw new Error("Missing required env vars: " + missing.join(", "));
  }
}

export const config = {
  nodeEnv,
  port: Number(process.env.PORT || 8000),

  // Mongo
  mongoUri: process.env.MONGO_URI || "",

  // JWT
  jwtSecret: process.env.JWT_SECRET || "",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "",

  // Client
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  allowOrigins: process.env.ALLOW_ORIGINS || process.env.CLIENT_URL || (nodeEnv !== "production" ? "*" : ""),

  // Redis / Upstash
  upstashRedisUrl: process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL || "",
  upstashDbId: process.env.UPSTASH_DB_ID || "",
  upstashApiKey: process.env.UPSTASH_API_KEY || "",
  queueRedisUrl: process.env.QUEUE_REDIS_URL || "",

  // Backblaze B2
  b2: {
    endpoint: process.env.B2_ENDPOINT || "",
    region: process.env.B2_REGION || "",
    keyId: process.env.B2_KEY_ID || "",
    appKey: process.env.B2_APP_KEY || "",
    bucketName: process.env.B2_BUCKET_NAME || "",
    bucketId: process.env.B2_BUCKET_ID || "",
  },

  // Cloudinary (optional)
  cloudinary: {
    name: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
  },

  // CDN (optional, used in production)
  cdnDomain: process.env.CDN_DOMAIN || "",

  // OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
  facebookAppId: process.env.FACEBOOK_APP_ID || "",
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET || "",
  facebookCallbackUrl:
    process.env.FACEBOOK_CALLBACK_URL || "/api/auth/facebook/callback",

  // Email
  emailUser: process.env.EMAIL_USER || "",
  emailPass: process.env.EMAIL_PASS || "",
  // Logging
  logLevel: process.env.LOG_LEVEL || (nodeEnv === "production" ? "info" : "debug"),
  logToFile: process.env.LOG_TO_FILE === "true" || nodeEnv === "production",
  // Worker
  workerConcurrency: Number(process.env.WORKER_CONCURRENCY || 5),
  // CORS
  allowedOrigins: (process.env.ALLOW_ORIGINS || process.env.CLIENT_URL || (nodeEnv !== "production" ? "*" : ""))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};

export default config;

export const isDev = () => config.nodeEnv !== "production";
export const isProd = () => config.nodeEnv === "production";
