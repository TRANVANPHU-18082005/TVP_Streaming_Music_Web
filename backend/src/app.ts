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

const app = express();

app.set("trust proxy", 1);

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
  } catch (err) {
    summary.memoryError = String(err);
  }

  const timeout = (ms: number) =>
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms));

  // 1) MongoDB
  try {
    const state = mongoose.connection.readyState;
    summary.mongo = { state };
    if (state !== 1) {
      await Promise.race([
        mongoose.connection.db?.admin().ping(),
        timeout(3000),
      ]);
    }
  } catch (err: any) {
    return res
      .status(503)
      .json({ ok: false, reason: "mongo_unreachable", summary });
  }

  // 2 & 3) Redis Ping Helper — import redis clients lazily to avoid import-time side-effects
  const pingRedis = async (client: any) => {
    try {
      if (!client) throw new Error("no_client");
      if (client.status !== "ready")
        await Promise.race([client.connect(), timeout(3000)]);
      await Promise.race([client.ping(), timeout(2000)]);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  };

  try {
    const { cacheRedis, queueRedis } = await import("./config/redis");
    summary.cache = await pingRedis(cacheRedis);
    summary.queue = await pingRedis(queueRedis);

    if (!summary.cache.ok || !summary.queue.ok) {
      return res
        .status(503)
        .json({ ok: false, reason: "redis_unreachable", summary });
    }
  } catch (err: any) {
    return res
      .status(503)
      .json({ ok: false, reason: "redis_import_failed", summary });
  }

  summary.elapsed = Date.now() - start;
  return res.status(200).json({ ok: true, summary });
});

// ── 1. MIDDLEWARES BẢO MẬT & LOGGING ───────────────────────────────────────────
app.use(morgan("dev"));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

const rawOrigins =
  process.env.ALLOW_ORIGINS ||
  process.env.CLIENT_URL ||
  "http://localhost:5173";
const allowedOrigins = rawOrigins
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser tools or same-origin requests
      if (!origin) return callback(null, true);

      // If configured with wildcard '*' allow all origins (useful in development)
      if (allowedOrigins.includes("*")) return callback(null, true);

      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// ── 2. ROUTES CHÍNH ───────────────────────────────────────────────────────────
// Do not mount heavy routes at import time. Routes will be mounted dynamically
// from `index.ts` after the server is listening and infra is ready.
app.use("/api", apiLimiter);

export default app;

export const createApp = (): express.Express => app;
