import type { NextFunction, Request, Response } from "express";

const NO_STORE_PREFIXES = ["/auth", "/verification", "/ai", "/ready", "/health"];

const PRIVATE_PREFIXES = [
  "/profile",
  "/notifications",
  "/dashboard",
  "/analytics",
  "/users",
  "/rooms",
];

const CATALOG_PREFIXES = [
  "/tracks",
  "/albums",
  "/artists",
  "/playlists",
  "/genres",
  "/search",
  "/mood-videos",
  "/shorts",
  "/mashups",
  "/karaoke",
];

const KARAOKE_PRIVATE_PREFIXES = ["/karaoke/my-", "/karaoke/admin"];

function normalizePath(path: string): string {
  if (path.startsWith("/api/")) return path.slice(4);
  if (path === "/api") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * Cache-Control for a request. Catalog GETs may be stored by the browser.
 * Authenticated catalog responses stay private so one user cannot reuse another's body.
 */
export function cacheControlFor(
  method: string,
  path: string,
  hasAuthorization: boolean,
): string {
  if (method !== "GET" && method !== "HEAD") return "no-store";

  const normalized = normalizePath(path);

  if (KARAOKE_PRIVATE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return "private, no-store";
  }

  if (NO_STORE_PREFIXES.some((prefix) => matchesPrefix(normalized, prefix))) {
    return "private, no-store";
  }

  if (PRIVATE_PREFIXES.some((prefix) => matchesPrefix(normalized, prefix))) {
    return "private, max-age=20";
  }

  if (CATALOG_PREFIXES.some((prefix) => matchesPrefix(normalized, prefix))) {
    if (hasAuthorization) return "private, max-age=30";
    return "public, max-age=60, stale-while-revalidate=120";
  }

  return "private, no-store";
}

export function httpCacheHeaders(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const hasAuthorization = Boolean(req.headers.authorization);
  res.setHeader("Vary", "Authorization, Accept-Encoding");
  res.setHeader(
    "Cache-Control",
    cacheControlFor(req.method, req.path, hasAuthorization),
  );
  next();
}
