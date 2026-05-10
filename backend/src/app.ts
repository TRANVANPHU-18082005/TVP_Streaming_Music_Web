import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import passport from "passport";

import mongoose from "mongoose";
import "./config/passport";
import { apiLimiter } from "./middlewares/rateLimiter";
import routes from "./routes"; // Import routes chính
import { cacheRedis, queueRedis } from "./config/redis";

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// ── 0. HEALTH CHECK (Dùng app.get trực tiếp và đặt ĐẦU TIÊN) ──────────────────────
app.get("/api/health", async (_req, res) => {
  const start = Date.now();
  const summary: Record<string, any> = {
    uptime: process.uptime(),
    time: new Date().toISOString(),
  };

  try {
    const rss = process.memoryUsage().rss;
    summary.memory = { rss };
    // Logic memory check của Phú giữ nguyên...
  } catch (err) {
    summary.memoryError = String(err);
  }

  const timeout = (ms: number) => new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms));

  // 1) MongoDB
  try {
    const state = mongoose.connection.readyState; 
    summary.mongo = { state };
    if (state !== 1) {
      await Promise.race([mongoose.connection.db?.admin().ping(), timeout(3000)]);
    }
  } catch (err: any) {
    return res.status(503).json({ ok: false, reason: "mongo_unreachable", summary });
  }

  // 2 & 3) Redis Ping Helper
  const pingRedis = async (client: any) => {
    try {
      if (!client) throw new Error("no_client");
      // ioredis status check
      if (client.status !== "ready") await Promise.race([client.connect(), timeout(3000)]);
      await Promise.race([client.ping(), timeout(2000)]);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  };

  summary.cache = await pingRedis(cacheRedis);
  summary.queue = await pingRedis(queueRedis);

  if (!summary.cache.ok || !summary.queue.ok) {
    return res.status(503).json({ ok: false, reason: "redis_unreachable", summary });
  }

  summary.elapsed = Date.now() - start;
  return res.status(200).json({ ok: true, summary });
});

// ── 1. MIDDLEWARES BẢO MẬT & LOGGING ───────────────────────────────────────────
app.use(morgan("dev"));
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const rawOrigins = process.env.ALLOW_ORIGINS || process.env.CLIENT_URL || "http://localhost:5173";
const allowedOrigins = rawOrigins.split(",").map((s) => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// ── 2. ROUTES CHÍNH ───────────────────────────────────────────────────────────
app.use("/api", apiLimiter);
app.use("/api", routes);

export default app;