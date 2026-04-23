// ─────────────────────────────────────────────────────────────────────────────
// URL UTILS
// ─────────────────────────────────────────────────────────────────────────────

const PRIVATE_RE =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|::1|fc[0-9a-f]{2}:.*)$/i;

/**
 * Sanitise URL — trim, strip newlines, validate scheme, block SSRF ranges.
 */
export function sanitiseUrl(raw: string): string {
  const cleaned = raw.trim().replace(/[\n\r\t]/g, "");
  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    throw new Error(`[sanitiseUrl] Malformed URL: "${raw}"`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`[sanitiseUrl] Disallowed URL scheme: ${parsed.protocol}`);
  }
  const hostname = parsed.hostname.toLowerCase();
  if (PRIVATE_RE.test(hostname)) {
    throw new Error(
      `[sanitiseUrl] Access to private/loopback address "${hostname}" is forbidden.`,
    );
  }
  return parsed.href;
}

/**
 * Extract the relative path after the bucket name in a B2/CDN URL.
 */
export function extractRelativePath(
  fileUrl: string,
  bucketName: string,
): string {
  const marker = `${bucketName}/`;
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) {
    throw new Error(
      `[extractRelativePath] fileUrl "${fileUrl}" does not contain bucket marker "${marker}".`,
    );
  }
  return fileUrl.slice(idx + marker.length);
}

/**
 * Build CDN/storage base URL from env — uses CLOUDFLARE_DOMAIN in prod,
 * B2_ENDPOINT otherwise. Trailing slashes stripped.
 */
export function buildBaseUrl(): string {
  const isProd = process.env.NODE_ENV === "production";
  const envKey = isProd ? "CLOUDFLARE_DOMAIN" : "B2_ENDPOINT";
  const raw = process.env[envKey];
  if (!raw) throw new Error(`[buildBaseUrl] Missing env var: ${envKey}`);
  return raw.replace(/\/+$/, "");
}
