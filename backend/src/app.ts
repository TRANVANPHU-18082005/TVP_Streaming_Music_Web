// src/app.ts
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import passport from "passport";

import "./config/passport";
import { apiLimiter } from "./middlewares/rateLimiter";
import routes from "./routes";

const app = express();

// If running behind a reverse proxy (NGINX, Cloud Run, Heroku), enable trust proxy
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

/* 🔥 1. Global middlewares */
app.use(morgan("dev"));
app.use(helmet());

/* ✅ CORS xử lý OPTIONS tự động */
// Support multiple origins via comma-separated CLIENT_URL env var.
const rawOrigins = process.env.CLIENT_URL || "http://localhost:5173";
const allowedOrigins = rawOrigins
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests like curl/postman
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(compression());

/* 2. Body parser */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* 3. Auth */
app.use(cookieParser());
app.use(passport.initialize());

/* 4. Rate limit */
app.use("/api", apiLimiter);

/* 5. Routes */
app.use("/api", routes);

export default app;
