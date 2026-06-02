import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import passport from "passport";
import fs from "fs/promises";
import os from "os";
import mongoose from "mongoose";
import "./config/passport";
import { apiLimiter } from "./middlewares/rateLimiter";

const app = express();

app.set("trust proxy", 1);

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

// ── HEALTH CHECK (Production Optimized) ─────────────────────────────
app.get("/api/health", async (req, res) => {
  const start = Date.now();
  // 🚀 Trừ hao 200ms để đảm bảo gửi kịp response 504 trước khi Fly.io (2s) ngắt mạng
  const TIMEOUT_MS = 1800;

  const safeTimeout = <T>(p: Promise<T>, ms: number, fallback: T) =>
    Promise.race([
      p,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
    ]);

  // MongoDB check
  const checkMongo = async () => {
    try {
      const state = mongoose.connection.readyState;
      if (state === 1) return { ok: true, state };

      if (mongoose.connection.db) {
        const ping = (mongoose.connection.db as any).admin().ping();
        await safeTimeout(ping, 1000, null); // Ép giới hạn 1 giây
        return { ok: true, state: mongoose.connection.readyState };
      }
      return { ok: false, state };
    } catch (err: any) {
      return { ok: false, error: String(err.message || err) };
    }
  };

  // Redis check (Vẫn giữ lazy import rất tốt của bạn)
  const checkRedis = async () => {
    try {
      const { cacheRedis, queueRedis } = await import("./config/redis");
      const checks = await Promise.all([
        safeTimeout(cacheRedis.ping(), 800, "timeout"),
        safeTimeout(queueRedis.ping(), 800, "timeout"),
      ]);
      return {
        cache: checks[0] === "PONG",
        queue: checks[1] === "PONG",
      };
    } catch (err: any) {
      return { ok: false, error: String(err.message || err) };
    }
  };
  try {
    const results = await Promise.race([
      Promise.all([checkMongo(), checkRedis()]),
      new Promise((resolve) =>
        setTimeout(() => resolve(["timeout"]), TIMEOUT_MS),
      ),
    ]);

    const elapsed = Date.now() - start;

    if (Array.isArray(results) && results[0] === "timeout") {
      return res.status(504).json({ status: "timeout", elapsedMs: elapsed });
    }

    const [mongo, redis] = results as any;
    const ok = !!(mongo?.ok && redis?.cache && redis?.queue);

    return res.status(ok ? 200 : 503).json({
      status: ok ? "ok" : "degraded",
      elapsedMs: elapsed,
      checks: { mongo, redis },
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({ status: "error", error: String(err.message || err) });
  }
});
export default app;

export const createApp = (): express.Express => app;
