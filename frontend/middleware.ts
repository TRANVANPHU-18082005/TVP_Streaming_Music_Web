import { next, rewrite } from "@vercel/functions";
import { isCrawler } from "./src/share/og";

export const config = {
  matcher: ["/((?!api/|og/|assets/).*)"],
};

export default function middleware(request: Request): Response {
  if (!isCrawler(request.headers.get("user-agent") ?? "")) return next();
  const incoming = new URL(request.url);
  const target = new URL("/api/share-meta", incoming.origin);
  target.searchParams.set("path", incoming.pathname);
  return rewrite(target);
}
