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

/* 🔥 1. Global middlewares */
app.use(morgan("dev"));
app.use(helmet());

/* ✅ CORS xử lý OPTIONS tự động */
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
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
