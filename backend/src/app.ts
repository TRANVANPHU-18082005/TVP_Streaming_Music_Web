import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import { httpLogFormat } from "./config/httpLog";
import cookieParser from "cookie-parser";
import passport from "passport";
import "./config/passport";
import { apiLimiter } from "./middlewares/rateLimiter";
import { httpCacheHeaders } from "./middlewares/httpCache";
import { collectReadiness, ROUTES_MOUNTED_KEY } from "./health/readiness";

const app = express();

app.set("trust proxy", 1);

// ── 1. MIDDLEWARES BẢO MẬT & LOGGING ───────────────────────────────────────────
app.use(morgan(httpLogFormat()));
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

// Liveness only. Registered before apiLimiter so Fly.io polling cannot 429.
// Do not check Mongo or Redis here.
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api", apiLimiter);
app.use("/api", httpCacheHeaders);

// Readiness: MongoDB, cache Redis, queue Redis, and whether /api routes mounted.
app.get("/api/ready", async (req, res) => {
  const routesMounted = req.app.get(ROUTES_MOUNTED_KEY) === true;
  const result = await collectReadiness(routesMounted);
  res.status(result.httpStatus).json(result.body);
});
export default app;

export const createApp = (): express.Express => app;
