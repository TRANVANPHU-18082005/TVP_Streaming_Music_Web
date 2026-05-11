import { Request, Response, NextFunction } from "express";

/**
 * RequireSameOrigin middleware
 * - Enforces that requests originate from configured CLIENT_URL(s)
 * - Only active in production to avoid developer friction
 */
import config from "../config/env";

export const requireSameOrigin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Only enforce in production
  if (!config || config.nodeEnv !== "production") return next();

  const allowed = config.allowedOrigins || [];

  const originHeader = req.get("origin") || req.get("referer");
  if (!originHeader) {
    return res
      .status(403)
      .json({ success: false, message: "Missing origin header" });
  }

  try {
    const origin = new URL(originHeader).origin;
    if (!allowed.includes(origin)) {
      return res
        .status(403)
        .json({ success: false, message: "Invalid origin" });
    }
    return next();
  } catch (err) {
    return res
      .status(403)
      .json({ success: false, message: "Invalid origin format" });
  }
};

export default requireSameOrigin;
