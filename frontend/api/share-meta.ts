import { resolveShareHtml } from "../src/share/og";

export const config = { runtime: "edge" };

const FALLBACK_API = "https://tvp-backend.fly.dev/api";

function apiBase(): string {
  const raw = process.env.VITE_API_URL || process.env.API_URL || FALLBACK_API;
  return raw.replace(/\/$/, "");
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const html = await resolveShareHtml({
    origin: url.origin,
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
