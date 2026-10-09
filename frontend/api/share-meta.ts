import { resolveShareHtml } from "../src/share/og";

export const config = { runtime: "edge" };

const FALLBACK_API = "https://tvp-backend.fly.dev/api";

function apiBase(): string {
  const raw = process.env.VITE_API_URL || process.env.API_URL || FALLBACK_API;
  return raw.replace(/\/$/, "");
}

/**
 * Lấy canonical origin theo thứ tự ưu tiên:
 *   1. SITE_URL env var (đặt trong Vercel dashboard) — đáng tin nhất
 *   2. x-forwarded-host header — Vercel đặt khi dùng custom domain
 *   3. Fallback về host của request
 */
function canonicalOrigin(request: Request): string {
  const siteUrl = process.env.SITE_URL || process.env.VITE_APP_URL;
  if (siteUrl) return siteUrl.replace(/\/$/, "");

  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || url.host;
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const origin = canonicalOrigin(request);

  const html = await resolveShareHtml({
    origin,
    pathname: url.searchParams.get("path") || "/",
    apiBase: apiBase(),
  });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=300",
      vary: "user-agent",
    },
  });
}
